// The community's members with their profiles (commung's console members
// list and member stats), for the owner and moderators.
import { requireStaff } from "../modules/access.js";
import {
  argsOf,
  bool,
  iso,
  limitOf,
  offsetOf,
  type QueryCtx,
  type SqlValue,
} from "../modules/core.js";

interface MemberRow {
  member: string;
  role: "owner" | "moderator" | "member";
  created_at: number;
  activated_at: number | null;
  application_json: string | null;
  profiles_json: string;
  [key: string]: SqlValue;
}

interface ProfileCell {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  primary: number;
  muted_at: number | null;
  muted_by_id: string | null;
  profile_picture_url: string | null;
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Members, newest first, `limit` (50) from `offset`, filtered by `role` and
 * by `q` in their profiles' names and usernames. A member's `id` is their
 * member ID (commung's membership ID).
 */
export async function list(ctx: QueryCtx, args: unknown) {
  const me = await requireStaff(ctx);
  const a = argsOf(args);
  const role =
    a.role === "owner" || a.role === "moderator" || a.role === "member"
      ? a.role
      : null;
  const q =
    typeof a.q === "string" ? a.q.trim().toLowerCase().slice(0, 100) : "";
  const pattern = q ? `%${escapeLike(q)}%` : null;
  const { rows } = await ctx.sql<MemberRow>`
    SELECT m.member, m.role, m.created_at, m.activated_at,
      (SELECT json_object('id', ap.id, 'profile_name', ap.profile_name,
          'profile_username', ap.profile_username, 'message', ap.message,
          'status', ap.status, 'created_at', ap.created_at)
        FROM applications ap WHERE ap.id = m.application_id) AS application_json,
      (SELECT json_group_array(json_object('id', p.id, 'name', p.name,
          'username', p.username, 'bio', p.bio, 'primary', p.is_primary,
          'muted_at', p.muted_at, 'muted_by_id', p.muted_by_id,
          'profile_picture_url', pic.url))
        FROM (SELECT p.* FROM profile_owners o JOIN profiles p ON p.id = o.profile_id
          WHERE o.member = m.member AND p.deleted_at IS NULL
            AND p.activated_at IS NOT NULL
          ORDER BY p.is_primary DESC, p.created_at) p
        LEFT JOIN images pic ON pic.id = p.picture_id) AS profiles_json
    FROM members m
    WHERE (${role} IS NULL OR m.role = ${role})
      AND (${pattern} IS NULL OR EXISTS (
        SELECT 1 FROM profile_owners o JOIN profiles p ON p.id = o.profile_id
        WHERE o.member = m.member AND p.deleted_at IS NULL AND p.activated_at IS NOT NULL
          AND (lower(p.name) LIKE ${pattern} ESCAPE '\\'
            OR lower(p.username) LIKE ${pattern} ESCAPE '\\')))
    ORDER BY m.created_at DESC, m.member
    LIMIT ${limitOf(a.limit, 50, 100)} OFFSET ${offsetOf(a.offset)}`;
  return rows.map((row) => {
    const profiles = (JSON.parse(row.profiles_json) as ProfileCell[]).map(
      (p) => ({
        id: p.id,
        name: p.name,
        username: p.username,
        bio: p.bio,
        primary: bool(p.primary),
        activated: true,
        muted_at: iso(p.muted_at),
        muted_by_id: p.muted_by_id,
        profile_picture_url: p.profile_picture_url,
      }),
    );
    const application = row.application_json
      ? (JSON.parse(row.application_json) as Record<string, SqlValue>)
      : null;
    return {
      id: row.member,
      role: row.role,
      active: true,
      created_at: iso(row.created_at),
      is_current_user: row.member === me.member,
      profiles,
      // Groups a member's profiles; the member ID is already the row's ID.
      user_group: profiles.length > 1 ? row.member : undefined,
      application: application
        ? { ...application, created_at: iso(application.created_at) }
        : null,
    };
  });
}

/** Members by role (commung's members/stats). */
export async function stats(ctx: QueryCtx) {
  await requireStaff(ctx);
  const { rows } = await ctx.sql<{ role: string; n: number }>`
    SELECT role, count(*) AS n FROM members GROUP BY role`;
  const out = { owner: 0, moderator: 0, member: 0 };
  for (const row of rows)
    if (
      row.role === "owner" ||
      row.role === "moderator" ||
      row.role === "member"
    )
      out[row.role] = row.n;
  return out;
}
