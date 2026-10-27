// Writing on boards (commung's /app/boards) and managing them (the console's
// community boards, owner only).
import {
  actingProfile,
  membersOfProfiles,
  requireMembership,
  requireOwner,
} from "../modules/access.js";
import {
  type BoardRow,
  boardById,
  boardBySlug,
  boardJson,
  boardPost,
  commentsDisabled,
  postNotFound,
  replyNotFound,
  SLUG_PATTERN,
} from "../modules/boards.js";
import {
  argsOf,
  type Ctx,
  denied,
  id,
  invalid,
  iso,
  type MutationCtx,
  optionalId,
  optionalText,
  text,
  uuidv7,
} from "../modules/core.js";
import { ownImages } from "../modules/images.js";

/** The acting profile, which must be active (commung's requireActive). */
async function activeProfile(ctx: Ctx, profileId: unknown) {
  const profile = await actingProfile(ctx, profileId);
  if (profile.activated_at === null)
    ctx.fail("NOT_FOUND", "프로필을 찾을 수 없습니다.", {
      reason: "profile_not_found",
    });
  return profile;
}

/** An image ID (a Naru upload ID, not a UUID), or null. */
function imageIdOf(ctx: Ctx, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 200)
    invalid(ctx, "image_id 값이 올바르지 않습니다.");
  return value;
}

function postFields(ctx: Ctx, a: Record<string, unknown>) {
  return {
    title: text(ctx, a.title, "제목", { max: 200 }),
    content: text(ctx, a.content, "내용", { max: 50000 }),
    imageId: imageIdOf(ctx, a.image_id),
  };
}

async function checkImage(ctx: Ctx, imageId: string | null) {
  if (imageId) await ownImages(ctx, [imageId]);
}

/** Writes a post on a board (POST /boards/:slug/posts). */
export async function createPost(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await activeProfile(ctx, a.profile_id);
  const board = await boardBySlug(ctx, a.slug);
  const { title, content, imageId } = postFields(ctx, a);
  await checkImage(ctx, imageId);
  const postId = uuidv7(ctx.now);
  await ctx.sql`
    INSERT INTO board_posts (id, board_id, author_id, title, content, image_id, created_at, updated_at)
    VALUES (${postId}, ${board.id}, ${profile.id}, ${title}, ${content}, ${imageId}, ${ctx.now}, ${ctx.now})`;
  return await boardPost(ctx, postId);
}

async function ownPost(
  ctx: Ctx,
  postId: string,
  profileId: string,
  verb: string,
) {
  const { rows } = await ctx.sql<{ author_id: string }>`
    SELECT author_id FROM board_posts WHERE id = ${postId} AND deleted_at IS NULL`;
  const post = rows[0] ?? postNotFound(ctx);
  if (post.author_id !== profileId)
    denied(
      ctx,
      `작성자만 이 게시글을 ${verb}할 수 있습니다.`,
      "not_post_author",
    );
}

/** Edits the profile's own post (PATCH /boards/:slug/posts/:postId). */
export async function updatePost(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await activeProfile(ctx, a.profile_id);
  const postId = id(ctx, a.post_id, "post_id");
  const { title, content, imageId } = postFields(ctx, a);
  await ownPost(ctx, postId, profile.id, "수정");
  await checkImage(ctx, imageId);
  await ctx.sql`
    UPDATE board_posts SET title = ${title}, content = ${content},
      image_id = ${imageId}, updated_at = ${ctx.now}
    WHERE id = ${postId}`;
  return await boardPost(ctx, postId);
}

/** Deletes the profile's own post and its replies (DELETE /boards/:slug/posts/:postId). */
export async function deletePost(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await activeProfile(ctx, a.profile_id);
  const postId = id(ctx, a.post_id, "post_id");
  await ownPost(ctx, postId, profile.id, "삭제");
  await ctx.sql`UPDATE board_posts SET deleted_at = ${ctx.now} WHERE id = ${postId}`;
  await ctx.sql`
    UPDATE board_replies SET deleted_at = ${ctx.now}
    WHERE post_id = ${postId} AND deleted_at IS NULL`;
  return { id: postId, deleted: true };
}

/**
 * Replies to a post or to a reply (POST /boards/:slug/posts/:postId/replies),
 * and tells the post's or the reply's author.
 */
