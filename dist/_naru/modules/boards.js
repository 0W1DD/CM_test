// Boards (commung's community-board.service): titled posts in named boards,
// with threaded replies, as commung's API answered them.
import { bool, iso } from "./core.js";
export const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
export const boardJson = (board) => ({
    id: board.id,
    name: board.name,
    slug: board.slug,
    description: board.description,
    allow_comments: bool(board.allow_comments),
    created_at: iso(board.created_at),
    updated_at: iso(board.updated_at),
});
export function boardNotFound(ctx) {
    return ctx.fail("NOT_FOUND", "게시판을 찾을 수 없습니다.", {
        reason: "board_not_found",
    });
}
export function postNotFound(ctx) {
    return ctx.fail("NOT_FOUND", "게시글을 찾을 수 없습니다.", {
        reason: "post_not_found",
    });
}
export function replyNotFound(ctx, message = "댓글을 찾을 수 없습니다.") {
    return ctx.fail("NOT_FOUND", message, { reason: "reply_not_found" });
}
export function commentsDisabled(ctx) {
    return ctx.fail("ACCESS_DENIED", "이 게시판은 댓글을 쓸 수 없습니다.", {
        reason: "comments_disabled",
    });
}
/** A live board by slug; refuses a missing one. */
export async function boardBySlug(ctx, slug) {
    if (typeof slug !== "string" || !slug)
        boardNotFound(ctx);
    const { rows } = await ctx.sql `
    SELECT * FROM boards WHERE slug = ${slug} AND deleted_at IS NULL`;
    return rows[0] ?? boardNotFound(ctx);
}
/** A live board by ID; refuses a missing one. */
export async function boardById(ctx, boardId) {
    const { rows } = await ctx.sql `
    SELECT * FROM boards WHERE id = ${boardId} AND deleted_at IS NULL`;
    return rows[0] ?? boardNotFound(ctx);
}
/** Columns for an author (`p`) with their picture (`pic`), as `authorJson` reads. */
export const AUTHOR_COLUMNS = `p.id AS author_id, p.name AS author_name,
  p.username AS author_username, pic.id AS picture_id, pic.url AS picture_url,
  pic.width AS picture_width, pic.height AS picture_height`;
export const AUTHOR_JOIN = "LEFT JOIN images pic ON pic.id = p.picture_id";
export const authorJson = (row) => ({
    id: row.author_id,
    name: row.author_name,
    username: row.author_username,
    profile_picture: row.picture_id && row.picture_url
        ? {
            id: row.picture_id,
            url: row.picture_url,
            width: row.picture_width ?? 0,
            height: row.picture_height ?? 0,
        }
        : null,
});
/** A board post's row with its author and image; `bp` is the post. */
export const POST_SELECT = `SELECT bp.id, bp.board_id, bp.title, bp.content,
  bp.image_id, img.url AS image_url, img.width AS image_width,
  img.height AS image_height, img.filename AS image_filename, bp.created_at,
  bp.updated_at, ${AUTHOR_COLUMNS}
  FROM board_posts bp JOIN profiles p ON p.id = bp.author_id ${AUTHOR_JOIN}
  LEFT JOIN images img ON img.id = bp.image_id`;
export const postJson = (row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    image: row.image_id && row.image_url
        ? {
            id: row.image_id,
            url: row.image_url,
            width: row.image_width ?? 0,
            height: row.image_height ?? 0,
            filename: row.image_filename ?? "",
        }
        : null,
    author: authorJson(row),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
});
/** A live board post with its board, as commung's single post answered. */
export async function boardPost(ctx, postId) {
    const { rows } = await ctx.sql(`${POST_SELECT} WHERE bp.id = ? AND bp.deleted_at IS NULL`, [postId]);
    const post = rows[0] ?? postNotFound(ctx);
    const { rows: boards } = await ctx.sql `
    SELECT * FROM boards WHERE id = ${post.board_id}`;
    const board = boards[0];
    return {
        ...postJson(post),
        board: {
            id: board.id,
            name: board.name,
            slug: board.slug,
            allow_comments: bool(board.allow_comments),
        },
    };
}
export const REPLY_SELECT = `SELECT r.id, r.content, r.in_reply_to_id, r.depth,
  r.created_at, r.updated_at, ${AUTHOR_COLUMNS}
  FROM board_replies r JOIN profiles p ON p.id = r.author_id ${AUTHOR_JOIN}`;
/** Replies as commung's nested tree: each with its own replies under it. */
export function replyTree(rows) {
    const nodes = new Map();
    for (const row of rows)
        nodes.set(row.id, {
            id: row.id,
            content: row.content,
            depth: row.depth,
            author: authorJson(row),
            created_at: iso(row.created_at),
            updated_at: iso(row.updated_at),
            replies: [],
        });
    const roots = [];
    for (const row of rows) {
        const node = nodes.get(row.id);
        if (row.in_reply_to_id)
            nodes.get(row.in_reply_to_id)?.replies.push(node);
        else
            roots.push(node);
    }
    return roots;
}
