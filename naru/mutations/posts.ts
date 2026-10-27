// Writing posts: commung's POST/PATCH/DELETE /app/posts/:id and its
// bookmark, reactions, pin and report. Each first publishes scheduled posts
// whose time has come (publishDue, modules/posts.ts).
import { actingProfile, isStaff } from "../modules/access.js";
import { settingsOf } from "../modules/community.js";
import {
  argsOf,
  denied,
  id,
  invalid,
  iso,
  type MutationCtx,
  msOf,
  notFound,
  optionalId,
  text,
  uuidv7,
} from "../modules/core.js";
import { ownImages } from "../modules/images.js";
import {
  extrasFor,
  type PostRow,
  postJson,
  VISIBLE,
} from "../modules/post-data.js";
import {
  answerCommand,
  createPost,
  indexPost,
  notifyProfiles,
  postPath,
  publishDue,
  unindexPost,
} from "../modules/posts.js";

/** The profile acting, which must be active (commung's requireActive). */
async function activeProfile(ctx: MutationCtx, profileId: unknown) {
  const profile = await actingProfile(ctx, profileId);
  if (profile.activated_at === null) notFound(ctx, "프로필을 찾을 수 없습니다");
  return profile;
}

/** A post not deleted (scheduled ones too), or null. */
async function livePost(ctx: MutationCtx, postId: string) {
  const { rows } = await ctx.sql<PostRow & { author_username: string }>`
    SELECT p.*, pr.username AS author_username
    FROM posts p JOIN profiles pr ON pr.id = p.author_id
    WHERE p.id = ${postId} AND p.deleted_at IS NULL`;
  return rows[0] ?? null;
}

/** A post everyone sees (not deleted, published or due), or null. */
async function shownPost(ctx: MutationCtx, postId: string) {
  const { rows } = await ctx.sql<PostRow & { author_username: string }>(
    `SELECT p.*, pr.username AS author_username
     FROM posts p JOIN profiles pr ON pr.id = p.author_id
     WHERE p.id = ? AND ${VISIBLE}`,
    [postId, ctx.now],
  );
  return rows[0] ?? null;
}

/** A post as its writer gets it back from create and update. */
async function answer(ctx: MutationCtx, postId: string) {
  const { rows } =
    await ctx.sql<PostRow>`SELECT * FROM posts WHERE id = ${postId}`;
  const row = rows[0];
  if (!row) notFound(ctx, "게시물을 찾을 수 없습니다");
  return postJson(row, await extrasFor(ctx, [row], null));
}

/** Refuses outside the community's dates (commung's validateCommunityActive). */
async function requireActiveCommunity(ctx: MutationCtx, action: string) {
  const settings = await settingsOf(ctx);
  if (!settings) notFound(ctx, "커뮤를 찾을 수 없습니다");
  if (ctx.now > settings.ends_at)
    denied(ctx, `커뮤가 종료되어 ${action}할 수 없습니다`, "community_ended");
  if (ctx.now < settings.starts_at)
    denied(ctx, "커뮤가 아직 시작되지 않았습니다", "community_not_started");
}

/** Image IDs (Naru upload IDs, not UUIDs), at most 20, without repeats. */
function imageIdsOf(ctx: MutationCtx, value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > 20 ||
    value.some((v) => typeof v !== "string" || !v || v.length > 200)
  )
    invalid(ctx, "image_ids 값이 올바르지 않습니다.");
  return [...new Set(value as string[])];
}

const contentOf = (ctx: MutationCtx, value: unknown) => {
  if (typeof value !== "string")
    invalid(ctx, "content 값이 올바르지 않습니다.");
  return value;
};

const contentWarningOf = (ctx: MutationCtx, value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string")
    invalid(ctx, "content_warning 값이 올바르지 않습니다.");
  return value;
};

/** Writes a post as the profile (POST /app/posts); answers it. */
export async function create(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  await publishDue(ctx);
  const profile = await activeProfile(ctx, a.profile_id);
  const content = contentOf(ctx, a.content);
  const scheduledAt = msOf(ctx, a.scheduled_at, "scheduled_at");
  const inReplyToId = optionalId(ctx, a.in_reply_to_id, "in_reply_to_id");
  const postId = await createPost(ctx, {
    authorProfileId: profile.id,
    actorMember: profile.membership.member,
    content,
    contentWarning: contentWarningOf(ctx, a.content_warning),
    inReplyToId,
    imageIds: imageIdsOf(ctx, a.image_ids),
    announcement: a.announcement === true,
    scheduledAt,
  });
  const post = await answer(ctx, postId);
  if (scheduledAt === null)
    await answerCommand(ctx, {
      id: postId,
      content,
      authorProfileId: profile.id,
      actorMember: profile.membership.member,
      rootPostId: post.root_post_id,
    });
  return post;
}

