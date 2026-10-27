// Posts as commung's API answered them: rows with their authors, images,
// reactions and the viewer's bookmarks, and reply threads. Naru's SQL refuses
// recursion, so a thread is read whole by root_post_id and walked here, in
// the order commung's recursive queries gave (each level by created_at).
import { bool, type Ctx, iso, list, type SqlValue } from "./core.js";

/** Replies shown under each post in the timeline unless show_all_replies. */
export const TIMELINE_REPLY_LIMIT = 5;

export interface PostRow {
  id: string;
  content: string;
  content_warning: string | null;
  announcement: number;
  author_id: string;
  created_by: string;
  in_reply_to_id: string | null;
  root_post_id: string | null;
  depth: number;
  scheduled_at: number | null;
  published_at: number | null;
  pinned_at: number | null;
  bumped_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  [key: string]: SqlValue;
}

/**
 * Seen by everyone: not deleted, and published or due (a scheduled post is
 * published once its time has come, whether or not a mutation has marked it
 * yet). Posts are aliased `p`; binds `ctx.now` once.
 */
export const VISIBLE =
  "p.deleted_at IS NULL AND (p.published_at IS NOT NULL OR p.scheduled_at <= ?)";

/** A visible post by ID, or null. */
export async function visiblePost(
  ctx: Ctx,
  postId: string,
): Promise<PostRow | null> {
  const { rows } = await ctx.sql<PostRow>(
    `SELECT p.* FROM posts p WHERE p.id = ? AND ${VISIBLE}`,
    [postId, ctx.now],
  );
  return rows[0] ?? null;
}

/**
 * The profile a reader names to see their bookmarks, if the calling member
 * may act as it; null otherwise (a visitor, or someone else's profile).
 */
export async function viewerProfile(
  ctx: Ctx,
  profileId: unknown,
): Promise<string | null> {
  if (!ctx.member || typeof profileId !== "string" || !profileId) return null;
  const { rows } = await ctx.sql<{ profile_id: string }>`
    SELECT profile_id FROM profile_owners
    WHERE profile_id = ${profileId.toLowerCase()} AND member = ${ctx.member.id}`;
  return rows[0]?.profile_id ?? null;
}

export interface Author {
  id: string;
  name: string;
  username: string;
  profile_picture_url: string | null;
}

interface PostImage {
  id: string;
  url: string;
  width: number;
  height: number;
  filename: string;
}

interface Reaction {
  emoji: string;
  user: { id: string; username: string; name: string };
}

export interface PostJson {
  id: string;
  content: string;
  created_at: string | null;
  updated_at: string | null;
  announcement: boolean;
  content_warning: string | null;
  pinned_at: string | null;
  author: Author;
  images: PostImage[];
  in_reply_to_id: string | null;
  depth: number;
  root_post_id: string | null;
  is_bookmarked: boolean;
  replies: PostJson[];
  reply_count: number;
  has_more_replies: boolean;
  reactions: Reaction[];
  [key: string]: unknown;
}

export interface Extras {
  authors: Map<string, Author>;
  images: Map<string, PostImage[]>;
  reactions: Map<string, Reaction[]>;
  bookmarked: Set<string>;
}

const push = <T>(map: Map<string, T[]>, key: string, value: T) => {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
};

/** Authors (with pictures) by profile ID. */
export async function authorsById(ctx: Ctx, ids: readonly string[]) {
  const wanted = [...new Set(ids)];
  if (!wanted.length) return new Map<string, Author>();
  const { rows } = await ctx.sql<Author>`
    SELECT p.id, p.name, p.username, pic.url AS profile_picture_url
    FROM profiles p LEFT JOIN images pic ON pic.id = p.picture_id
    WHERE p.id IN (SELECT value FROM json_each(${list(wanted)}))`;
  return new Map(rows.map((row) => [row.id, row]));
}

