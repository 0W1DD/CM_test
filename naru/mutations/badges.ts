// Badges: the staff make, edit and remove them and give them to profiles;
// a profile's owner picks which one shows by its name.
import { actingProfile, requireStaff } from "../modules/access.js";
import {
  argsOf,
  id,
  ids,
  list,
  type MutationCtx,
  notFound,
  optionalText,
  text,
  uuidv7,
} from "../modules/core.js";

function fields(ctx: MutationCtx, a: Record<string, unknown>) {
  return {
    name: text(ctx, a.name, "뱃지 이름", { max: 30 }),
    emoji: text(ctx, a.emoji, "아이콘", { max: 16 }),
    description: optionalText(ctx, a.description, "설명", { max: 200 }),
  };
}

async function badgeOf(ctx: MutationCtx, value: unknown) {
  const badgeId = id(ctx, value, "badge_id");
  const { rows } = await ctx.sql<{ id: string }>`
    SELECT id FROM badges WHERE id = ${badgeId}`;
  if (!rows[0]) notFound(ctx, "뱃지를 찾을 수 없습니다.");
  return badgeId;
}

/** Makes a badge (the staff). */
export async function create(ctx: MutationCtx, args: unknown) {
  await requireStaff(ctx);
  const f = fields(ctx, argsOf(args));
  const badgeId = uuidv7(ctx.now);
  await ctx.sql`
    INSERT INTO badges (id, name, emoji, description, created_at, updated_at)
    VALUES (${badgeId}, ${f.name}, ${f.emoji}, ${f.description}, ${ctx.now}, ${ctx.now})`;
  return { id: badgeId, ...f };
}

/** Edits a badge's name, emoji and description (the staff). */
export async function update(ctx: MutationCtx, args: unknown) {
  await requireStaff(ctx);
  const a = argsOf(args);
  const badgeId = await badgeOf(ctx, a.badge_id);
  const f = fields(ctx, a);
  await ctx.sql`
    UPDATE badges SET name = ${f.name}, emoji = ${f.emoji},
      description = ${f.description}, updated_at = ${ctx.now}
    WHERE id = ${badgeId}`;
  return { id: badgeId, ...f };
}

/** Removes a badge, and takes it from everyone who has it (the staff). */
export async function remove(ctx: MutationCtx, args: unknown) {
  await requireStaff(ctx);
  const badgeId = await badgeOf(ctx, argsOf(args).badge_id);
  await ctx.sql`DELETE FROM profile_badges WHERE badge_id = ${badgeId}`;
  await ctx.sql`DELETE FROM badges WHERE id = ${badgeId}`;
  return { id: badgeId, removed: true };
}

/**
 * Sets who has a badge (the staff): `profile_ids` are given it, everyone
 * else loses it. A profile's first badge becomes its featured one.
 */
export async function setHolders(ctx: MutationCtx, args: unknown) {
  const me = await requireStaff(ctx);
  const a = argsOf(args);
  const badgeId = await badgeOf(ctx, a.badge_id);
  const profileIds = list(ids(ctx, a.profile_ids, "profile_ids", 1000));
  await ctx.sql`
    DELETE FROM profile_badges
    WHERE badge_id = ${badgeId}
      AND profile_id NOT IN (SELECT value FROM json_each(${profileIds}))`;
  await ctx.sql`
    INSERT INTO profile_badges (profile_id, badge_id, featured, granted_at, granted_by)
    SELECT p.id, ${badgeId},
      NOT EXISTS (SELECT 1 FROM profile_badges o WHERE o.profile_id = p.id),
      ${ctx.now}, ${me.member}
    FROM profiles p
    WHERE p.id IN (SELECT value FROM json_each(${profileIds}))
      AND p.deleted_at IS NULL
    ON CONFLICT (profile_id, badge_id) DO NOTHING`;
  const { rows } = await ctx.sql<{ n: number }>`
    SELECT count(*) AS n FROM profile_badges WHERE badge_id = ${badgeId}`;
  return { id: badgeId, holders: rows[0]?.n ?? 0 };
}

/** Picks the badge shown by a profile's name, or none (`badge_id` null). */
export async function feature(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await actingProfile(ctx, a.profile_id);
  const badgeId = a.badge_id === null ? null : id(ctx, a.badge_id, "badge_id");
  if (badgeId) {
    const { rows } = await ctx.sql<{ badge_id: string }>`
      SELECT badge_id FROM profile_badges
      WHERE profile_id = ${profile.id} AND badge_id = ${badgeId}`;
    if (!rows[0]) notFound(ctx, "가지고 있지 않은 뱃지입니다.");
  }
  await ctx.sql`
    UPDATE profile_badges SET featured = (badge_id IS ${badgeId})
    WHERE profile_id = ${profile.id}`;
  return { profile_id: profile.id, badge_id: badgeId };
}
