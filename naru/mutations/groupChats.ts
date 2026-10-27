// Group chats: commung's POST/PATCH /app/group-chats, its messages,
// reactions and read state, and members joining and leaving.
import { actingProfile, membersOfProfiles } from "../modules/access.js";
import {
  argsOf,
  denied,
  id,
  ids,
  invalid,
  iso,
  list,
  type MutationCtx,
  notFound,
  text,
  uuidv7,
} from "../modules/core.js";
import { imageJson, ownImages } from "../modules/images.js";
import {
  attachImages,
  blockedWith,
  briefOfProfile,
  clip,
  contentOf,
  DELETE_FOR_ALL_WINDOW_MS,
  deleteModeOf,
  emojiOf,
  imageIdsOf,
  groupChatDetails,
  groupChatOf,
  pushBody,
  requireGroupMember,
  requireLiveProfiles,
  requireSomething,
} from "../modules/messages.js";

const nameOf = (ctx: MutationCtx, value: unknown) =>
  text(ctx, value, "그룹 이름", { max: 100 });

/** Refuses inviting profiles whose members blocked, or were blocked by, the caller. */
async function requireNotBlocked(
  ctx: MutationCtx,
  member: string,
  profileIds: readonly string[],
) {
  if (await blockedWith(ctx, member, profileIds))
    denied(
      ctx,
      "차단한 사용자 또는 나를 차단한 사용자는 그룹 채팅에 초대할 수 없습니다",
      "blocked",
    );
}

/** The chat the profile is in, for a call acting as it. */
async function memberChat(ctx: MutationCtx, a: Record<string, unknown>) {
  const profile = await actingProfile(ctx, a.profile_id);
  const groupChatId = id(ctx, a.group_chat_id, "group_chat_id");
  const chat = await groupChatOf(ctx, groupChatId);
  await requireGroupMember(ctx, groupChatId, profile.id);
  return { profile, chat };
}

/**
 * Starts a group chat named `name` of `creator_profile_id` and
 * `member_profile_ids` (at least two others).
 */
export async function create(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const creator = await actingProfile(ctx, a.creator_profile_id);
  const name = nameOf(ctx, a.name);
  const memberIds = ids(ctx, a.member_profile_ids, "member_profile_ids", 99);
  if (memberIds.length < 2)
    invalid(ctx, "생성자를 포함해 3명 이상이어야 합니다", "too_few_members");
  await requireLiveProfiles(
    ctx,
    memberIds,
    "한 명 이상의 멤버 프로필을 찾을 수 없습니다",
  );
  const others = memberIds.filter((member) => member !== creator.id);
  await requireNotBlocked(ctx, creator.membership.member, others);

  const groupChatId = uuidv7(ctx.now);
  await ctx.sql`
    INSERT INTO group_chats (id, name, created_by_id, created_at, updated_at)
    VALUES (${groupChatId}, ${name}, ${creator.id}, ${ctx.now}, ${ctx.now})`;
  await ctx.sql`
    INSERT INTO group_chat_members (group_chat_id, profile_id, added_by_id, created_at)
    SELECT ${groupChatId}, value, ${creator.id}, ${ctx.now}
    FROM json_each(${list([creator.id, ...others])})`;
  return {
    id: groupChatId,
    name,
    created_at: iso(ctx.now),
    updated_at: iso(ctx.now),
    created_by_id: creator.id,
    member_count: others.length + 1,
    unread_count: 0,
  };
}

/** Renames the chat (any member may, as in commung). */
export async function update(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const name = nameOf(ctx, a.name);
  const { chat } = await memberChat(ctx, a);
  await ctx.sql`UPDATE group_chats SET name = ${name}, updated_at = ${ctx.now}
    WHERE id = ${chat.id}`;
  return { id: chat.id, name };
}

