// Achievements as a profile's page and the events page show them: every
// achievement, how far the profile has come, and the tiers it reached.
import { listFor } from "../modules/achievements.js";
import { argsOf, id, notFound } from "../modules/core.js";
/** Anyone's achievements (`profile_id`). */
export async function list(ctx, args) {
    const profileId = id(ctx, argsOf(args).profile_id, "profile_id");
    const { rows } = await ctx.sql `
    SELECT id FROM profiles WHERE id = ${profileId} AND deleted_at IS NULL`;
    if (!rows[0])
        notFound(ctx, "프로필을 찾을 수 없습니다.");
    return listFor(ctx, profileId);
}
