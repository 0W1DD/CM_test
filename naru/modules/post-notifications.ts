// Whose notifications a call reads or marks: a profile the calling member
// owns or was shared (commung's canUseProfile; membership is not required).
import { memberId } from "./access.js";
import { type Ctx, denied, id, notFound } from "./core.js";

export async function recipientProfile(ctx: Ctx, profileId: unknown) {
  const member = memberId(ctx);
  const pid = id(ctx, profileId, "profile_id");
  const { rows } = await ctx.sql<{ id: string; deleted_at: number | null }>`
    SELECT p.id, p.deleted_at FROM profile_owners o
    JOIN profiles p ON p.id = o.profile_id
    WHERE o.profile_id = ${pid} AND o.member = ${member}`;
  const profile = rows[0];
  if (!profile)
    denied(ctx, "프로필에 접근할 권한이 없습니다", "not_profile_owner");
  if (profile.deleted_at !== null) notFound(ctx, "프로필을 찾을 수 없습니다");
  return profile.id;
}