/** Sends `content` and `image_ids` to the chat, notifying the other members. */
export async function send(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const { profile, chat } = await memberChat(ctx, a);
  const content = contentOf(ctx, a.content);
  const imageIds = imageIdsOf(ctx, a.image_ids);
  requireSomething(ctx, content, imageIds);
  const images = await ownImages(ctx, imageIds);

  const messageId = uuidv7(ctx.now);
  await ctx.sql`
    INSERT INTO group_chat_messages (id, group_chat_id, sender_id, created_by, content, created_at, updated_at)
    VALUES (${messageId}, ${chat.id}, ${profile.id}, ${profile.membership.member}, ${content}, ${ctx.now}, ${ctx.now})`;
  await attachImages(ctx, "group_chat_message_images", messageId, images);

  const { rows: memberRows } = await ctx.sql<{ profile_id: string }>`
    SELECT profile_id FROM group_chat_members
    WHERE group_chat_id = ${chat.id} AND profile_id != ${profile.id}`;
  const senderMembers = new Set(await membersOfProfiles(ctx, [profile.id]));
  senderMembers.add(profile.membership.member);
  const recipients = (
    await membersOfProfiles(
      ctx,
      memberRows.map((row) => row.profile_id),
    )
  ).filter((member) => !senderMembers.has(member));
  if (recipients.length)
    await ctx.notify(recipients, {
      title: clip(`${profile.name} - ${chat.name || "그룹 채팅"}`),
      body: pushBody(content),
      path: `/group-chats/${chat.id}`,
    });

  return {
    id: messageId,
    content,
    created_at: iso(ctx.now),
    sender: await briefOfProfile(ctx, profile.id),
    is_sender: true,
    images: images.map(imageJson),
  };
}

interface GroupMessageRow {
  id: string;
  sender_id: string;
  created_at: number;
}

/** A live message of the chat; refuses any other. */
async function chatMessage(
  ctx: MutationCtx,
  groupChatId: string,
  messageId: unknown,
): Promise<GroupMessageRow> {
  const { rows } = await ctx.sql<GroupMessageRow>`
    SELECT id, sender_id, created_at FROM group_chat_messages
    WHERE id = ${id(ctx, messageId, "message_id")}
      AND group_chat_id = ${groupChatId} AND deleted_at IS NULL`;
  if (!rows[0]) notFound(ctx, "메시지를 찾을 수 없습니다");
  return rows[0];
}

export async function addReaction(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const emoji = emojiOf(ctx, a.emoji);
  const { profile, chat } = await memberChat(ctx, a);
  const message = await chatMessage(ctx, chat.id, a.message_id);
  const reactionId = uuidv7(ctx.now);
  const { changes } = await ctx.sql`
    INSERT INTO group_chat_message_reactions (id, message_id, profile_id, emoji, created_at)
    VALUES (${reactionId}, ${message.id}, ${profile.id}, ${emoji}, ${ctx.now})
    ON CONFLICT DO NOTHING`;
  if (!changes) invalid(ctx, "반응이 이미 존재합니다", "already_reacted");
  return { id: reactionId, message: "반응이 성공적으로 추가되었습니다", emoji };
}

export async function removeReaction(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const emoji = emojiOf(ctx, a.emoji);
  const { profile, chat } = await memberChat(ctx, a);
  const message = await chatMessage(ctx, chat.id, a.message_id);
  const { changes } = await ctx.sql`
    DELETE FROM group_chat_message_reactions
    WHERE message_id = ${message.id} AND profile_id = ${profile.id} AND emoji = ${emoji}`;
  if (!changes) notFound(ctx, "반응을 찾을 수 없습니다");
  return { message_id: message.id, emoji, deleted: true };
}

/**
 * Deletes a message: `for_me` hides it from the profile, `for_all` (its
 * sender, within two minutes) deletes it for everyone.
 */
