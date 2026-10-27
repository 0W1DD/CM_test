// A profile's notifications: commung's GET /app/notifications and
// /notifications/unread-count.
import { argsOf, iso, limitOf, list as jsonList, } from "../modules/core.js";
import { recipientProfile } from "../modules/post-notifications.js";
import { authorsById } from "../modules/post-data.js";
/**
 * The profile's notifications, newest first, with who sent each and the
 * post it is about; those whose sender or post was deleted are left out.
 */
export async function list(ctx, args) {
    const a = argsOf(args);
    const profileId = await recipientProfile(ctx, a.profile_id);
    const limit = limitOf(a.limit);
    const cursor = typeof a.cursor === "string" && a.cursor ? a.cursor : null;
    // `filter`: "conversation" (replies and mentions) or "reaction"; all when
    // absent, so a burst of reactions does not bury the replies.
    const types = a.filter === "conversation"
        ? ["reply", "mention"]
        : a.filter === "reaction"
            ? ["reaction"]
            : null;
    const typeWhere = types
        ? " AND type IN (SELECT value FROM json_each(?))"
        : "";
    const base = [profileId, ...(types ? [jsonList(types)] : [])];
    const values = [...base];
    if (cursor)
        values.push(cursor);
    values.push(limit + 1);
    const { rows: read } = await ctx.sql(`SELECT id, type, message, profile_id, post_id, read_at, created_at
     FROM notifications WHERE recipient_id = ?${typeWhere} ${cursor ? "AND id < ?" : ""}
     ORDER BY id DESC LIMIT ?`, values);
    const { rows: counts } = await ctx.sql(`SELECT count(*) AS n FROM notifications WHERE recipient_id = ?${typeWhere}`, base);
    const hasMore = read.length > limit;
    const rows = read.slice(0, limit);
    const postIds = [...new Set(rows.flatMap((row) => row.post_id ?? []))];
    const { rows: posts } = postIds.length
        ? await ctx.sql `SELECT id, content, author_id, deleted_at FROM posts
         WHERE id IN (SELECT value FROM json_each(${jsonList(postIds)}))`
        : { rows: [] };
    const postsById = new Map(posts.map((post) => [post.id, post]));
    const senderIds = rows.map((row) => row.profile_id);
    const { rows: deleted } = await ctx.sql `
    SELECT id FROM profiles
    WHERE id IN (SELECT value FROM json_each(${jsonList([...new Set(senderIds)])}))
      AND deleted_at IS NOT NULL`;
    const deletedSenders = new Set(deleted.map((row) => row.id));
    const profiles = await authorsById(ctx, [
        ...senderIds,
        ...posts.map((post) => post.author_id),
    ]);
    const data = rows
        .filter((row) => {
        if (deletedSenders.has(row.profile_id))
            return false;
        const post = row.post_id ? postsById.get(row.post_id) : undefined;
        return !post || post.deleted_at === null;
    })
        .map((row) => {
        const post = row.post_id ? postsById.get(row.post_id) : undefined;
        const author = post ? profiles.get(post.author_id) : undefined;
        return {
            id: row.id,
            type: row.type,
            content: row.message,
            read_at: iso(row.read_at),
            created_at: iso(row.created_at),
            sender: profiles.get(row.profile_id) ?? null,
            related_post: post && author
                ? { id: post.id, content: post.content, author }
                : null,
        };
    });
    return {
        data,
        pagination: {
            next_cursor: hasMore ? (rows[rows.length - 1]?.id ?? null) : null,
            has_more: hasMore,
            total_count: counts[0]?.n ?? 0,
        },
    };
}
/** How many of the profile's notifications are unread; pages subscribe to it. */
export async function unreadCount(ctx, args) {
    const a = argsOf(args);
    const profileId = await recipientProfile(ctx, a.profile_id);
    const { rows } = await ctx.sql `
    SELECT count(*) AS n FROM notifications
    WHERE recipient_id = ${profileId} AND read_at IS NULL`;
    return { count: rows[0]?.n ?? 0 };
}
