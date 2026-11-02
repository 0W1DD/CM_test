// The moderation log, newest first, for the owner and moderators; and, for
// the owner, the direct message conversations and who read them.
import { requireOwner, requireStaff } from "../modules/access.js";
import { argsOf, iso, limitOf, offsetOf, } from "../modules/core.js";
import { briefsById } from "../modules/messages.js";
import { profilesById } from "../modules/profiles.js";
/** Log entries, `limit` (50) from `offset`, with the profiles they name. */
export async function log(ctx, args) {
    await requireStaff(ctx);
    const a = argsOf(args);
    const { rows } = await ctx.sql `
    SELECT id, action, description, moderator, target_profile_id,
      target_post_id, created_at
    FROM moderation_log ORDER BY created_at DESC, rowid DESC
    LIMIT ${limitOf(a.limit, 50, 100)} OFFSET ${offsetOf(a.offset)}`;
    const profiles = await profilesById(ctx, rows.flatMap((row) => [row.moderator, row.target_profile_id]));
    return rows.map((row) => ({
        id: row.id,
        action: row.action,
        description: row.description,
        moderator: profiles.get(row.moderator) ?? null,
        target_profile: row.target_profile_id
            ? (profiles.get(row.target_profile_id) ?? null)
            : null,
        target_post_id: row.target_post_id,
        created_at: iso(row.created_at),
    }));
}
/**
 * Every two profiles who wrote each other direct messages (the owner only),
 * latest first, `limit` (30) from `offset`: who, how many messages, and
 * when the last was sent. Not what was said: reading a conversation is
 * moderation:readMessages, which logs it. `username` keeps to the
 * conversations one profile is in.
 */
export async function messagePairs(ctx, args) {
    await requireOwner(ctx);
    const a = argsOf(args);
    const limit = limitOf(a.limit, 30, 100);
    const username = typeof a.username === "string" ? a.username.trim().replace(/^@/, "") : "";
    const values = [];
    let only = "";
    if (username) {
        const profile = "SELECT id FROM profiles WHERE lower(username) = lower(?)";
        only = `HAVING profile_a IN (${profile}) OR profile_b IN (${profile})`;
        values.push(username, username);
    }
    const { rows } = await ctx.sql(`SELECT min(sender_id, receiver_id) AS profile_a,
       max(sender_id, receiver_id) AS profile_b,
       count(*) AS n, max(created_at) AS last_at
     FROM direct_messages WHERE deleted_at IS NULL
     GROUP BY profile_a, profile_b ${only}
     ORDER BY last_at DESC LIMIT ? OFFSET ?`, [...values, limit + 1, offsetOf(a.offset)]);
    const page = rows.slice(0, limit);
    const profiles = await briefsById(ctx, page.flatMap((row) => [row.profile_a, row.profile_b]));
    return {
        data: page.map((row) => ({
            profile_a: profiles.get(row.profile_a) ?? null,
            profile_b: profiles.get(row.profile_b) ?? null,
            message_count: row.n,
            last_message_at: iso(row.last_at),
        })),
        has_more: rows.length > limit,
    };
}
/** Who opened whose direct messages and when (the owner only), newest first. */
export async function messageViews(ctx, args) {
    await requireOwner(ctx);
    const a = argsOf(args);
    const { rows } = await ctx.sql `
    SELECT id, viewer_profile_id, profile_a, profile_b, created_at
    FROM message_views ORDER BY created_at DESC, id DESC
    LIMIT ${limitOf(a.limit, 50, 100)} OFFSET ${offsetOf(a.offset)}`;
    const profiles = await briefsById(ctx, rows.flatMap((row) => [
        row.viewer_profile_id,
        row.profile_a,
        row.profile_b,
    ]));
    return rows.map((row) => ({
        id: row.id,
        viewer: profiles.get(row.viewer_profile_id) ?? null,
        profile_a: profiles.get(row.profile_a) ?? null,
        profile_b: profiles.get(row.profile_b) ?? null,
        created_at: iso(row.created_at),
    }));
}
/**
 * Post reports, newest first, `limit` (50) from `offset`: the reason, who
 * reported, and the post with its author (for its address,
 * `/@<author username>/<post id>`).
 */
export async function reports(ctx, args) {
    await requireStaff(ctx);
    const a = argsOf(args);
    const { rows } = await ctx.sql `
    SELECT r.id, r.post_id, r.reason, r.reporter_profile_id, r.created_at,
      p.author_id, substr(p.content, 1, 200) AS content,
      p.deleted_at AS post_deleted_at
    FROM post_reports r LEFT JOIN posts p ON p.id = r.post_id
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ${limitOf(a.limit, 50, 100)} OFFSET ${offsetOf(a.offset)}`;
    const profiles = await profilesById(ctx, rows.flatMap((row) => [row.reporter_profile_id, row.author_id]));
    return rows.map((row) => ({
        id: row.id,
        reason: row.reason,
        created_at: iso(row.created_at),
        reporter: profiles.get(row.reporter_profile_id) ?? null,
        post: {
            id: row.post_id,
            content: row.content,
            deleted: row.post_deleted_at !== null,
            author: row.author_id ? (profiles.get(row.author_id) ?? null) : null,
        },
    }));
}
