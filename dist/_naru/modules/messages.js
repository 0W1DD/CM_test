// What the messages and group chat calls share: profiles as messages show
// them, reactions and images by message, blocks, and group chat checks.
import { denied, invalid, iso, list, notFound, text, } from "./core.js";
import { imageJson } from "./images.js";
import { PROFILE_PICTURE_JOIN } from "./profiles.js";
/** Delete-for-all is allowed this long after sending (commung's window). */
export const DELETE_FOR_ALL_WINDOW_MS = 2 * 60 * 1000;
const BRIEF_COLUMNS = "p.id, p.name, p.username, pic.url AS profile_picture_url";
const briefOf = (row) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    profile_picture_url: row.profile_picture_url ?? null,
});
/** Profiles by ID (deleted ones too, for old messages), as `Brief`s. */
export async function briefsById(ctx, ids) {
    const wanted = [...new Set(ids.filter((v) => typeof v === "string"))];
    if (!wanted.length)
        return new Map();
    const { rows } = await ctx.sql(`SELECT ${BRIEF_COLUMNS} FROM profiles p ${PROFILE_PICTURE_JOIN}
     WHERE p.id IN (SELECT value FROM json_each(?))`, [list(wanted)]);
    return new Map(rows.map((row) => [row.id, briefOf(row)]));
}
export async function briefOfProfile(ctx, profileId) {
    const brief = (await briefsById(ctx, [profileId])).get(profileId);
    if (!brief)
        notFound(ctx, "프로필을 찾을 수 없습니다.");
    return brief;
}
/**
 * Each message's reactions grouped by emoji, in the order they were first
 * given (commung's aggregation). `table` is the reactions table.
 */
export async function reactionsByMessage(ctx, table, messageIds) {
    const out = new Map();
    if (!messageIds.length)
        return out;
    const { rows } = await ctx.sql(`SELECT r.message_id, r.emoji, ${BRIEF_COLUMNS} FROM ${table} r
     JOIN profiles p ON p.id = r.profile_id ${PROFILE_PICTURE_JOIN}
     WHERE r.message_id IN (SELECT value FROM json_each(?))
     ORDER BY r.created_at, r.rowid`, [list(messageIds)]);
    for (const row of rows) {
        const messageId = row.message_id;
        const groups = out.get(messageId) ?? [];
        out.set(messageId, groups);
        const emoji = row.emoji;
        let group = groups.find((g) => g.emoji === emoji);
        if (!group) {
            group = { emoji, count: 0, profiles: [] };
            groups.push(group);
        }
        group.count++;
        group.profiles.push(briefOf(row));
    }
    return out;
}
/** Each message's images, in the order they were attached. */
export async function imagesByMessage(ctx, table, messageIds) {
    const out = new Map();
    if (!messageIds.length)
        return out;
    const { rows } = await ctx.sql(`SELECT m.message_id, i.* FROM ${table} m JOIN images i ON i.id = m.image_id
     WHERE m.message_id IN (SELECT value FROM json_each(?))
     ORDER BY m.position`, [list(messageIds)]);
    for (const row of rows) {
        const images = out.get(row.message_id) ?? [];
        images.push(imageJson(row));
        out.set(row.message_id, images);
    }
    return out;
}
/** Attaches `images` (checked with ownImages) to a new message. */
export async function attachImages(ctx, table, messageId, images) {
    if (!images.length)
        return;
    await ctx.sql(`INSERT INTO ${table} (message_id, image_id, position)
     SELECT ?, value, key FROM json_each(?)`, [messageId, list(images.map((image) => image.id))]);
}
/** Message content: any string up to 10,000 characters, kept as written. */
export function contentOf(ctx, value) {
    if (value === undefined || value === null)
        return "";
    return text(ctx, value, "메시지 내용", { min: 0, max: 10000, raw: true });
}
/** Images to attach: up to 20 IDs of registered uploads. */
export function imageIdsOf(ctx, value) {
    if (value === null || value === undefined)
        return [];
    if (!Array.isArray(value) ||
        value.length > 20 ||
        value.some((v) => typeof v !== "string" || !v || v.length > 200))
        invalid(ctx, "image_ids 값이 올바르지 않습니다.");
    return [...new Set(value)];
}
/** A reaction's emoji, 1–10 characters (commung's schema). */
export const emojiOf = (ctx, value) => text(ctx, value, "이모지", { max: 10, raw: true });
/** A delete's mode: for_me or for_all. */
export function deleteModeOf(ctx, value) {
    if (value !== "for_me" && value !== "for_all")
        invalid(ctx, "삭제 방식이 올바르지 않습니다.");
    return value;
}
/** Refuses a message with neither text nor images. */
export function requireSomething(ctx, content, imageIds) {
    if (!content.trim() && !imageIds.length)
        invalid(ctx, "메시지 내용 또는 이미지를 제공해야 합니다", "empty_message");
}
/** A push notification's body: the text, or commung's line for a photo. */
export const pushBody = (content) => (content.trim() || "사진을 보냈습니다").slice(0, 500);
/** At most `max` characters, for ctx.notify's title. */
export const clip = (value, max = 100) => value.length > max ? `${value.slice(0, max - 1)}…` : value;
/**
 * Whether `member` blocked, or was blocked by, a member who owns or was
 * shared any of `profileIds`.
 */