/**
 * Edits the profile's own post (PATCH /app/posts/:post_id), keeping what it
 * was in post_history. Only the owner sets or clears an announcement.
 */
export async function update(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  await publishDue(ctx);
  const postId = id(ctx, a.post_id, "post_id");
  const profile = await activeProfile(ctx, a.profile_id);
  const content = contentOf(ctx, a.content);
  const contentWarning = contentWarningOf(ctx, a.content_warning);
  const imageIds = imageIdsOf(ctx, a.image_ids);
  const { rows } = await ctx.sql<PostRow>`
    SELECT * FROM posts
    WHERE id = ${postId} AND deleted_at IS NULL AND published_at IS NOT NULL`;
  const post = rows[0];
  if (!post) notFound(ctx, "게시물을 찾을 수 없습니다");
  if (post.author_id !== profile.id)
    denied(ctx, "본인의 게시물만 수정할 수 있습니다", "not_author");
  if (post.scheduled_at !== null)
    invalid(ctx, "예약된 게시물은 수정할 수 없습니다", "scheduled_post");
  const announcement =
    typeof a.announcement === "boolean" ? a.announcement : undefined;
  if (
    announcement !== undefined &&
    announcement !== (post.announcement === 1)
  ) {
    if (profile.membership.role !== "owner")
      denied(ctx, "공지사항 설정은 소유자만 할 수 있습니다", "not_owner");
    if (announcement && post.depth !== 0)
      invalid(
        ctx,
        "답글은 공지사항으로 설정할 수 없습니다",
        "announcement_reply",
      );
  }
  if (!content.trim() && !imageIds.length)
    invalid(ctx, "게시물 내용 또는 이미지를 제공해야 합니다", "empty_post");
  if (content.length > 10000)
    invalid(ctx, "게시물은 10000자 이하여야 합니다", "content_too_long");
  if (contentWarning && contentWarning.length > 500)
    invalid(
      ctx,
      "내용 경고는 500자 이하여야 합니다",
      "content_warning_too_long",
    );

  const { rows: current } = await ctx.sql<{ image_id: string }>`
    SELECT image_id FROM post_images WHERE post_id = ${postId} ORDER BY position`;
  const kept = new Set(current.map((row) => row.image_id));
  // Images the post already has stay; new ones must be the caller's uploads.
  await ownImages(
    ctx,
    imageIds.filter((imageId) => !kept.has(imageId)),
  );

  await ctx.sql`
    INSERT INTO post_history (id, post_id, content, content_warning, image_ids, edited_at, edited_by_profile_id)
    VALUES (${uuidv7(ctx.now)}, ${postId}, ${post.content}, ${post.content_warning},
      ${JSON.stringify(current.map((row) => row.image_id))}, ${ctx.now}, ${profile.id})`;
  await ctx.sql`
    UPDATE posts SET content = ${content}, content_warning = ${contentWarning},
      announcement = ${announcement ?? post.announcement === 1},
      updated_at = ${ctx.now}
    WHERE id = ${postId}`;
  await ctx.sql`DELETE FROM post_images WHERE post_id = ${postId}`;
  if (imageIds.length)
    await ctx.sql`
      INSERT INTO post_images (post_id, image_id, position)
      SELECT ${postId}, value, key FROM json_each(${JSON.stringify(imageIds)})`;
  await indexPost(ctx, {
    id: postId,
    content,
    content_warning: contentWarning,
  });
  return answer(ctx, postId);
}

/**
 * Deletes a post (DELETE /app/posts/:post_id): its author, or the
 * community's owner or a moderator, whose deletion is logged.
 */