/** Everything a post's answer shows besides its own row, for `rows` at once. */
export async function extrasFor(
  ctx: Ctx,
  rows: readonly PostRow[],
  viewer: string | null,
): Promise<Extras> {
  const postIds = list([...new Set(rows.map((row) => row.id))]);
  const extras: Extras = {
    authors: await authorsById(
      ctx,
      rows.map((row) => row.author_id),
    ),
    images: new Map(),
    reactions: new Map(),
    bookmarked: new Set(),
  };
  if (!rows.length) return extras;
  const { rows: images } = await ctx.sql<PostImage & { post_id: string }>`
    SELECT pi.post_id, i.id, i.url, i.width, i.height, i.filename
    FROM post_images pi JOIN images i ON i.id = pi.image_id
    WHERE pi.post_id IN (SELECT value FROM json_each(${postIds}))
      AND i.deleted_at IS NULL
    ORDER BY pi.post_id, pi.position`;
  for (const { post_id, ...image } of images)
    push(extras.images, post_id, image);
  const { rows: reactions } = await ctx.sql<{
    post_id: string;
    emoji: string;
    id: string;
    username: string;
    name: string;
  }>`
    SELECT r.post_id, r.emoji, pr.id, pr.username, pr.name
    FROM post_reactions r JOIN profiles pr ON pr.id = r.profile_id
    WHERE r.post_id IN (SELECT value FROM json_each(${postIds}))
    ORDER BY r.created_at
    LIMIT 1000`;
  for (const { post_id, emoji, id, username, name } of reactions)
    push(extras.reactions, post_id, { emoji, user: { id, username, name } });
  if (viewer) {
    const { rows: bookmarks } = await ctx.sql<{ post_id: string }>`
      SELECT post_id FROM post_bookmarks
      WHERE profile_id = ${viewer}
        AND post_id IN (SELECT value FROM json_each(${postIds}))`;
    for (const { post_id } of bookmarks) extras.bookmarked.add(post_id);
  }
  return extras;
}

const MISSING_AUTHOR: Author = {
  id: "",
  name: "",
  username: "",
  profile_picture_url: null,
};

/** One post as commung answered it, without replies. */
export function postJson(row: PostRow, extras: Extras): PostJson {
  return {
    id: row.id,
    content: row.content,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    announcement: bool(row.announcement),
    content_warning: row.content_warning,
    pinned_at: iso(row.pinned_at),
    author: extras.authors.get(row.author_id) ?? {
      ...MISSING_AUTHOR,
      id: row.author_id,
    },
    images: extras.images.get(row.id) ?? [],
    in_reply_to_id: row.in_reply_to_id,
    depth: row.depth,
    root_post_id: row.root_post_id,
    is_bookmarked: extras.bookmarked.has(row.id),
    replies: [],
    reply_count: 0,
    has_more_replies: false,
    reactions: extras.reactions.get(row.id) ?? [],
  };
}

/** A reply as commung's thread queries answered it (never pinned there). */
const replyJson = (row: PostRow, extras: Extras): PostJson => ({
  ...postJson(row, extras),
  pinned_at: null,
});

/**
 * The visible posts of the threads `roots` start: the roots themselves and
 * every reply under them, oldest first.
 */
export async function threadRows(
  ctx: Ctx,
  roots: readonly string[],
): Promise<PostRow[]> {
  const wanted = list([...new Set(roots)]);
  if (!roots.length) return [];
  const { rows } = await ctx.sql<PostRow>(
    `SELECT p.* FROM posts p
     WHERE (p.root_post_id IN (SELECT value FROM json_each(?))
        OR p.id IN (SELECT value FROM json_each(?)))
       AND ${VISIBLE}
     ORDER BY p.created_at, p.id
     LIMIT 1000`,
    [wanted, wanted, ctx.now],
  );
  return rows;
}

/** Children of each post among `rows`, oldest first. */
export function childrenOf(rows: readonly PostRow[]) {
  const children = new Map<string, PostRow[]>();
  for (const row of rows)
    if (row.in_reply_to_id) push(children, row.in_reply_to_id, row);
  return children;
}

/**
 * The replies under `postId`, depth first (commung's sort_path order):
 * direct replies always, deeper ones while their depth is at most
 * `depthLimit` (a reply past it hides its own replies too).
 */
