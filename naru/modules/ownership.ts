// The profiles area's checks: usernames, and the profiles a member owns
// (commung's canManageProfile), refused with commung's own messages.
import {
  type Membership,
  type ProfileRow,
  requireMembership,
} from "./access.js";
import type { ErrorCode } from "../../types/functions";
import { type Ctx, id, invalid } from "./core.js";

/** A username as commung's usernameSchema took it: 1–50 of [a-zA-Z0-9_], lowercased. */
export function usernameOf(ctx: Ctx, value: unknown): string {
  if (typeof value !== "string" || !value.trim())
    invalid(ctx, "사용자명을 입력해주세요");
  const username = value.trim();
  if (username.length > 50)
    invalid(ctx, "사용자명은 50자를 초과할 수 없습니다");
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    invalid(ctx, "사용자명은 영문, 숫자, 언더스코어(_)만 사용할 수 있습니다");
  return username.toLowerCase();
}

/** The live profile (any, not deleted) whose username is `username`, case-insensitively. */
export async function profileByUsername(
  ctx: Ctx,
  username: string,
  { active = false } = {},
): Promise<ProfileRow | null> {
  const { rows } = await ctx.sql<ProfileRow>(
    `SELECT * FROM profiles
     WHERE lower(username) = lower(?) AND deleted_at IS NULL
       ${active ? "AND activated_at IS NOT NULL" : ""}`,
    [username],
  );
  return rows[0] ?? null;
}

/**
 * A profile the calling member owns (role `owner` in profile_owners), not
 * deleted; anything else is refused with `code` and `message`, as each of
 * commung's services did. Refuses non-members first.
 */
export async function ownedProfile(
  ctx: Ctx,
  profileId: unknown,
  message: string,
  code: ErrorCode = "NOT_FOUND",
): Promise<ProfileRow & { membership: Membership }> {
  const membership = await requireMembership(ctx);
  const pid = id(ctx, profileId, "profile_id");
  const { rows } = await ctx.sql<ProfileRow>`
    SELECT p.* FROM profiles p
    JOIN profile_owners o ON o.profile_id = p.id
      AND o.member = ${membership.member} AND o.role = 'owner'
    WHERE p.id = ${pid} AND p.deleted_at IS NULL`;
  const profile = rows[0];
  if (!profile)
    ctx.fail(code, message, {
      reason: code === "NOT_FOUND" ? "not_found" : "not_profile_owner",
    });
  return { ...profile, membership };
}

/** The member who owns a profile (its `owner` row), or null. */
export async function ownerOf(ctx: Ctx, profileId: string) {
  const { rows } = await ctx.sql<{ member: string }>`
    SELECT member FROM profile_owners
    WHERE profile_id = ${profileId} AND role = 'owner'`;
  return rows[0]?.member ?? null;
}
