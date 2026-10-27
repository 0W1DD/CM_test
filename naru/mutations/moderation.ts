// Muting and unmuting profiles (commung's moderation.service), by the
// owner and moderators, each logged in moderation_log.
import { requireMembership } from "../modules/access.js";
import { logModeration, moderatorProfileId } from "../modules/admin.js";
import {
  argsOf,
  denied,
  id,
  invalid,
  type MutationCtx,
  notFound,
  optionalText,
} from "../modules/core.js";

/** The moderator's profile and the target profile, checked as commung did. */
async function moderate(ctx: MutationCtx, args: unknown) {
  const me = await requireMembership(ctx);
  if (me.role !== "owner" && me.role !== "moderator")
    denied(
      ctx,
      "소유자 또는 모더레이터만 이 작업을 수행할 수 있습니다",
      "not_moderator",
    );
  const moderatorId = await moderatorProfileId(ctx, me.member);
  if (!moderatorId) notFound(ctx, "프로필을 찾을 수 없습니다");
  const a = argsOf(args);
  const profileId = id(ctx, a.profile_id, "profile_id");
  const { rows } = await ctx.sql<{
    id: string;
    username: string;
    muted_at: number | null;
  }>`
    SELECT id, username, muted_at FROM profiles
    WHERE id = ${profileId} AND activated_at IS NOT NULL AND deleted_at IS NULL`;
  if (!rows[0]) notFound(ctx, "프로필을 찾을 수 없습니다");
  return { a, moderatorId, profile: rows[0] };
}

/** Mutes a profile, so it cannot post (commung's muteProfile). */
export async function mute(ctx: MutationCtx, args: unknown) {
  const { a, moderatorId, profile } = await moderate(ctx, args);
  if (profile.muted_at !== null)
    ctx.fail("CONFLICT", "프로필이 이미 음소거되었습니다", {
      reason: "already_muted",
    });
  if (moderatorId === profile.id)
    invalid(ctx, "자신의 프로필을 음소거할 수 없습니다", "self");
  const reason = optionalText(ctx, a.reason, "사유", { max: 1000 });
  await ctx.sql`
    UPDATE profiles SET muted_at = ${ctx.now}, muted_by_id = ${moderatorId},
      updated_at = ${ctx.now}
    WHERE id = ${profile.id}`;
  await logModeration(ctx, {
    action: "mute_profile",
    description: reason || `@${profile.username}의 프로필을 음소거했습니다`,
    moderator: moderatorId,
    target_profile_id: profile.id,
  });
  return { message: "프로필이 성공적으로 음소거되었습니다" };
}

/** Unmutes a profile (commung's unmuteProfile). */
export async function unmute(ctx: MutationCtx, args: unknown) {
  const { moderatorId, profile } = await moderate(ctx, args);
  if (profile.muted_at === null)
    invalid(ctx, "프로필이 음소거되지 않았습니다", "not_muted");
  await ctx.sql`
    UPDATE profiles SET muted_at = NULL, muted_by_id = NULL, updated_at = ${ctx.now}
    WHERE id = ${profile.id}`;
  await logModeration(ctx, {
    action: "unmute_profile",
    description: `@${profile.username}의 프로필 음소거를 해제했습니다`,
    moderator: moderatorId,
    target_profile_id: profile.id,
  });
  return { message: "프로필 음소거가 성공적으로 해제되었습니다" };
}
