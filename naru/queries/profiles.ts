// Reading profiles: commung's GET /app/profiles, /profiles/:username,
// /profiles/post-count, /profiles/online-status and
// /profiles/:profile_id/users.
import {
  memberId,
  requireMembership,
  requireOwner,
} from "../modules/access.js";
import {
  argsOf,
  id,
  ids,
  iso,
  type QueryCtx,
  text,
  uuidv7,
} from "../modules/core.js";
import { ownedProfile, profileByUsername } from "../modules/ownership.js";
import {
  PROFILE_COLUMNS,
  PROFILE_PICTURE_JOIN,
  type ProfileJsonRow,
} from "../modules/profiles.js";

/** A profile counts as online this long after its last heartbeat. */
export const ONLINE_FOR_MS = 5 * 60 * 1000;

/**
 * Every active profile, newest first, for mention autocomplete and the
 * members page. Profiles of one member share a `user_group_key`, random for
 * each answer, so a page can group them without learning member IDs.
 */
export async function list(ctx: QueryCtx) {
  memberId(ctx);
  const { rows } = await ctx.sql<
    ProfileJsonRow & { owner: string; user_role: string | null }
  >(
    `SELECT ${PROFILE_COLUMNS}, o.member AS owner, m.role AS user_role
     FROM profiles p
     JOIN profile_owners o ON o.profile_id = p.id AND o.role = 'owner'
     LEFT JOIN members m ON m.member = o.member
     ${PROFILE_PICTURE_JOIN}
     WHERE p.deleted_at IS NULL AND p.activated_at IS NOT NULL
     ORDER BY p.id DESC LIMIT 1000`,
  );
  const groupKeys = new Map<string, string>();
  return rows.map((row) => {
    let key = groupKeys.get(row.owner);
    if (!key) {
      key = uuidv7(ctx.now);
      groupKeys.set(row.owner, key);
    }
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      bio: row.bio,
      profile_picture_url: row.profile_picture_url,
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
      activatedAt: iso(row.activated_at),
      is_primary: row.is_primary === 1,
      user_group_key: key,
      user_role: row.user_role ?? "member",
    };
  });
}

/** The posts a profile wrote and did not delete. */
async function postCountOf(ctx: QueryCtx, profileId: string) {
  const { rows } = await ctx.sql<{ n: number }>`
    SELECT count(*) AS n FROM posts
    WHERE author_id = ${profileId} AND deleted_at IS NULL`;
  return rows[0]?.n ?? 0;
}

/**
 * An active profile by username, for anyone (commung's
 * GET /profiles/:username). `profile_id`, the page's acting profile, is
 * taken and not needed.
 */
export async function get(ctx: QueryCtx, args: unknown) {
  const username = text(ctx, argsOf(args).username, "사용자명", { max: 200 });
  const profile = await profileByUsername(ctx, username, { active: true });
  if (!profile)
    ctx.fail("NOT_FOUND", "프로필을 찾을 수 없습니다", { reason: "not_found" });
  const { rows } = await ctx.sql<{ url: string }>`
    SELECT url FROM images WHERE id = ${profile.picture_id}`;
  return {
    id: profile.id,
    username: profile.username,
    name: profile.name,
    bio: profile.bio,
    profile_picture_url: rows[0]?.url ?? null,
    created_at: iso(profile.created_at),
    updated_at: iso(profile.updated_at),
    post_count: await postCountOf(ctx, profile.id),
  };
}

/** How many posts a profile has, for the delete confirmation. */
export async function postCount(ctx: QueryCtx, args: unknown) {
  await requireMembership(ctx);
  const profileId = id(ctx, argsOf(args).profile_id, "profile_id");
  return { post_count: await postCountOf(ctx, profileId) };
}

/**
 * Whether each profile is online: active within five minutes and showing
 * it. `online_until` says when that ends without another heartbeat, so a
 * live page can stop showing it on time.
 */
export async function onlineStatus(ctx: QueryCtx, args: unknown) {
  await requireMembership(ctx);
  const profileIds = ids(ctx, argsOf(args).profile_ids, "profile_ids", 1000);
  if (!profileIds.length) return [];
  const { rows } = await ctx.sql<{
    id: string;
    online_status_visible: number;
    last_active_at: number | null;
  }>`
    SELECT p.id, p.online_status_visible, a.last_active_at FROM profiles p
    LEFT JOIN profile_activity a ON a.profile_id = p.id
    WHERE p.id IN (SELECT value FROM json_each(${JSON.stringify(profileIds)}))
      AND p.deleted_at IS NULL`;
  return rows.map((row) => {
    const until =
      row.online_status_visible === 1 && row.last_active_at !== null
        ? row.last_active_at + ONLINE_FOR_MS
        : null;
    const online = until !== null && until > ctx.now;
    return {
      profile_id: row.id,
      is_online: online,
      online_until: online ? iso(until) : null,
    };
  });
}

/**
 * The members a profile is shared with, each with all their profiles
 * (commung's GET /profiles/:profile_id/users): the community owner, for a
 * profile they own.
 */
export async function users(ctx: QueryCtx, args: unknown) {
  await requireOwner(ctx);
  const profile = await ownedProfile(
    ctx,
    argsOf(args).profile_id,
    "이 프로필을 관리할 권한이 없습니다",
    "ACCESS_DENIED",
  );
  const { rows } = await ctx.sql<{
    member: string;
    role: "owner" | "admin";
    added_at: number;
    id: string | null;
    name: string | null;
    username: string | null;
    is_primary: number | null;
    profile_picture_url: string | null;
    own_role: string | null;
  }>`
    SELECT o.member, o.role, o.created_at AS added_at, o2.role AS own_role,
      p.id, p.name, p.username, p.is_primary, pic.url AS profile_picture_url
    FROM profile_owners o
    LEFT JOIN profile_owners o2 ON o2.member = o.member
    LEFT JOIN profiles p ON p.id = o2.profile_id AND p.deleted_at IS NULL
    LEFT JOIN images pic ON pic.id = p.picture_id
    WHERE o.profile_id = ${profile.id}
    ORDER BY o.role = 'owner' DESC, o.created_at, o.member, p.created_at`;
  const byMember = new Map<
    string,
    {
      primary_profile_id: string | null;
      profiles: {
        id: string;
        name: string;
        username: string;
        profile_picture_url: string | null;
        is_primary: boolean;
      }[];
      role: "owner" | "admin";
      added_at: string | null;
    }
  >();
  // Who to remove is named by a profile the member owns: their primary one,
  // else their first.
  const firstOwned = new Map<string, string>();
  for (const row of rows) {
    let user = byMember.get(row.member);
    if (!user) {
      user = {
        primary_profile_id: null,
        profiles: [],
        role: row.role,
        added_at: iso(row.added_at),
      };
      byMember.set(row.member, user);
    }
    if (row.id === null || row.name === null || row.username === null) continue;
    if (user.profiles.some((p) => p.id === row.id)) continue;
    user.profiles.push({
      id: row.id,
      name: row.name,
      username: row.username,
      profile_picture_url: row.profile_picture_url,
      is_primary: row.is_primary === 1,
    });
    if (row.own_role !== "owner") continue;
    if (!firstOwned.has(row.member)) firstOwned.set(row.member, row.id);
    if (row.is_primary === 1 && !user.primary_profile_id)
      user.primary_profile_id = row.id;
  }
  for (const [member, user] of byMember)
    user.primary_profile_id ??= firstOwned.get(member) ?? null;
  return { users: [...byMember.values()] };
}
