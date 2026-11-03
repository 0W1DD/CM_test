// Badges as everyone sees them (the featured one by each name, and a
// profile's own), and as the staff manage them (mutations/badges.ts).
import { requireStaff } from "../modules/access.js";
import { argsOf, id } from "../modules/core.js";
/** Every profile's featured badge, by profile ID (small: one per profile). */
export async function featured(ctx) {
    const { rows } = await ctx.sql `
    SELECT pb.profile_id, b.id, b.name, b.emoji, b.description
    FROM profile_badges pb JOIN badges b ON b.id = pb.badge_id
    WHERE pb.featured = 1`;
    const out = {};
    for (const { profile_id, ...badge } of rows)
        out[profile_id] = badge;
    return out;
}
/** The badges a profile has, the featured one marked. */
export async function ofProfile(ctx, args) {
    const profileId = id(ctx, argsOf(args).profile_id, "profile_id");
    const { rows } = await ctx.sql `
    SELECT b.id, b.name, b.emoji, b.description, pb.featured
    FROM profile_badges pb JOIN badges b ON b.id = pb.badge_id
    WHERE pb.profile_id = ${profileId}
    ORDER BY b.created_at, b.name`;
    return rows.map((r) => ({ ...r, featured: r.featured === 1 }));
}
/** For the staff: every badge, and every active profile with its badges. */
export async function admin(ctx) {
    await requireStaff(ctx);
    const badges = await ctx.sql `
    SELECT b.id, b.name, b.emoji, b.description,
      (SELECT count(*) FROM profile_badges pb WHERE pb.badge_id = b.id) AS holders
    FROM badges b ORDER BY b.created_at, b.name`;
    const profiles = await ctx.sql `
    SELECT p.id, p.name, p.username,
      (SELECT json_group_array(pb.badge_id) FROM profile_badges pb
       WHERE pb.profile_id = p.id) AS badge_ids
    FROM profiles p
    WHERE p.deleted_at IS NULL AND p.activated_at IS NOT NULL
    ORDER BY p.name`;
    return {
        badges: badges.rows,
        profiles: profiles.rows.map(({ badge_ids, ...p }) => ({
            ...p,
            badge_ids: JSON.parse(badge_ids),
        })),
    };
}