export async function createReply(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await activeProfile(ctx, a.profile_id);
  const postId = id(ctx, a.post_id, "post_id");
  const content = text(ctx, a.content, "내용", { max: 10000 });
  const inReplyToId = optionalId(ctx, a.in_reply_to_id, "in_reply_to_id");
  const { rows: posts } = await ctx.sql<{
    author_id: string;
    title: string;
    allow_comments: number;
    slug: string;
  }>`
    SELECT bp.author_id, bp.title, b.allow_comments, b.slug FROM board_posts bp
    JOIN boards b ON b.id = bp.board_id
    WHERE bp.id = ${postId} AND bp.deleted_at IS NULL`;
  const post = posts[0] ?? postNotFound(ctx);
  if (post.allow_comments !== 1) commentsDisabled(ctx);

  let depth = 0;
  let rootReplyId: string | null = null;
  let parentAuthor: string | null = null;
  if (inReplyToId) {
    const { rows: parents } = await ctx.sql<{
      post_id: string;
      depth: number;
      root_reply_id: string | null;
      author_id: string;
    }>`
      SELECT post_id, depth, root_reply_id, author_id FROM board_replies
      WHERE id = ${inReplyToId} AND deleted_at IS NULL`;
    const parent =
      parents[0] ?? replyNotFound(ctx, "상위 댓글을 찾을 수 없습니다.");
    if (parent.post_id !== postId)
      invalid(ctx, "상위 댓글이 이 게시글의 댓글이 아닙니다.");
    depth = parent.depth + 1;
    rootReplyId = parent.depth === 0 ? inReplyToId : parent.root_reply_id;
    parentAuthor = parent.author_id;
  }

  const replyId = uuidv7(ctx.now);
  await ctx.sql`
    INSERT INTO board_replies (id, post_id, author_id, content, in_reply_to_id, depth, root_reply_id, created_at, updated_at)
    VALUES (${replyId}, ${postId}, ${profile.id}, ${content}, ${inReplyToId}, ${depth}, ${rootReplyId}, ${ctx.now}, ${ctx.now})`;

  // commung tells the post's author of a comment, and a reply's author of a
  // reply to it, never the replier themselves.
  const path = `/boards/${post.slug}/${postId}`;
  if (!inReplyToId && post.author_id !== profile.id)
    await notify(ctx, post.author_id, {
      title: "새로운 댓글",
      message: `**${profile.name}**님이 _${post.title}_ 게시글에 댓글을 작성했습니다`,
      body: `${profile.name}님이 회원님의 게시글에 댓글을 작성했습니다`,
      actor: profile.id,
      postId,
      replyId,
      path,
    });
  if (parentAuthor && parentAuthor !== profile.id)
    await notify(ctx, parentAuthor, {
      title: "새로운 답글",
      message: `**${profile.name}**님이 _${post.title}_ 게시글의 댓글에 답글을 작성했습니다`,
      body: `${profile.name}님이 회원님의 댓글에 답글을 작성했습니다`,
      actor: profile.id,
      postId,
      replyId,
      path,
    });

  return {
    id: replyId,
    content,
    depth,
    in_reply_to_id: inReplyToId,
    author: {
      id: profile.id,
      name: profile.name,
      username: profile.username,
      profile_picture: await pictureOf(ctx, profile.picture_id),
    },
    created_at: iso(ctx.now),
    updated_at: iso(ctx.now),
  };
}

async function pictureOf(ctx: Ctx, imageId: string | null) {
  if (!imageId) return null;
  const { rows } = await ctx.sql<{
    id: string;
    url: string;
    width: number;
    height: number;
  }>`SELECT id, url, width, height FROM images WHERE id = ${imageId}`;
  return rows[0] ?? null;
}

/** Records a board notification for the members of `recipientProfile`, and pushes it. */
async function notify(
  ctx: MutationCtx,
  recipientProfile: string,
  n: {
    title: string;
    message: string;
    body: string;
    actor: string;
    postId: string;
    replyId: string;
    path: string;
  },
) {
  const members = (await membersOfProfiles(ctx, [recipientProfile])).filter(
    (member) => member !== ctx.member?.id,
  );
  for (const member of members)
    await ctx.sql`
      INSERT INTO board_notifications (id, title, message, recipient, actor_profile_id, post_id, reply_id, created_at)
      VALUES (${uuidv7(ctx.now)}, ${n.title}, ${n.message}, ${member}, ${n.actor}, ${n.postId}, ${n.replyId}, ${ctx.now})`;
  if (members.length)
    await ctx.notify(members, { title: n.title, body: n.body, path: n.path });
}

/**
 * Deletes the profile's own reply and every reply under it
 * (DELETE /boards/:slug/posts/:postId/replies/:replyId).
 */