export async function remove(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  await publishDue(ctx);
  const postId = id(ctx, a.post_id, "post_id");
  const profile = await activeProfile(ctx, a.profile_id);
  const post = await livePost(ctx, postId);
  if (!post) notFound(ctx, "게시물을 찾을 수 없습니다");
  const isAuthor = post.author_id === profile.id;
  if (!isAuthor && !isStaff(profile.membership))
    denied(
      ctx,
      "게시물 작성자, 커뮤 소유자 또는 모더레이터만 게시물을 삭제할 수 있습니다",
      "not_allowed",
    );
  await ctx.sql`UPDATE posts SET deleted_at = ${ctx.now} WHERE id = ${postId}`;
  await unindexPost(ctx, postId);
  if (!isAuthor) {
    const excerpt = `${post.content.slice(0, 50)}${post.content.length > 50 ? "..." : ""}`;
    await ctx.sql`
      INSERT INTO moderation_log (id, action, description, moderator, target_profile_id, target_post_id, created_at)
      VALUES (${uuidv7(ctx.now)}, 'delete_post',
        ${`@${post.author_username}의 게시물을 삭제했습니다: "${excerpt}"`},
        ${profile.id}, ${post.author_id}, ${post.id}, ${ctx.now})`;
  }
  return { id: postId, deleted: true };
}

/** Bookmarks a post for the profile (POST /app/posts/:post_id/bookmark). */
export async function bookmark(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  await publishDue(ctx);
  const postId = id(ctx, a.post_id, "post_id");
  const profile = await activeProfile(ctx, a.profile_id);
  if (!(await shownPost(ctx, postId)))
    notFound(ctx, "게시물을 찾을 수 없습니다");
  const { changes } = await ctx.sql`
    INSERT OR IGNORE INTO post_bookmarks (profile_id, post_id, created_at)
    VALUES (${profile.id}, ${postId}, ${ctx.now})`;
  if (!changes)
    ctx.fail("CONFLICT", "게시물이 이미 북마크되었습니다", {
      reason: "already_bookmarked",
    });
  return {
    message: "게시물이 성공적으로 북마크되었습니다",
    bookmark_id: `${profile.id}:${postId}`,
  };
}

/** Removes the profile's bookmark (DELETE /app/posts/:post_id/bookmark). */
export async function unbookmark(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  await publishDue(ctx);
  const postId = id(ctx, a.post_id, "post_id");
  const profile = await activeProfile(ctx, a.profile_id);
  if (!(await livePost(ctx, postId)))
    notFound(ctx, "게시물을 찾을 수 없습니다");
  const { changes } = await ctx.sql`
    DELETE FROM post_bookmarks WHERE profile_id = ${profile.id} AND post_id = ${postId}`;
  if (!changes) notFound(ctx, "북마크를 찾을 수 없습니다");
  return { post_id: postId, bookmarked: false };
}

const emojiOf = (ctx: MutationCtx, value: unknown) =>
  text(ctx, value, "emoji", { max: 10, raw: true });

/**
 * Reacts to a post with an emoji (POST /app/posts/:post_id/reactions),
 * notifying its author.
 */
export async function react(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  await publishDue(ctx);
  const postId = id(ctx, a.post_id, "post_id");
  const profile = await actingProfile(ctx, a.profile_id);
  const emoji = emojiOf(ctx, a.emoji);
  await requireActiveCommunity(ctx, "반응을 추가");
  const post = await shownPost(ctx, postId);
  if (!post) notFound(ctx, "게시물을 찾을 수 없거나 접근이 거부되었습니다");
  const { changes } = await ctx.sql`
    INSERT OR IGNORE INTO post_reactions (post_id, profile_id, emoji, created_at)
    VALUES (${postId}, ${profile.id}, ${emoji}, ${ctx.now})`;
  if (!changes) invalid(ctx, "반응이 이미 존재합니다", "already_reacted");
  if (post.author_id !== profile.id)
    await notifyProfiles(ctx, {
      type: "reaction",
      title: "새로운 반응",
      message: `${profile.name}님이 게시물에 ${emoji} 반응을 남겼습니다`,
      sender: profile.id,
      postId,
      recipients: [post.author_id],
      path: postPath(post.author_username, postId),
      actorMember: profile.membership.member,
    });
  return {
    id: `${postId}:${profile.id}:${emoji}`,
    message: "반응이 성공적으로 추가되었습니다",
    emoji,
  };
}

