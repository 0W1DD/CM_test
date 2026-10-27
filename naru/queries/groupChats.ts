// Group chats: commung's GET /app/group-chats, /group-chats/:id and its
// messages. Pages keep them current with subscribe().
import { actingProfile } from "../modules/access.js";
import {
  argsOf,
  id,
  iso,
  limitOf,
  list as jsonList,
  offsetOf,
  optionalId,
  type QueryCtx,
} from "../modules/core.js";
import {
  briefsById,
  type GroupChatRow,
  groupChatDetails,
  groupChatOf,
  imagesByMessage,
  membersByChat,
  reactionsByMessage,
  requireGroupMember,
} from "../modules/messages.js";

/**
 * The profile's group chats, latest message first, each with its last
 * message, members and how many messages from others it has not read.
 */
export async function list(ctx: QueryCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await actingProfile(ctx, a.profile_id);
  const limit = limitOf(a.limit, 20, 100);
  const offset = offsetOf(a.offset);
  const latest = (
    column: string,
  ) => `(SELECT x.${column} FROM group_chat_messages x
    WHERE x.group_chat_id = gc.id AND x.deleted_at IS NULL
    ORDER BY x.created_at DESC, x.id DESC LIMIT 1)`;
  const { rows: chats } = await ctx.sql<
    GroupChatRow & { last_message_id: string | null; unread_count: number }
  >(
    `SELECT gc.id, gc.name, gc.created_by_id, gc.created_at, gc.updated_at,
       ${latest("id")} AS last_message_id,
       (SELECT count(*) FROM group_chat_messages x
        WHERE x.group_chat_id = gc.id AND x.deleted_at IS NULL
          AND x.created_at > coalesce(m.last_read_at, -1)
          AND x.sender_id != m.profile_id) AS unread_count
     FROM group_chat_members m JOIN group_chats gc ON gc.id = m.group_chat_id
     WHERE m.profile_id = ? AND gc.deleted_at IS NULL
     ORDER BY ${latest("created_at")} DESC NULLS LAST, gc.created_at DESC
     LIMIT ? OFFSET ?`,
    [profile.id, limit, offset],
  );
  if (!chats.length) return [];
  const lastIds = chats.flatMap((chat) =>
    chat.last_message_id ? [chat.last_message_id] : [],
  );
  const { rows: lasts } = lastIds.length
    ? await ctx.sql<{
        id: string;
        content: string;
        sender_id: string;
        created_at: number;
      }>`SELECT id, content, sender_id, created_at FROM group_chat_messages
         WHERE id IN (SELECT value FROM json_each(${jsonList(lastIds)}))`
    : { rows: [] };
  const lastById = new Map(lasts.map((row) => [row.id, row]));
  const members = await membersByChat(
    ctx,
    chats.map((chat) => chat.id),
  );
  const senders = await briefsById(
    ctx,
    lasts.map((row) => row.sender_id),
  );
  return chats.map((chat) => {
    const last = chat.last_message_id
      ? lastById.get(chat.last_message_id)
      : undefined;
    const sender = last ? senders.get(last.sender_id) : undefined;
    const chatMembers = members.get(chat.id) ?? [];
    return {
      id: chat.id,
      name: chat.name,
      created_at: iso(chat.created_at),
      updated_at: iso(chat.updated_at),
      created_by_id: chat.created_by_id,
      last_message:
        last && sender
          ? {
              id: last.id,
              content: last.content,
              created_at: iso(last.created_at),
              sender,
              is_sender: sender.id === profile.id,
            }
          : null,
      members: chatMembers,
      member_count: chatMembers.length,
      unread_count: chat.unread_count,
    };
  });
}

/** A group chat the profile is in, with its members. */
export async function get(ctx: QueryCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await actingProfile(ctx, a.profile_id);
  const groupChatId = id(ctx, a.group_chat_id, "group_chat_id");
  await requireGroupMember(ctx, groupChatId, profile.id);
  return groupChatDetails(ctx, await groupChatOf(ctx, groupChatId));
}

/**
 * A page of the chat's messages, `limit` (default 50) before `cursor`,
 * oldest first: { messages, pagination }.
 */
export async function messages(ctx: QueryCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await actingProfile(ctx, a.profile_id);
  const groupChatId = id(ctx, a.group_chat_id, "group_chat_id");
  const limit = limitOf(a.limit, 50, 100);
  const cursor = optionalId(ctx, a.cursor, "cursor");
  await groupChatOf(ctx, groupChatId);
  await requireGroupMember(ctx, groupChatId, profile.id);
  const values: string[] = [groupChatId, profile.id];
  let before = "";
  if (cursor) {
    before = `AND (g.created_at, g.id) < (SELECT created_at, id FROM group_chat_messages WHERE id = ?)`;
    values.push(cursor);
  }
  const { rows: fetched } = await ctx.sql<{
    id: string;
    content: string;
    sender_id: string;
    created_at: number;
  }>(
    `SELECT g.id, g.content, g.sender_id, g.created_at FROM group_chat_messages g
     WHERE g.group_chat_id = ? AND g.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM group_chat_message_deletions x
                       WHERE x.message_id = g.id AND x.profile_id = ?)
       ${before}
     ORDER BY g.created_at DESC, g.id DESC LIMIT ${limit + 1}`,
    values,
  );
  const hasMore = fetched.length > limit;
  const rows = hasMore ? fetched.slice(0, limit) : fetched;
  const ids = rows.map((row) => row.id);
  const senders = await briefsById(
    ctx,
    rows.map((row) => row.sender_id),
  );
  const reactions = await reactionsByMessage(
    ctx,
    "group_chat_message_reactions",
    ids,
  );
  const images = await imagesByMessage(ctx, "group_chat_message_images", ids);
  const out = rows.map((row) => ({
    id: row.id,
    content: row.content,
    created_at: iso(row.created_at),
    sender: senders.get(row.sender_id),
    is_sender: row.sender_id === profile.id,
    reactions: reactions.get(row.id) ?? [],
    images: images.get(row.id) ?? [],
  }));
  return {
    messages: out.reverse(),
    pagination: {
      next_cursor: hasMore ? (rows[rows.length - 1]?.id ?? null) : null,
      has_more: hasMore,
    },
  };
}
