// The use log (item_uses): how a use or a transfer reads to the one looking,
// with the comments under it. A secret entry keeps its item, note, receiver
// and comments from everyone but the profiles in it and the staff.
import { iso, list, msOf } from "./core.js";
import { authorsById } from "./post-data.js";
export async function viewerOf(ctx, member, staff) {
    const { rows } = await ctx.sql `
    SELECT profile_id FROM profile_owners WHERE member = ${member}`;
    return { staff, ownProfiles: new Set(rows.map((row) => row.profile_id)) };
}
/** Whether `viewer` sees `row` only as a secret. */
export function hiddenFrom(row, viewer) {
    return (row.secret === 1 &&
        !viewer.staff &&
        !viewer.ownProfiles.has(row.profile_id) &&
        !(row.target_profile_id && viewer.ownProfiles.has(row.target_profile_id)));
}
export async function useJson(ctx, rows, viewer) {
    const visibleIds = rows
        .filter((row) => !hiddenFrom(row, viewer))
        .map((row) => row.id);
    const { rows: comments } = visibleIds.length
        ? await ctx.sql `SELECT * FROM item_use_comments
         WHERE use_id IN (SELECT value FROM json_each(${list(visibleIds)}))
         ORDER BY id`
        : { rows: [] };
    const profiles = await authorsById(ctx, [
        ...rows.map((row) => row.profile_id),
        ...rows.flatMap((row) => row.target_profile_id ?? []),
        ...comments.map((comment) => comment.profile_id),
    ]);
    return rows.map((row) => {
        const hidden = hiddenFrom(row, viewer);
        return {
            id: row.id,
            kind: row.kind === "transfer" ? "transfer" : "use",
            profile: profiles.get(row.profile_id) ?? null,
            target: hidden || !row.target_profile_id
                ? null
                : (profiles.get(row.target_profile_id) ?? null),
            item_name: hidden ? null : row.item_name,
            qty: row.qty,
            note: hidden ? null : row.note,
            secret: row.secret === 1,
            hidden,
            consumed: row.consumed === 1,
            status: row.approved_at === null ? "pending" : "approved",
            approved_at: iso(row.approved_at),
            created_at: iso(row.created_at),
            comments: hidden
                ? []
                : comments
                    .filter((comment) => comment.use_id === row.id)
                    .map((comment) => ({
                    id: comment.id,
                    profile: profiles.get(comment.profile_id) ?? null,
                    content: comment.content,
                    created_at: iso(comment.created_at),
                })),
        };
    });
}
/**
 * The entries a use log clean-up takes, as a WHERE clause and its values:
 * written before `before` (all until now when absent) and from `after`,
 * only confirmed or waiting ones by `status` ("approved", "pending"), and
 * only those a profile wrote or received by `username`.
 */
export function usesPurgeWhere(ctx, a) {
    const before = msOf(ctx, a.before, "before") ?? ctx.now + 1;
    const after = msOf(ctx, a.after, "after");
    const conditions = ["created_at < ?"];
    const values = [before];
    if (after !== null) {
        conditions.push("created_at >= ?");
        values.push(after);
    }
    if (a.status === "approved")
        conditions.push("approved_at IS NOT NULL");
    else if (a.status === "pending")
        conditions.push("approved_at IS NULL");
    const username = typeof a.username === "string" ? a.username.trim().replace(/^@/, "") : "";
    if (username) {
        const profile = "SELECT id FROM profiles WHERE lower(username) = lower(?)";
        conditions.push(`(profile_id IN (${profile}) OR target_profile_id IN (${profile}))`);
        values.push(username, username);
    }
    return { where: conditions.join(" AND "), values };
}