/** Takes back the profile's reaction (DELETE /app/posts/:post_id/reactions). */
export async function unreact(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  await publishDue(ctx);
  const postId = id(ctx, a.post_id, "post_id");
  const profile = await actingProfile(ctx, a.profile_id);
  const emoji = emojiOf(ctx, a.emoji);
  await requireActiveCommunity(ctx, "반응을 제거");
  if (!(await shownPost(ctx, postId)))
    notFound(ctx, "게시물을 찾을 수 없거나 접근이 거부되었습니다");
  const { changes } = await ctx.sql`
    DELETE FROM post_reactions
    WHERE post_id = ${postId} AND profile_id = ${profile.id} AND emoji = ${emoji}`;
  if (!changes) notFound(ctx, "반응을 찾을 수 없습니다");
  return { post_id: postId, emoji, deleted: true };
}

/** Pins the profile's own post to its page, at most three (POST /app/posts/:post_id/pin). */
export async function pin(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  await publishDue(ctx);
  const postId = id(ctx, a.post_id, "post_id");
  const profile = await activeProfile(ctx, a.profile_id);
  const post = await livePost(ctx, postId);
  if (!post) notFound(ctx, "게시물을 찾을 수 없습니다");
  if (post.author_id !== profile.id)
    denied(ctx, "본인의 게시물만 고정할 수 있습니다", "not_author");
  if (post.pinned_at !== null)
    ctx.fail("CONFLICT", "이미 고정된 게시물입니다", {
      reason: "already_pinned",
    });
  const { rows } = await ctx.sql<{ n: number }>`
    SELECT count(*) AS n FROM posts
    WHERE author_id = ${profile.id} AND pinned_at IS NOT NULL AND deleted_at IS NULL`;
  if ((rows[0]?.n ?? 0) >= 3)
    invalid(
      ctx,
      "최대 3개의 게시물만 고정할 수 있습니다. 다른 게시물을 고정 해제하세요.",
      "too_many_pinned",
    );
  await ctx.sql`UPDATE posts SET pinned_at = ${ctx.now} WHERE id = ${postId}`;
  return { post_id: postId, pinned: true, pinned_at: iso(ctx.now) };
}

/** Unpins the profile's own post (DELETE /app/posts/:post_id/pin). */
export async function unpin(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  await publishDue(ctx);
  const postId = id(ctx, a.post_id, "post_id");
  const profile = await activeProfile(ctx, a.profile_id);
  const post = await livePost(ctx, postId);
  if (!post) notFound(ctx, "게시물을 찾을 수 없습니다");
  if (post.author_id !== profile.id)
    denied(ctx, "본인의 게시물만 고정 해제할 수 있습니다", "not_author");
  if (post.pinned_at === null)
    invalid(ctx, "고정되지 않은 게시물입니다", "not_pinned");
  await ctx.sql`UPDATE posts SET pinned_at = NULL WHERE id = ${postId}`;
  return { post_id: postId, pinned: false };
}

/**
 * Reports a post (POST /app/posts/:post_id/report). commung emailed its
 * platform's admins; here the report is kept in post_reports and the
 * community's owner and moderators are notified in the Naru app.
 */
export async function report(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  await publishDue(ctx);
  const postId = id(ctx, a.post_id, "post_id");
  const profile = await actingProfile(ctx, a.profile_id);
  const reason = text(ctx, a.reason, "신고 사유", { max: 2000 });
  const post = await shownPost(ctx, postId);
  if (!post) notFound(ctx, "게시물을 찾을 수 없습니다");
  await ctx.sql`
    INSERT INTO post_reports (id, post_id, reporter_profile_id, reporter_member, reason, created_at)
    VALUES (${uuidv7(ctx.now)}, ${postId}, ${profile.id}, ${profile.membership.member},
      ${reason}, ${ctx.now})`;
  const { rows: staff } = await ctx.sql<{ member: string }>`
    SELECT member FROM members WHERE role IN ('owner', 'moderator')`;
  const recipients = staff
    .map((row) => row.member)
    .filter((member) => member !== profile.membership.member);
  if (recipients.length)
    await ctx.notify(recipients, {
      title: "게시물 신고",
      body: `@${profile.username}님이 @${post.author_username}님의 게시물을 신고했습니다: ${reason}`.slice(
        0,
        500,
      ),
      path: postPath(post.author_username, postId),
    });
  return { success: true };
}