export function descendants(
  children: Map<string, PostRow[]>,
  postId: string,
  depthLimit = Number.POSITIVE_INFINITY,
): PostRow[] {
  const out: PostRow[] = [];
  const walk = (id: string, top: boolean) => {
    for (const child of children.get(id) ?? []) {
      if (!top && child.depth > depthLimit) continue;
      out.push(child);
      walk(child.id, false);
    }
  };
  walk(postId, true);
  return out;
}

/** Nests flat replies (depth first) under `postId`. */
function nest(flat: readonly PostJson[], postId: string): PostJson[] {
  const byId = new Map(flat.map((reply) => [reply.id, reply]));
  const top: PostJson[] = [];
  for (const reply of flat) {
    if (reply.in_reply_to_id === postId) top.push(reply);
    else if (reply.in_reply_to_id)
      byId.get(reply.in_reply_to_id)?.replies.push(reply);
  }
  return top;
}

export interface ThreadOptions {
  /** Whose bookmarks to mark. */
  viewer: string | null;
  /** Deepest reply (its depth) shown below the first level; commung's 10. */
  depthLimit?: number | ((row: PostRow) => number);
  /** Replies shown under each post, depth first; all when absent. */
  replyLimit?: number;
}

/**
 * `rows` as commung's answers with their threaded replies (`replies`,
 * `reply_count`, `has_more_replies`), in the order given. Also answers the
 * thread rows read, for callers that walk them further (parent_thread).
 */
export async function postsWithReplies(
  ctx: Ctx,
  rows: readonly PostRow[],
  { viewer, depthLimit = 10, replyLimit }: ThreadOptions,
): Promise<{ posts: PostJson[]; thread: PostRow[]; extras: Extras }> {
  const thread = await threadRows(
    ctx,
    rows.map((row) => row.root_post_id ?? row.id),
  );
  const children = childrenOf(thread);
  const shown = new Map<string, { replies: PostRow[]; total: number }>();
  for (const row of rows) {
    const limit =
      typeof depthLimit === "function" ? depthLimit(row) : depthLimit;
    let replies = descendants(children, row.id, limit);
    let total = replies.length;
    if (replyLimit !== undefined) {
      total = descendants(children, row.id).length;
      replies = replies.slice(0, replyLimit);
    }
    shown.set(row.id, { replies, total });
  }
  const all = [...rows, ...[...shown.values()].flatMap((s) => s.replies)];
  const extras = await extrasFor(ctx, all, viewer);
  const posts = rows.map((row) => {
    const { replies, total } = shown.get(row.id) ?? { replies: [], total: 0 };
    const flat = replies.map((reply) => replyJson(reply, extras));
    return {
      ...postJson(row, extras),
      replies: nest(flat, row.id),
      reply_count: total,
      has_more_replies: total > replies.length,
    };
  });
  return { posts, thread, extras };
}

/** Replies' JSON for rows already read (flat, as getPostReplies answered). */
export const flatReplies = (rows: readonly PostRow[], extras: Extras) =>
  rows.map((row) => replyJson(row, extras));

/** The ancestors of `post` among `thread`, root first, up to the first missing one. */
export function ancestors(
  thread: readonly PostRow[],
  post: PostRow,
): PostRow[] {
  const byId = new Map(thread.map((row) => [row.id, row]));
  const out: PostRow[] = [];
  let parentId = post.in_reply_to_id;
  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent) break;
    out.unshift(parent);
    parentId = parent.in_reply_to_id;
  }
  return out;
}

/** The first `limit` of `rows` (read with one more), and whether there are more. */
export function firstOf<T>(rows: readonly T[], limit: number) {
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
}

/** A cursor-paged answer, as commung's lists answered. */
export function page<T, R>(
  data: readonly T[],
  last: R | undefined,
  hasMore: boolean,
  cursorOf: (last: R) => string,
  totalCount?: number,
) {
  return {
    data: [...data],
    pagination: {
      next_cursor: hasMore && last !== undefined ? cursorOf(last) : null,
      has_more: hasMore,
      ...(totalCount === undefined ? {} : { total_count: totalCount }),
    },
  };
}
