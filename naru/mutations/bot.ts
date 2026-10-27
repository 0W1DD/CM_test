// The bot API's writes (commung's /bot/communities/:id/...): visitor calls
// that carry a bot token, `{ token, ... }`, acting as the bot's profile.
// Naru limits visitors' calls to 20 a minute per address.
import {
  authenticateBot,
  type BotCaller,
  botPost,
  livePost,
  requireActiveCommunity,
  touchToken,
} from "../modules/bots.js";
import {
  argsOf,
  denied,
  id,
  invalid,
  type MutationCtx,
  notFound,
  optionalId,
  uuidv7,
} from "../modules/core.js";
import {
  answerCommand,
  indexPost,
  notifyProfiles,
  postPath,
  publishDue,
  unindexPost,
  createPost as writePost,
} from "../modules/posts.js";

/** The token's bot, after publishing due scheduled posts as every posts mutation does. */
async function botCaller(ctx: MutationCtx, token: unknown): Promise<BotCaller> {
  const caller = await authenticateBot(ctx, token);
  await touchToken(ctx, caller);
  await publishDue(ctx);
  return caller;
}

/** A post seen by everyone: published, or due. */
const shown = (
  post: { published_at: number | null; scheduled_at: number | null },
  now: number,
) =>
  post.published_at !== null ||
  (post.scheduled_at !== null && post.scheduled_at <= now);

function contentOf(ctx: MutationCtx, value: unknown) {
  if (typeof value !== "string") invalid(ctx, "내용을(를) 입력해 주세요.");
  if (value.length > 10000) invalid(ctx, "내용은(는) 10000자 이하여야 합니다.");
  return value;
}

function contentWarningOf(ctx: MutationCtx, value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 500)
    invalid(ctx, "내용 경고는 500자 이하여야 합니다.");
  return value;
}

/**
 * Posts as the bot (POST /posts), a reply with `in_reply_to_id`; a slash
 * command in it runs as in members' posts.
 */
export async function createPost(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const caller = await botCaller(ctx, a.token);
  const content = contentOf(ctx, a.content);
  const postId = await writePost(ctx, {
    authorProfileId: caller.profileId,
    actorMember: caller.createdBy,
    content,
    contentWarning: contentWarningOf(ctx, a.content_warning),
    inReplyToId: optionalId(ctx, a.in_reply_to_id, "in_reply_to_id"),
    imageIds: [],
    announcement: false,
    scheduledAt: null,
  });
  const { rows } = await ctx.sql<{ root_post_id: string | null }>`
    SELECT root_post_id FROM posts WHERE id = ${postId}`;
  await answerCommand(ctx, {
    id: postId,
    content,
    authorProfileId: caller.profileId,
    actorMember: caller.createdBy,
    rootPostId: rows[0]?.root_post_id ?? null,
  });
  return await botPost(ctx, caller, postId);
}

/** Edits one of the bot's own posts (PUT /posts/:postId). */
export async function updatePost(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const caller = await botCaller(ctx, a.token);
  const postId = id(ctx, a.post_id, "post_id");
  const content = contentOf(ctx, a.content);
  const contentWarning = contentWarningOf(ctx, a.content_warning);
  const post = await livePost(ctx, postId, "게시물을 찾을 수 없습니다");
  if (post.author_id !== caller.profileId)
    denied(ctx, "본인의 게시물만 수정할 수 있습니다", "not_post_author");
  if (post.published_at === null || post.scheduled_at !== null)
    invalid(ctx, "예약된 게시물은 수정할 수 없습니다", "scheduled_post");
  const { rows: images } = await ctx.sql<{ image_id: string }>`
    SELECT image_id FROM post_images WHERE post_id = ${postId} ORDER BY position`;
  if (!content.trim() && !images.length)
    invalid(ctx, "게시물 내용 또는 이미지를 제공해야 합니다");
  await ctx.sql`
    INSERT INTO post_history (id, post_id, content, content_warning, image_ids, edited_at, edited_by_profile_id)
    VALUES (${uuidv7(ctx.now)}, ${postId}, ${post.content}, ${post.content_warning},
      ${JSON.stringify(images.map((image) => image.image_id))}, ${ctx.now}, ${caller.profileId})`;
  await ctx.sql`
    UPDATE posts SET content = ${content}, content_warning = ${contentWarning}, updated_at = ${ctx.now}
    WHERE id = ${postId}`;
  await indexPost(ctx, {
    id: postId,
    content,
    content_warning: contentWarning,
  });
  return await botPost(ctx, caller, postId);
}

/** Deletes one of the bot's own posts (DELETE /posts/:postId). */
export async function deletePost(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const caller = await botCaller(ctx, a.token);
  const postId = id(ctx, a.post_id, "post_id");
  const post = await livePost(ctx, postId, "게시물을 찾을 수 없습니다");
  if (post.author_id !== caller.profileId)
    denied(ctx, "본인의 게시물만 삭제할 수 있습니다", "not_post_author");
  await ctx.sql`UPDATE posts SET deleted_at = ${ctx.now} WHERE id = ${postId}`;
  await unindexPost(ctx, postId);
  return { message: "게시물이 삭제되었습니다" };
}

function emojiOf(ctx: MutationCtx, value: unknown) {
  if (typeof value !== "string" || value.length < 1 || value.length > 32)
    invalid(ctx, "반응 이모지가 올바르지 않습니다.");
  return value;
}

/** Reacts to a post as the bot (POST /posts/:postId/reactions). */
export async function addReaction(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const caller = await botCaller(ctx, a.token);
  const postId = id(ctx, a.post_id, "post_id");
  const emoji = emojiOf(ctx, a.emoji);
  await requireActiveCommunity(ctx, "반응을 추가");
  const message = "게시물을 찾을 수 없거나 접근이 거부되었습니다";
  const post = await livePost(ctx, postId, message);
  if (!shown(post, ctx.now)) notFound(ctx, message);
  const { changes } = await ctx.sql`
    INSERT OR IGNORE INTO post_reactions (post_id, profile_id, emoji, created_at)
    VALUES (${postId}, ${caller.profileId}, ${emoji}, ${ctx.now})`;
  if (!changes) invalid(ctx, "반응이 이미 존재합니다", "already_reacted");
  if (post.author_id !== caller.profileId)
    await notifyProfiles(ctx, {
      type: "reaction",
      title: "새로운 반응",
      message: `${caller.profileName}님이 게시물에 ${emoji} 반응을 남겼습니다`,
      sender: caller.profileId,
      postId,
      recipients: [post.author_id],
      path: postPath(post.author_username, postId),
      actorMember: null,
    });
  return {
    id: `${postId}:${caller.profileId}:${emoji}`,
    emoji,
    message: "반응이 성공적으로 추가되었습니다",
  };
}

/** Takes back the bot's reaction (DELETE /posts/:postId/reactions/:emoji). */
export async function removeReaction(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const caller = await botCaller(ctx, a.token);
  const postId = id(ctx, a.post_id, "post_id");
  const emoji = emojiOf(ctx, a.emoji);
  await requireActiveCommunity(ctx, "반응을 제거");
  const message = "게시물을 찾을 수 없거나 접근이 거부되었습니다";
  const post = await livePost(ctx, postId, message);
  if (!shown(post, ctx.now)) notFound(ctx, message);
  const { changes } = await ctx.sql`
    DELETE FROM post_reactions
    WHERE post_id = ${postId} AND profile_id = ${caller.profileId} AND emoji = ${emoji}`;
  if (!changes) notFound(ctx, "반응을 찾을 수 없습니다");
  return { message: "반응이 삭제되었습니다" };
}