export async function deleteReply(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await activeProfile(ctx, a.profile_id);
  const replyId = id(ctx, a.reply_id, "reply_id");
  const { rows } = await ctx.sql<{ author_id: string; depth: number }>`
    SELECT author_id, depth FROM board_replies
    WHERE id = ${replyId} AND deleted_at IS NULL`;
  const reply = rows[0] ?? replyNotFound(ctx);
  if (reply.author_id !== profile.id)
    denied(ctx, "작성자만 이 댓글을 삭제할 수 있습니다.", "not_reply_author");
  await ctx.sql`UPDATE board_replies SET deleted_at = ${ctx.now} WHERE id = ${replyId}`;
  if (reply.depth === 0)
    await ctx.sql`
      UPDATE board_replies SET deleted_at = ${ctx.now}
      WHERE root_reply_id = ${replyId} AND deleted_at IS NULL`;
  else
    await ctx.sql`
      WITH RECURSIVE descendants (id) AS (
        SELECT id FROM board_replies WHERE in_reply_to_id = ${replyId} AND deleted_at IS NULL
        UNION ALL
        SELECT r.id FROM board_replies r JOIN descendants d ON r.in_reply_to_id = d.id
        WHERE r.deleted_at IS NULL
      )
      UPDATE board_replies SET deleted_at = ${ctx.now}
      WHERE id IN (SELECT id FROM descendants)`;
  return { id: replyId, deleted: true };
}

/** Marks one of the member's board notifications read, or all of them without `id`. */
export async function markNotificationRead(ctx: MutationCtx, args: unknown) {
  const membership = await requireMembership(ctx);
  const notificationId = optionalId(ctx, argsOf(args).id, "id");
  if (!notificationId) {
    await ctx.sql`
      UPDATE board_notifications SET read_at = ${ctx.now}
      WHERE recipient = ${membership.member} AND read_at IS NULL`;
    return { success: true };
  }
  const { changes } = await ctx.sql`
    UPDATE board_notifications SET read_at = coalesce(read_at, ${ctx.now})
    WHERE id = ${notificationId} AND recipient = ${membership.member}`;
  if (!changes)
    ctx.fail("NOT_FOUND", "알림을 찾을 수 없습니다", { reason: "not_found" });
  return { success: true };
}

// The console's board management (owner only).

function boardFields(ctx: Ctx, a: Record<string, unknown>) {
  const name = text(ctx, a.name, "게시판 이름", { max: 100 });
  const slug = typeof a.slug === "string" ? a.slug : "";
  if (!SLUG_PATTERN.test(slug) || slug.length > 100)
    invalid(ctx, "슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.");
  const description = optionalText(ctx, a.description, "게시판 설명", {
    max: 1000,
  });
  if (a.allow_comments !== undefined && typeof a.allow_comments !== "boolean")
    invalid(ctx, "allow_comments 값이 올바르지 않습니다.");
  return {
    name,
    slug,
    description,
    allowComments: a.allow_comments as boolean | undefined,
  };
}

async function slugFree(ctx: Ctx, slug: string, except: string | null) {
  const { rows } = await ctx.sql<{ id: string }>`
    SELECT id FROM boards WHERE slug = ${slug} AND deleted_at IS NULL`;
  if (rows[0] && rows[0].id !== except)
    ctx.fail("CONFLICT", "이미 사용 중인 게시판 주소입니다.", {
      reason: "duplicate_board_slug",
    });
}

/** Makes a board (POST /console/communities/:id/boards). */
export async function adminCreate(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const f = boardFields(ctx, argsOf(args));
  await slugFree(ctx, f.slug, null);
  const { rows } = await ctx.sql<BoardRow>`
    INSERT INTO boards (id, name, slug, description, allow_comments, created_at, updated_at)
    VALUES (${uuidv7(ctx.now)}, ${f.name}, ${f.slug}, ${f.description}, ${f.allowComments ?? true}, ${ctx.now}, ${ctx.now})
    RETURNING *`;
  return boardJson(rows[0]);
}

/** Edits a board (PATCH /console/communities/:id/boards/:boardId). */
export async function adminUpdate(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const a = argsOf(args);
  const existing = await boardById(ctx, id(ctx, a.board_id, "board_id"));
  const f = boardFields(ctx, a);
  if (f.slug !== existing.slug) await slugFree(ctx, f.slug, existing.id);
  const { rows } = await ctx.sql<BoardRow>`
    UPDATE boards SET name = ${f.name}, slug = ${f.slug},
      description = ${f.description},
      allow_comments = ${f.allowComments ?? existing.allow_comments === 1},
      updated_at = ${ctx.now}
    WHERE id = ${existing.id} RETURNING *`;
  return boardJson(rows[0]);
}

/** Deletes a board (DELETE /console/communities/:id/boards/:boardId). */
export async function adminDelete(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const existing = await boardById(
    ctx,
    id(ctx, argsOf(args).board_id, "board_id"),
  );
  await ctx.sql`UPDATE boards SET deleted_at = ${ctx.now} WHERE id = ${existing.id}`;
  return null;
}
