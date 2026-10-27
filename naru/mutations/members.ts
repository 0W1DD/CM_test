// Members' roles and leaving (commung's membership.service updateMemberRole,
// removeMember and leaveCommunity).
import { requireMembership } from "../modules/access.js";
import {
  endMembership,
  membershipIdOf,
  revokeSharedProfiles,
} from "../modules/admin.js";
import {
  argsOf,
  denied,
  invalid,
  iso,
  type MutationCtx,
  notFound,
} from "../modules/core.js";

async function ownerOnly(ctx: MutationCtx, message: string) {
  const me = await requireMembership(ctx);
  if (me.role !== "owner") denied(ctx, message, "not_owner");
  return me;
}

async function target(ctx: MutationCtx, value: unknown) {
  const member = membershipIdOf(ctx, value);
  const { rows } = await ctx.sql<{ member: string; role: string }>`
    SELECT member, role FROM members WHERE member = ${member}`;
  if (!rows[0]) notFound(ctx, "멤버십을 찾을 수 없습니다");
  return rows[0];
}

/**
 * Changes a member's role (the owner only). Making someone owner hands
 * the community over: the owner becomes a moderator. A moderator made a
 * member loses the profiles shared with them.
 */
export async function setRole(ctx: MutationCtx, args: unknown) {
  const me = await ownerOnly(
    ctx,
    "커뮤 소유자만 회원 역할을 업데이트할 수 있습니다",
  );
  const a = argsOf(args);
  const role = a.role;
  if (role !== "owner" && role !== "moderator" && role !== "member")
    invalid(ctx, "role 값이 올바르지 않습니다.");
  const t = await target(ctx, a.membership_id);
  if (role === "owner") {
    if (t.role === "owner") invalid(ctx, "이미 소유자입니다", "already_owner");
    await ctx.sql`
      UPDATE members SET role = 'moderator', updated_at = ${ctx.now} WHERE member = ${me.member}`;
    await ctx.sql`
      UPDATE members SET role = 'owner', updated_at = ${ctx.now} WHERE member = ${t.member}`;
    return {
      membership_id: t.member,
      role,
      ownership_transferred: true,
      updated_at: iso(ctx.now),
    };
  }
  if (t.role === "owner")
    invalid(
      ctx,
      "소유자의 역할을 변경할 수 없습니다. 소유권을 먼저 이전하세요",
      "target_owner",
    );
  await ctx.sql`
    UPDATE members SET role = ${role}, updated_at = ${ctx.now} WHERE member = ${t.member}`;
  if (t.role === "moderator" && role === "member")
    await revokeSharedProfiles(ctx, t.member);
  return { membership_id: t.member, role, updated_at: iso(ctx.now) };
}

/** Removes a member (the owner only); not the owner. */
export async function remove(ctx: MutationCtx, args: unknown) {
  await ownerOnly(ctx, "커뮤 소유자만 회원을 제거할 수 있습니다");
  const t = await target(ctx, argsOf(args).membership_id);
  if (t.role === "owner")
    invalid(ctx, "커뮤 소유자는 제거할 수 없습니다", "target_owner");
  await endMembership(ctx, t.member);
  return { membership_id: t.member, removed: true };
}

/** The calling member leaves the community; the owner cannot. */
export async function leave(ctx: MutationCtx) {
  const me = await requireMembership(ctx);
  if (me.role === "owner")
    denied(
      ctx,
      "소유자는 커뮤를 떠날 수 없습니다. 먼저 소유권을 이전하세요",
      "owner_cannot_leave",
    );
  await endMembership(ctx, me.member);
  return { membership_id: me.member, left: true };
}
