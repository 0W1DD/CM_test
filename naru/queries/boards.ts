// Boards (commung's /app/boards and the console's board list): members read
// boards, their posts and replies; staff list them for management.
import {
  actingProfile,
  requireMembership,
  requireStaff,
} from "../modules/access.js";
import {
  type BoardRow,
  boardById,
  boardBySlug,
  boardJson,
  boardPost,
  commentsDisabled,
  POST_SELECT,
  type PostRow,
  postJson,
  postNotFound,
  REPLY_SELECT,
  type ReplyRow,
  replyTree,
} from "../modules/boards.js";
import {
  argsOf,
  id,
  iso,
  limitOf,
  list as jsonList,
  optionalId,
  type QueryCtx,
} from "../modules/core.js";

/** The community's boards, oldest first (GET /boards). */
export async function list(ctx: QueryCtx) {
  await requireMembership(ctx);
  return await allBoards(ctx);
}

async function allBoards(ctx: QueryCtx) {
  const { rows } = await ctx.sql<BoardRow>`
    SELECT * FROM boards WHERE deleted_at IS NULL ORDER BY created_at, id`;
  return rows.map(boardJson);
}

/** A board by slug (GET /boards/:slug). */
export async function board(ctx: QueryCtx, args: unknown) {
  await requireMembership(ctx);
  return boardJson(await boardBySlug(ctx, argsOf(args).slug));
}

/** A board's posts, newest first, by cursor (GET /boards/:slug/posts). */
export async function posts(ctx: QueryCtx, args: unknown) {
  const a = argsOf(args);
  await actingProfile(ctx, a.profile_id);
  const found = await boardBySlug(ctx, a.slug);
  const limit = limitOf(a.limit, 20, 100);
  const cursor = optionalId(ctx, a.cursor, "cursor");
  const { rows } = await ctx.sql<PostRow>(
    `${POST_SELECT} WHERE bp.board_id = ? AND bp.deleted_at IS NULL
       AND (? IS NULL OR bp.id < ?)
     ORDER BY bp.id DESC LIMIT ?`,
    [found.id, cursor, cursor, limit + 1],
  );
  const { rows: counts } = await ctx.sql<{ n: number }>`
    SELECT count(*) AS n FROM board_posts
    WHERE board_id = ${found.id} AND deleted_at IS NULL`;
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    data: page.map(postJson),
    pagination: {
      next_cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      has_more: hasMore,
      total_count: counts[0]?.n ?? 0,
    },
  };
}

/** A post with its board (GET /boards/:slug/posts/:postId). */
export async function post(ctx: QueryCtx, args: unknown) {
  await requireMembership(ctx);
  return await boardPost(ctx, id(ctx, argsOf(args).post_id, "post_id"));
}

/**
 * A post's replies (GET /boards/:slug/posts/:postId/replies): top-level
 * replies oldest first by cursor, each with all its replies nested.
 */
export async function replies(ctx: QueryCtx, args: unknown) {
  await requireMembership(ctx);
  const a = argsOf(args);
  const postId = id(ctx, a.post_id, "post_id");
  const { rows: posts } = await ctx.sql<{ allow_comments: number }>`
    SELECT b.allow_comments FROM board_posts bp
    JOIN boards b ON b.id = bp.board_id
    WHERE bp.id = ${postId} AND bp.deleted_at IS NULL`;
  const found = posts[0] ?? postNotFound(ctx);
  if (found.allow_comments !== 1) commentsDisabled(ctx);
  const limit = limitOf(a.limit, 20, 100);
  const cursor = optionalId(ctx, a.cursor, "cursor");
  const { rows: top } = await ctx.sql<ReplyRow>(
    `${REPLY_SELECT} WHERE r.post_id = ? AND r.depth = 0 AND r.deleted_at IS NULL
       AND (? IS NULL OR r.id > ?)
     ORDER BY r.id LIMIT ?`,
    [postId, cursor, cursor, limit + 1],
  );
  const { rows: counts } = await ctx.sql<{ n: number }>`
    SELECT count(*) AS n FROM board_replies
    WHERE post_id = ${postId} AND depth = 0 AND deleted_at IS NULL`;
  const total = counts[0]?.n ?? 0;
  const hasMore = top.length > limit;
  const page = hasMore ? top.slice(0, limit) : top;
  if (!page.length)
    return {
      data: [],
      pagination: { next_cursor: null, has_more: false, total_count: total },
    };
  const { rows: nested } = await ctx.sql<ReplyRow>(
    `${REPLY_SELECT} WHERE r.root_reply_id IN (SELECT value FROM json_each(?))
       AND r.deleted_at IS NULL
     ORDER BY r.created_at, r.id LIMIT 1000`,
    [jsonList(page.map((reply) => reply.id))],
  );
  return {
    data: replyTree([...page, ...nested]),
    pagination: {
      next_cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      has_more: hasMore,
      total_count: total,
    },
  };
}

/**
 * The member's board reply notifications, newest first, with how many are
 * unread (commung's user notifications in the console's feed).
 */
export async function notifications(ctx: QueryCtx, args: unknown) {
  const membership = await requireMembership(ctx);
  const limit = limitOf(argsOf(args).limit, 20, 100);
  const { rows } = await ctx.sql<{
    id: string;
    type: string;
    title: string;
    message: string;
    read_at: number | null;
    created_at: number;
    post_id: string;
    reply_id: string | null;
    board_id: string;
    board_name: string;
    board_slug: string;
    actor_name: string | null;
    actor_picture_url: string | null;
  }>`
    SELECT n.id, n.type, n.title, n.message, n.read_at, n.created_at,
      n.post_id, n.reply_id, b.id AS board_id, b.name AS board_name,
      b.slug AS board_slug, p.name AS actor_name, pic.url AS actor_picture_url
    FROM board_notifications n
    JOIN board_posts bp ON bp.id = n.post_id
    JOIN boards b ON b.id = bp.board_id
    LEFT JOIN profiles p ON p.id = n.actor_profile_id
    LEFT JOIN images pic ON pic.id = p.picture_id
    WHERE n.recipient = ${membership.member}
    ORDER BY n.id DESC LIMIT ${limit}`;
  const { rows: unread } = await ctx.sql<{ n: number }>`
    SELECT count(*) AS n FROM board_notifications
    WHERE recipient = ${membership.member} AND read_at IS NULL`;
  return {
    data: rows.map((row) => ({
      id: row.id,
      source: "user",
      type: row.type,
      title: row.title,
      message: row.message,
      created_at: iso(row.created_at),
      read_at: iso(row.read_at),
      sender: row.actor_name
        ? { name: row.actor_name, profile_picture_url: row.actor_picture_url }
        : null,
      link: `/boards/${row.board_slug}/${row.post_id}`,
      group: {
        kind: "board",
        id: row.board_id,
        name: row.board_name,
        slug: row.board_slug,
      },
    })),
    total_unread: unread[0]?.n ?? 0,
  };
}

/** The boards, for the owner's and moderators' board management. */
export async function adminList(ctx: QueryCtx) {
  await requireStaff(ctx);
  return await allBoards(ctx);
}

/** One board by ID, for management. */
export async function adminBoard(ctx: QueryCtx, args: unknown) {
  await requireStaff(ctx);
  return boardJson(
    await boardById(ctx, id(ctx, argsOf(args).board_id, "board_id")),
  );
}
