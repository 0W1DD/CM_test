// Achievements: the site calls `check` after the acting profile does
// something, and shows what it newly reached.
import { actingProfile } from "../modules/access.js";
import { check as checkTiers } from "../modules/achievements.js";
import { argsOf, notFound } from "../modules/core.js";
/** Grants the acting profile the tiers it has newly reached. */
export async function check(ctx, args) {
    const profile = await actingProfile(ctx, argsOf(args).profile_id);
    if (profile.activated_at === null)
        notFound(ctx, "프로필을 찾을 수 없습니다.");
    const reached = await checkTiers(ctx, profile.id, profile.membership.member);
    return { reached };
}