export async function remove(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const mode = deleteModeOf(ctx, a.mode);
  const { profile, chat } = await memberChat(ctx, a);
  const message = await chatMessage(ctx, chat.id, a.message_id);
  if (mode === "for_all") {
    if (message.sender_id !== profile.id)
      denied(ctx, "자신의 메시지만 모두에게 삭제할 수 있습니다", "not_sender");
    if (ctx.now - message.created_at > DELETE_FOR_ALL_WINDOW_MS)
      denied(
        ctx,
        "메시지 전송 후 2분이 지나면 모두에게 삭제할 수 없습니다",
        "delete_window_passed",
      );
    await ctx.sql`UPDATE group_chat_messages SET deleted_at = ${ctx.now}, updated_at = ${ctx.now}
      WHERE id = ${message.id}`;
  } else {
    await ctx.sql`
      INSERT INTO group_chat_message_deletions (message_id, profile_id, deleted_at)
      VALUES (${message.id}, ${profile.id}, ${ctx.now})
      ON CONFLICT DO NOTHING`;
  }
  return { id: message.id, deleted: true };
}

/**
 * Marks the chat read up to now for the profile: one call when the chat
 * opens or new messages arrive. Writes only when something was unread, so
 * other members' live queries are not run again for nothing.
 */
export async function markRead(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const { profile, chat } = await memberChat(ctx, a);
  await ctx.sql`
    UPDATE group_chat_members SET last_read_at = ${ctx.now}
    WHERE group_chat_id = ${chat.id} AND profile_id = ${profile.id}
      AND EXISTS (SELECT 1 FROM group_chat_messages x
        WHERE x.group_chat_id = ${chat.id} AND x.deleted_at IS NULL
          AND x.sender_id != ${profile.id}
          AND x.created_at > coalesce(group_chat_members.last_read_at, -1))`;
  return { group_chat_id: chat.id, is_read: true, read_at: iso(ctx.now) };
}

/** Adds `member_profile_ids` to the chat (any member may); answers the chat. */
export async function addMembers(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const { profile, chat } = await memberChat(ctx, a);
  const memberIds = ids(ctx, a.member_profile_ids, "member_profile_ids", 99);
  if (!memberIds.length) invalid(ctx, "추가할 멤버를 선택해 주세요.");
  await requireLiveProfiles(
    ctx,
    memberIds,
    "한 명 이상의 멤버 프로필을 찾을 수 없습니다",
  );
  await requireNotBlocked(ctx, profile.membership.member, memberIds);
  await ctx.sql`
    INSERT INTO group_chat_members (group_chat_id, profile_id, added_by_id, created_at)
    SELECT ${chat.id}, value, ${profile.id}, ${ctx.now} FROM json_each(${list(memberIds)})
    WHERE true ON CONFLICT DO NOTHING`;
  return groupChatDetails(ctx, chat);
}

/** Removes `member_profile_id` from the chat (its creator only); answers the chat. */
export async function removeMember(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const { profile, chat } = await memberChat(ctx, a);
  const memberId = id(ctx, a.member_profile_id, "member_profile_id");
  if (chat.created_by_id !== profile.id)
    denied(
      ctx,
      "그룹 채팅을 만든 사람만 멤버를 내보낼 수 있습니다",
      "not_group_creator",
    );
  if (memberId === profile.id)
    invalid(ctx, "자신은 내보낼 수 없습니다. 나가기를 이용해 주세요.");
  const { changes } = await ctx.sql`
    DELETE FROM group_chat_members
    WHERE group_chat_id = ${chat.id} AND profile_id = ${memberId}`;
  if (!changes) notFound(ctx, "그룹 채팅 멤버를 찾을 수 없습니다");
  return groupChatDetails(ctx, chat);
}

/** The profile leaves the chat; the last to leave deletes it. */
export async function leave(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const { profile, chat } = await memberChat(ctx, a);
  await ctx.sql`
    DELETE FROM group_chat_members
    WHERE group_chat_id = ${chat.id} AND profile_id = ${profile.id}`;
  await ctx.sql`
    UPDATE group_chats SET deleted_at = ${ctx.now}, updated_at = ${ctx.now}
    WHERE id = ${chat.id}
      AND NOT EXISTS (SELECT 1 FROM group_chat_members WHERE group_chat_id = ${chat.id})`;
  return { group_chat_id: chat.id, left: true };
}
