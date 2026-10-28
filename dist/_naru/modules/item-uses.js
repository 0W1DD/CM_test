// The use log (item_uses): how a use reads to the one looking. A secret use
// keeps its item and note from everyone but its owner and the staff.
import { iso } from "./core.js";
import { authorsById } from "./post-data.js";
export async function viewerOf(ctx, member, staff) {
    const { rows } = await ctx.sql `
    SELECT profile_id FROM profile_owners WHERE member = ${member}`;
    return { staff, ownProfiles: new Set(rows.map((row) => row.profile_id)) };
}
export async function useJson(ctx, rows, viewer) {
    const profiles = await authorsById(ctx, rows.map((row) => row.profile_id));
    return rows.map((row) => {
        const hidden = row.secret === 1 &&
            !viewer.staff &&
            !viewer.ownProfiles.has(row.profile_id);
        return {
            id: row.id,
            profile: profiles.get(row.profile_id) ?? null,
            item_name: hidden ? null : row.item_name,
            note: hidden ? null : row.note,
            secret: row.secret === 1,
            hidden,
            consumed: row.consumed === 1,
            status: row.approved_at === null ? "pending" : "approved",
            approved_at: iso(row.approved_at),
            created_at: iso(row.created_at),
        };
    });
}
