// Who may do what. Anyone may call any query or mutation, so each decides
// from ctx.member (a Naru member, commung's user), the members table (an
// approved community member, commung's membership, and their role) and
// profile_owners (who may act as a profile). Naru's own admission is left
// `open`: commung's applications and approval are this site's own.
import { type Ctx, denied, id, notFound } from "./core.js";

export interface Membership {
  member: string;
  role: "owner" | "moderator" | "member";
  application_id: string | null;
  created_at: number;
  activated_at: number | null;
}

/** The calling member's membership, or null (a visitor, the owner, or not a member). */
export async function membershipOf(ctx: Ctx): Promise<Membership | null> {
  if (!ctx.member) return null;
  const { rows } = await ctx.sql<Membership>`
    SELECT member, role, application_id, created_at, activated_at
    FROM members WHERE member = ${ctx.member.id}`;
  return rows[0] ?? null;
}

/** The calling member's ID; refuses visitors and the owner's own handle. */
export function memberId(ctx: Ctx): string {
  if (!ctx.member)
    ctx.fail("AUTH_REQUIRED", "로그인이 필요합니다.", { reason: "signed_out" });
  return ctx.member.id;
}

/** The calling member's membership; refuses anyone who is not a member. */
export async function requireMembership(ctx: Ctx): Promise<Membership> {
  memberId(ctx);
  const membership = await membershipOf(ctx);
  if (!membership)
    denied(ctx, "이 커뮤의 회원이 아닙니다.", "not_member");
  return membership;
}

export const isStaff = (membership: Membership | null) =>
  membership?.role === "owner" || membership?.role === "moderator";

/** A moderator's or the owner's membership; refuses everyone else. */
export async function requireStaff(ctx: Ctx): Promise<Membership> {
  const membership = await requireMembership(ctx);
  if (!isStaff(membership))
    denied(
      ctx,
      "모더레이터 또는 소유자만 접근할 수 있습니다.",
      "not_moderator",
    );
  return membership;
}

/** The community owner's membership; refuses everyone else. */
export async function requireOwner(ctx: Ctx): Promise<Membership> {
  const membership = await requireMembership(ctx);
  if (membership.role !== "owner")
    denied(ctx, "커뮤 소유자만 접근할 수 있습니다.", "not_owner");
  return membership;
}

/** Refuses anyone but the site's owner signed in as the owner (`admin` handle). */
export function requireSiteOwner(ctx: Ctx) {
  if (!ctx.owner) denied(ctx, "사이트 소유자만 할 수 있습니다.", "not_site_owner");
}

export interface ProfileRow {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  picture_id: string | null;
  is_primary: number;
  muted_at: number | null;
  online_status_visible: number;
  activated_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/**
 * The profile the calling member acts as: it exists, is not deleted, and
 * they own it or were shared it (`manage` needs ownership). Refuses
 * non-members.
 */
export async function actingProfile(
  ctx: Ctx,
  profileId: unknown,
  { manage = false } = {},
): Promise<ProfileRow & { ownership: "owner" | "admin"; membership: Membership }> {
  const membership = await requireMembership(ctx);
  const pid = id(ctx, profileId, "profile_id");
  const { rows } = await ctx.sql<ProfileRow & { ownership: "owner" | "admin" }>`
    SELECT p.*, o.role AS ownership FROM profiles p
    JOIN profile_owners o ON o.profile_id = p.id AND o.member = ${membership.member}
    WHERE p.id = ${pid} AND p.deleted_at IS NULL`;
  const profile = rows[0];
  if (!profile) notFound(ctx, "프로필을 찾을 수 없습니다.");
  if (manage && profile.ownership !== "owner")
    denied(ctx, "프로필 소유자만 할 수 있습니다.", "not_profile_owner");
  return { ...profile, membership };
}

/** Refuses a muted profile's writes, as commung does. */
export function requireUnmuted(ctx: Ctx, profile: { muted_at: number | null }) {
  if (profile.muted_at !== null)
    denied(ctx, "뮤트된 프로필은 이 작업을 할 수 없습니다.", "muted");
}

/** Members (Naru IDs) who own or were shared each profile, for ctx.notify. */
export async function membersOfProfiles(
  ctx: Ctx,
  profileIds: readonly string[],
): Promise<string[]> {
  if (!profileIds.length) return [];
  const { rows } = await ctx.sql<{ member: string }>`
    SELECT DISTINCT member FROM profile_owners
    WHERE profile_id IN (SELECT value FROM json_each(${JSON.stringify(profileIds)}))`;
  return rows.map((row) => row.member);
}