export async function blockedWith(ctx, member, profileIds) {
    if (!profileIds.length)
        return false;
    const { rows } = await ctx.sql `
    SELECT 1 FROM profile_owners o JOIN member_blocks b
      ON (b.blocker = ${member} AND b.blocked = o.member)
      OR (b.blocker = o.member AND b.blocked = ${member})
    WHERE o.profile_id IN (SELECT value FROM json_each(${list(profileIds)}))
    LIMIT 1`;
    return rows.length > 0;
}
/** A live group chat; refuses a missing or deleted one. */
export async function groupChatOf(ctx, groupChatId) {
    const { rows } = await ctx.sql `
    SELECT id, name, created_by_id, created_at, updated_at FROM group_chats
    WHERE id = ${groupChatId} AND deleted_at IS NULL`;
    if (!rows[0])
        notFound(ctx, "그룹 채팅을 찾을 수 없습니다");
    return rows[0];
}
/** The profile's membership of the chat; refuses a profile not in it. */
export async function requireGroupMember(ctx, groupChatId, profileId) {
    const { rows } = await ctx.sql `
    SELECT group_chat_id, profile_id, last_read_at FROM group_chat_members
    WHERE group_chat_id = ${groupChatId} AND profile_id = ${profileId}`;
    if (!rows[0])
        denied(ctx, "이 그룹 채팅에 대한 접근이 거부되었습니다", "not_group_member");
    return rows[0];
}
/** Members of each chat, as `Brief`s in the order they joined. */
export async function membersByChat(ctx, groupChatIds) {
    const out = new Map();
    if (!groupChatIds.length)
        return out;
    const { rows } = await ctx.sql(`SELECT m.group_chat_id, ${BRIEF_COLUMNS} FROM group_chat_members m
     JOIN profiles p ON p.id = m.profile_id ${PROFILE_PICTURE_JOIN}
     WHERE m.group_chat_id IN (SELECT value FROM json_each(?))
     ORDER BY m.created_at, p.id`, [list(groupChatIds)]);
    for (const row of rows) {
        const chatId = row.group_chat_id;
        const members = out.get(chatId) ?? [];
        members.push(briefOf(row));
        out.set(chatId, members);
    }
    return out;
}
/**
 * Active, undeleted profiles by ID; refuses when any is missing, with
 * `message`.
 */
export async function requireLiveProfiles(ctx, profileIds, message) {
    if (!profileIds.length)
        return;
    const { rows } = await ctx.sql `
    SELECT count(*) AS n FROM profiles
    WHERE id IN (SELECT value FROM json_each(${list(profileIds)}))
      AND deleted_at IS NULL AND activated_at IS NOT NULL`;
    if (rows[0].n !== profileIds.length)
        invalid(ctx, message, "profile_not_found");
}
/** A group chat with its members, as commung's GET /group-chats/:id. */
export async function groupChatDetails(ctx, chat) {
    const members = (await membersByChat(ctx, [chat.id])).get(chat.id) ?? [];
    return {
        id: chat.id,
        name: chat.name,
        created_at: iso(chat.created_at),
        updated_at: iso(chat.updated_at),
        created_by_id: chat.created_by_id,
        members,
        member_count: members.length,
    };
}
