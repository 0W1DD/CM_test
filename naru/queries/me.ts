// The caller: commung's /instance, /me, /me/instance and /me/profiles.
import { membershipOf } from "../modules/access.js";
import { publicInstance, settingsOf, slugOf } from "../modules/community.js";
import { iso, type QueryCtx } from "../modules/core.js";
import {
  PROFILE_COLUMNS,
  PROFILE_PICTURE_JOIN,
  type ProfileJsonRow,
  profileJson,
} from "../modules/profiles.js";

/** The community as anyone sees it (/instance). */
export async function instance(ctx: QueryCtx) {
  return publicInstance(ctx, await settingsOf(ctx));
}

/**
 * The signed-in member: their membership, latest application and profiles,
 * in one answer (commung's /me, /me/instance and /me/profiles). Null for
 * visitors.
 */
export async function session(ctx: QueryCtx) {
  if (!ctx.member) return null;
  const settings = await settingsOf(ctx);
  const membership = await membershipOf(ctx);
  const { rows: applications } = await ctx.sql<{
    id: string;
    status: string;
    rejection_reason: string | null;
    created_at: number;
  }>`SELECT id, status, rejection_reason, created_at FROM applications
     WHERE member = ${ctx.member.id} ORDER BY created_at DESC LIMIT 1`;
  const application = applications[0];
  return {
    id: ctx.member.id,
    role: membership?.role ?? null,
    is_member: membership !== null,
    application: application
      ? {
          id: application.id,
          status: application.status,
          rejection_reason: application.rejection_reason,
          created_at: iso(application.created_at),
        }
      : null,
    instance: {
      ...publicInstance(ctx, settings),
      role: membership?.role ?? null,
      starts_at: iso(settings?.starts_at),
      ends_at: iso(settings?.ends_at),
      is_recruiting: settings?.is_recruiting === 1,
      recruiting_starts_at: iso(settings?.recruiting_starts_at),
      recruiting_ends_at: iso(settings?.recruiting_ends_at),
      minimum_birth_year: settings?.minimum_birth_year ?? null,
      show_all_replies: settings?.show_all_replies === 1,
      bump_on_reply: settings?.bump_on_reply === 1,
      slug: slugOf(ctx),
    },
    profiles: membership ? await myProfiles(ctx, ctx.member.id) : [],
  };
}

/** The member's active profiles, oldest first, with their part in each. */
async function myProfiles(ctx: QueryCtx, member: string) {
  const { rows } = await ctx.sql<ProfileJsonRow & { role: string }>(
    `SELECT ${PROFILE_COLUMNS}, o.role FROM profile_owners o
     JOIN profiles p ON p.id = o.profile_id ${PROFILE_PICTURE_JOIN}
     WHERE o.member = ? AND p.deleted_at IS NULL AND p.activated_at IS NOT NULL
     ORDER BY p.created_at`,
    [member],
  );
  return rows.map((row) => ({ ...profileJson(row), role: row.role }));
}
