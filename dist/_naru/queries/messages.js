// Direct messages: commung's GET /app/conversations, /conversations/:id
// and /messages/unread-count. Pages keep them current with subscribe().
import { actingProfile } from "../modules/access.js";
import { argsOf, id, iso, limitOf, list, notFound, optionalId, } from "../modules/core.js";
import { briefsById, imagesByMessage, reactionsByMessage, } from "../modules/messages.js";
import { PROFILE_COLUMNS, PROFILE_PICTURE_JOIN, profileJson, } from "../modules/profiles.js";
/** Not deleted for everyone, nor by `?` (the viewing profile) for itself. */
const VISIBLE = `d.deleted_at IS NULL AND NOT EXISTS (
  SELECT 1 FROM direct_message_deletions x
  WHERE x.message_id = d.id AND x.profile_id = ?)`;
/**
 * How many messages the profile has not read ({ count }): direct messages
 * and, so the menu badge shows them too, group chat messages from others
 * since the profile last read each chat.
 */
export async function unreadCount(ctx, args) {
    const profile = await actingProfile(ctx, argsOf(args).profile_id);
    const { rows } = await ctx.sql(`SELECT
       (SELECT count(*) FROM direct_messages d
        WHERE d.receiver_id = ? AND d.read_at IS NULL AND ${VISIBLE})
     + (SELECT count(*) FROM group_chat_members m
        JOIN group_chats gc ON gc.id = m.group_chat_id AND gc.deleted_at IS NULL
        JOIN group_chat_messages x ON x.group_chat_id = m.group_chat_id
        WHERE m.profile_id = ? AND x.deleted_at IS NULL
          AND x.created_at > coalesce(m.last_read_at, -1)
          AND x.sender_id != m.profile_id) AS count`, [profile.id, profile.id, profile.id]);
    return { count: rows[0]?.count ?? 0 };
}
/**
 * The profile's conversations, latest first: each other profile with the
 * last message and how many of theirs are unread (from the latest 100
 * messages, as commung did).
 */
export async function conversations(ctx, args) {
    const a = argsOf(args);
    const profile = await actingProfile(ctx, a.profile_id);
    const limit = limitOf(a.limit, 20, 100);
    const latest = (side) => `SELECT * FROM (SELECT d.id, d.content, d.sender_id, d.receiver_id, d.read_at, d.created_at
     FROM direct_messages d WHERE d.${side} = ? AND ${VISIBLE}
     ORDER BY d.created_at DESC, d.id DESC LIMIT 100)`;
    const { rows: messages } = await ctx.sql(`${latest("sender_id")} UNION ALL ${latest("receiver_id")}
     ORDER BY created_at DESC, id DESC LIMIT 100`, [profile.id, profile.id, profile.id, profile.id]);
    const lastByOther = new Map();
    for (const message of messages) {
        const other = message.sender_id === profile.id
            ? message.receiver_id
            : message.sender_id;
        if (!lastByOther.has(other))
            lastByOther.set(other, message);
    }
    const others = [...lastByOther.keys()].slice(0, limit);
    if (!others.length)
        return [];
    const profiles = await briefsById(ctx, others);
    const { rows: unread } = await ctx.sql(`SELECT d.sender_id, count(*) AS n FROM direct_messages d
     WHERE d.receiver_id = ? AND d.read_at IS NULL
       AND d.sender_id IN (SELECT value FROM json_each(?)) AND ${VISIBLE}
     GROUP BY d.sender_id`, [profile.id, list(others), profile.id]);
    const unreadBy = new Map(unread.map((row) => [row.sender_id, row.n]));
    return others.flatMap((other) => {
        const otherProfile = profiles.get(other);
        const last = lastByOther.get(other);
        if (!otherProfile || !last)
            return [];
        return [
            {
                other_profile: otherProfile,
                last_message: {
                    id: last.id,
                    content: last.content,
                    created_at: iso(last.created_at),
                    is_sender: last.sender_id === profile.id,
                },
                unread_count: String(unreadBy.get(other) ?? 0),
            },
        ];
    });
}
/**
 * A conversation's messages, a page of `limit` (default 50) before
 * `cursor`, oldest first, with the other profile (by `other_profile_id` or
 * `username`): { other_profile, messages, pagination }.
 */
export async function conversation(ctx, args) {
    const a = argsOf(args);
    const profile = await actingProfile(ctx, a.profile_id);
    const limit = limitOf(a.limit, 50, 100);
    const cursor = optionalId(ctx, a.cursor, "cursor");
    const { rows: others } = typeof a.username === "string" && a.other_profile_id === undefined
        ? await ctx.sql(`SELECT ${PROFILE_COLUMNS} FROM profiles p ${PROFILE_PICTURE_JOIN}
           WHERE lower(p.username) = lower(?) AND p.deleted_at IS NULL`, [a.username])
        : await ctx.sql(`SELECT ${PROFILE_COLUMNS} FROM profiles p ${PROFILE_PICTURE_JOIN}
           WHERE p.id = ? AND p.deleted_at IS NULL`, [id(ctx, a.other_profile_id, "other_profile_id")]);
    const other = others[0];
    if (!other)
        notFound(ctx, "다른 프로필을 찾을 수 없습니다");
    const page = (from, to) => {
        const values = [from, to, profile.id];
        let before = "";
        if (cursor) {
            before = `AND (d.created_at, d.id) < (SELECT created_at, id FROM direct_messages WHERE id = ?)`;
            values.push(cursor);
        }
        return {
            text: `SELECT * FROM (SELECT d.id, d.content, d.sender_id, d.receiver_id, d.read_at, d.created_at
        FROM direct_messages d WHERE d.sender_id = ? AND d.receiver_id = ? AND ${VISIBLE} ${before}
        ORDER BY d.created_at DESC, d.id DESC LIMIT ${limit + 1})`,
            values,
        };
    };
    const mine = page(profile.id, other.id);
    const theirs = page(other.id, profile.id);
    const { rows: fetched } = await ctx.sql(`${mine.text} UNION ALL ${theirs.text}
     ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}`, [...mine.values, ...theirs.values]);
    const { rows: total } = await ctx.sql(`SELECT count(*) AS n FROM direct_messages d
     WHERE ((d.sender_id = ? AND d.receiver_id = ?) OR (d.sender_id = ? AND d.receiver_id = ?))
       AND ${VISIBLE}`, [profile.id, other.id, other.id, profile.id, profile.id]);
    const hasMore = fetched.length > limit;
    const rows = hasMore ? fetched.slice(0, limit) : fetched;
    const ids = rows.map((row) => row.id);
    const briefs = await briefsById(ctx, [profile.id, other.id]);
    const reactions = await reactionsByMessage(ctx, "direct_message_reactions", ids);
    const images = await imagesByMessage(ctx, "direct_message_images", ids);
    const messages = rows.map((row) => ({
        id: row.id,
        content: row.content,
        created_at: iso(row.created_at),
        read_at: iso(row.read_at),
        sender: briefs.get(row.sender_id),
        receiver: briefs.get(row.receiver_id),
        is_sender: row.sender_id === profile.id,
        reactions: reactions.get(row.id) ?? [],
        images: images.get(row.id) ?? [],
    }));
    return {
        other_profile: profileJson(other),
        messages: messages.reverse(),
        pagination: {
            next_cursor: hasMore ? (rows[rows.length - 1]?.id ?? null) : null,
            has_more: hasMore,
            total_count: total[0]?.n ?? 0,
        },
    };
}
