// Direct messages: commung's POST/DELETE /app/messages, its reactions, and
// marking conversations read.
import { actingProfile, membersOfProfiles } from "../modules/access.js";
import {
  argsOf,
  denied,
  id,
  invalid,
  iso,
  type MutationCtx,
  notFound,
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
  pushBody,
  requireSomething,
} from "../modules/messages.js";

interface DirectMessageRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  created_at: number;
}

/**
 * Sends `content` and `image_ids` (the caller's registered uploads) from
 * `profile_id` to `receiver_id`, and notifies the receiver's members.
 */
export async function send(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const sender = await actingProfile(ctx, a.profile_id);
  if (sender.activated_at === null)
    denied(ctx, "발신자 프로필을 찾을 수 없거나 권한이 없습니다");
  const receiverId = id(ctx, a.receiver_id, "receiver_id");
  const content = contentOf(ctx, a.content);
  const imageIds = imageIdsOf(ctx, a.image_ids);

  const { rows: receivers } = await ctx.sql<{ id: string; username: string }>`
    SELECT id, username FROM profiles
    WHERE id = ${receiverId} AND activated_at IS NOT NULL AND deleted_at IS NULL`;
  if (!receivers[0]) notFound(ctx, "수신자 프로필을 찾을 수 없습니다");
  if (receiverId === sender.id)
    invalid(ctx, "자신에게 메시지를 보낼 수 없습니다", "self_message");
  requireSomething(ctx, content, imageIds);
  if (await blockedWith(ctx, sender.membership.member, [receiverId]))
    denied(
      ctx,
      "차단한 사용자 또는 나를 차단한 사용자와는 메시지를 주고받을 수 없습니다",
      "blocked",
    );
  const images = await ownImages(ctx, imageIds);

  const messageId = uuidv7(ctx.now);
  await ctx.sql`
    INSERT INTO direct_messages (id, content, sender_id, receiver_id, created_by, created_at, updated_at)
    VALUES (${messageId}, ${content}, ${sender.id}, ${receiverId}, ${sender.membership.member}, ${ctx.now}, ${ctx.now})`;
  await attachImages(ctx, "direct_message_images", messageId, images);

  const senderMembers = new Set(await membersOfProfiles(ctx, [sender.id]));
  senderMembers.add(sender.membership.member);
  const recipients = (await membersOfProfiles(ctx, [receiverId])).filter(
    (member) => !senderMembers.has(member),
  );
  if (recipients.length)
    await ctx.notify(recipients, {
      title: clip(sender.name),
      body: pushBody(content),
      path: `/messages/${encodeURIComponent(sender.username)}`,
    });

  return {
    id: messageId,
    content,
    created_at: iso(ctx.now),
    read_at: null,
    is_sender: true,
    sender: await briefOfProfile(ctx, sender.id),
    reactions: [],
    images: images.map(imageJson),
  };
}

/** A live message the profile sent or received; refuses any other. */
async function participantMessage(
  ctx: MutationCtx,
  messageId: string,
  profileId: string,
): Promise<DirectMessageRow> {
  const { rows } = await ctx.sql<DirectMessageRow>`
    SELECT id, sender_id, receiver_id, created_at FROM direct_messages
    WHERE id = ${messageId} AND deleted_at IS NULL`;
  const message = rows[0];
  if (!message) notFound(ctx, "메시지를 찾을 수 없습니다");
  if (message.sender_id !== profileId && message.receiver_id !== profileId)
    denied(ctx, "이 메시지에 접근할 권한이 없습니다", "not_participant");
  return message;
}

/**
 * Deletes a message: `for_me` hides it from the profile, `for_all` (its
 * sender, within two minutes) deletes it for both.
 */
export async function remove(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await actingProfile(ctx, a.profile_id);
  const messageId = id(ctx, a.message_id, "message_id");
  const mode = deleteModeOf(ctx, a.mode);
  const message = await participantMessage(ctx, messageId, profile.id);
  if (mode === "for_all") {
    if (message.sender_id !== profile.id)
      denied(ctx, "자신의 메시지만 모두에게 삭제할 수 있습니다", "not_sender");
    if (ctx.now - message.created_at > DELETE_FOR_ALL_WINDOW_MS)
      denied(
        ctx,
        "메시지 전송 후 2분이 지나면 모두에게 삭제할 수 없습니다",
        "delete_window_passed",
      );
    await ctx.sql`UPDATE direct_messages SET deleted_at = ${ctx.now}, updated_at = ${ctx.now}
      WHERE id = ${messageId}`;
  } else {
    await ctx.sql`
      INSERT INTO direct_message_deletions (message_id, profile_id, deleted_at)
      VALUES (${messageId}, ${profile.id}, ${ctx.now})
      ON CONFLICT DO NOTHING`;
  }
  return { id: messageId, deleted: true };
}

/** Reacts to a message of the profile's conversation with `emoji`. */
export async function addReaction(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await actingProfile(ctx, a.profile_id);
  const messageId = id(ctx, a.message_id, "message_id");
  const emoji = emojiOf(ctx, a.emoji);
  await participantMessage(ctx, messageId, profile.id);
  const reactionId = uuidv7(ctx.now);
  const { changes } = await ctx.sql`
    INSERT INTO direct_message_reactions (id, message_id, profile_id, emoji, created_at)
    VALUES (${reactionId}, ${messageId}, ${profile.id}, ${emoji}, ${ctx.now})
    ON CONFLICT DO NOTHING`;
  if (!changes) invalid(ctx, "반응이 이미 존재합니다", "already_reacted");
  return { id: reactionId, message: "반응이 성공적으로 추가되었습니다", emoji };
}

/** Takes back the profile's `emoji` reaction to a message. */
export async function removeReaction(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await actingProfile(ctx, a.profile_id);
  const messageId = id(ctx, a.message_id, "message_id");
  const emoji = emojiOf(ctx, a.emoji);
  await participantMessage(ctx, messageId, profile.id);
  const { changes } = await ctx.sql`
    DELETE FROM direct_message_reactions
    WHERE message_id = ${messageId} AND profile_id = ${profile.id} AND emoji = ${emoji}`;
  if (!changes) notFound(ctx, "반응을 찾을 수 없습니다");
  return { message_id: messageId, emoji, deleted: true };
}

/**
 * Marks what `other_profile_id` sent the profile as read: one call when a
 * conversation opens or new messages arrive in it.
 */
export async function markConversationRead(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await actingProfile(ctx, a.profile_id);
  const otherId = id(ctx, a.other_profile_id, "other_profile_id");
  const { rows } = await ctx.sql`
    SELECT id FROM profiles WHERE id = ${otherId} AND deleted_at IS NULL`;
  if (!rows[0]) notFound(ctx, "다른 프로필을 찾을 수 없습니다");
  await ctx.sql`
    UPDATE direct_messages SET read_at = ${ctx.now}
    WHERE receiver_id = ${profile.id} AND sender_id = ${otherId}
      AND read_at IS NULL AND deleted_at IS NULL`;
  return { conversation_with: otherId, is_read: true, read_at: iso(ctx.now) };
}

/** Marks every message the profile received as read. */
export async function markAllRead(ctx: MutationCtx, args: unknown) {
  const profile = await actingProfile(ctx, argsOf(args).profile_id);
  await ctx.sql`
    UPDATE direct_messages SET read_at = ${ctx.now}
    WHERE receiver_id = ${profile.id} AND read_at IS NULL AND deleted_at IS NULL`;
  return { all_read: true, read_at: iso(ctx.now) };
}
