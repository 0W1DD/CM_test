// Reading posts: commung's GET /app/posts, /posts/:id (+ replies, history),
// /announcements, /bookmarks, /scheduled-posts, /posts/search and
// /profiles/:username/posts.
import { actingProfile, requireMembership, requireOwner, } from "../modules/access.js";
import { settingsOf } from "../modules/community.js";
import { argsOf, id, iso, limitOf, list as jsonList, notFound, invalid, msOf, } from "../modules/core.js";
import { imagesById } from "../modules/images.js";
import { purgeWhere } from "../modules/posts.js";
import { ancestors, authorsById, childrenOf, descendants, extrasFor, firstOf, flatReplies, page, postJson, postsWithReplies, TIMELINE_REPLY_LIMIT, threadRows, VISIBLE, viewerProfile, visiblePost, } from "../modules/post-data.js";
const cursorOf = (value) => typeof value === "string" && value ? value : null;
async function countOf(ctx, where, values) {
    const { rows } = await ctx.sql(`SELECT count(*) AS n FROM posts p WHERE ${where}`, values);
    return rows[0]?.n ?? 0;
}
/**
 * The timeline (GET /app/posts): root posts newest first, each with its
 * first replies (all of them when the community shows all replies). When
 * the community "bumps on reply", replies are not hidden under old posts
 * nor do they drag old posts back to the top: every post and reply takes
 * its own place, newest first, a reply with a summary of what it answers,
 * so who is talking with whom right now reads from the timeline.
 */
export async function list(ctx, args) {
    const a = argsOf(args);
    const limit = limitOf(a.limit);
    const cursor = cursorOf(a.cursor);
    const viewer = await viewerProfile(ctx, a.profile_id);
    const settings = await settingsOf(ctx);
    const flat = settings?.bump_on_reply === 1;
    const base = flat ? VISIBLE : `p.depth = 0 AND ${VISIBLE}`;
    let where = base;
    const values = [ctx.now];
    if (cursor) {
        where += " AND p.id < ?";
        values.push(cursor);
    }
    const { rows: read } = await ctx.sql(`SELECT p.* FROM posts p WHERE ${where} ORDER BY p.id DESC LIMIT ?`, [...values, limit + 1]);
    const total = await countOf(ctx, base, [ctx.now]);
    const { rows, hasMore } = firstOf(read, limit);
    const { posts } = await postsWithReplies(ctx, rows, {
        viewer,
        replyLimit: flat
            ? 0
            : settings?.show_all_replies === 1
                ? undefined
                : TIMELINE_REPLY_LIMIT,
    });
    const summaries = flat
        ? await parentSummaries(ctx, rows)
        : new Map();
    return page(posts.map((post) => ({
        ...post,
        parent_summary: post.in_reply_to_id
            ? (summaries.get(post.in_reply_to_id) ?? null)
            : null,
    })), rows[rows.length - 1], hasMore, (last) => last.id, total);
}
/**
 * What the timeline shows has changed when this does: the newest visible
 * post, the top of the timeline and how many posts there are. Pages
 * subscribe to it and reload the timeline, instead of commung's polling.
 */
export async function latest(ctx) {
    const settings = await settingsOf(ctx);
    const bump = settings?.bump_on_reply === 1;
    const { rows } = await ctx.sql(`SELECT p.id, p.bumped_at FROM posts p
     WHERE ${bump ? "" : "p.depth = 0 AND "}${VISIBLE}
     ORDER BY p.id DESC LIMIT 1`, [ctx.now]);
    const { rows: counts } = await ctx.sql(`SELECT count(*) AS n, max(p.id) AS last_id FROM posts p WHERE ${VISIBLE}`, [ctx.now]);
    return {
        top_id: rows[0]?.id ?? null,
        top_bumped_at: iso(rows[0]?.bumped_at),
        last_id: counts[0]?.last_id ?? null,
        count: counts[0]?.n ?? 0,
    };
}
/** A post with its replies and the posts it replies to (GET /app/posts/:post_id). */
export async function get(ctx, args) {
    const a = argsOf(args);
    const postId = id(ctx, a.post_id, "post_id");
    const post = await visiblePost(ctx, postId);
    if (!post)
        notFound(ctx, "게시물을 찾을 수 없습니다");
    const viewer = await viewerProfile(ctx, a.profile_id);
    const { posts, thread } = await postsWithReplies(ctx, [post], {
        viewer,
        depthLimit: post.depth + 100,
    });
    const parents = ancestors(thread, post);
    const parentExtras = await extrasFor(ctx, parents, viewer);
    return {
        ...posts[0],
        parent_thread: flatReplies(parents, parentExtras),
    };
}
/** A post's replies, flat and depth first, a page at a time (GET /app/posts/:post_id/replies). */
export async function replies(ctx, args) {
    const a = argsOf(args);
    const postId = id(ctx, a.post_id, "post_id");
    const limit = limitOf(a.limit);
    const cursor = cursorOf(a.cursor);
    const post = await visiblePost(ctx, postId);
    if (!post)
        notFound(ctx, "게시물을 찾을 수 없습니다");
    const viewer = await viewerProfile(ctx, a.profile_id);
    const thread = await threadRows(ctx, [post.root_post_id ?? post.id]);
    const all = descendants(childrenOf(thread), post.id, post.depth + 100);
    let start = 0;
    if (cursor) {
        const at = all.findIndex((row) => row.id === cursor);
        start = at < 0 ? all.length : at + 1;
    }
    const { rows, hasMore } = firstOf(all.slice(start), limit);
    const extras = await extrasFor(ctx, rows, viewer);
    return page(flatReplies(rows, extras), rows[rows.length - 1], hasMore, (last) => last.id, all.length);
}
/** A post's earlier versions, newest first (GET /app/posts/:post_id/history). */
export async function history(ctx, args) {
    const a = argsOf(args);
    const postId = id(ctx, a.post_id, "post_id");
    if (!(await visiblePost(ctx, postId)))
        notFound(ctx, "게시물을 찾을 수 없습니다");
    const { rows } = await ctx.sql `SELECT * FROM post_history WHERE post_id = ${postId}
     ORDER BY edited_at DESC LIMIT 200`;
    const imageIdsOf = (json) => {
        try {
            const value = JSON.parse(json);
            return Array.isArray(value) ? value.map(String) : [];
        }
        catch {
            return [];
        }
    };
    const images = await imagesById(ctx, rows.flatMap((row) => imageIdsOf(row.image_ids)));
    const editors = await authorsById(ctx, rows.map((row) => row.edited_by_profile_id));
    return rows.map((row) => ({
        id: row.id,
        content: row.content,
        content_warning: row.content_warning,
        edited_at: iso(row.edited_at),
        edited_by: editors.get(row.edited_by_profile_id) ?? {
            id: row.edited_by_profile_id,
            name: "",
            username: "",
            profile_picture_url: null,
        },
        images: imageIdsOf(row.image_ids).flatMap((imageId) => {
            const image = images.get(imageId);
            return image
                ? [
                    {
                        id: image.id,
                        url: image.url,
                        width: image.width,
                        height: image.height,
                        filename: image.filename,
                    },
                ]
                : [];
        }),
    }));
}
/** The community's announcements, newest first, with their replies (GET /app/announcements). */
export async function announcements(ctx, args) {
    const a = argsOf(args);
    const viewer = await viewerProfile(ctx, a.profile_id);
    const { rows } = await ctx.sql(`SELECT p.* FROM posts p WHERE p.announcement = 1 AND p.depth = 0 AND ${VISIBLE}
     ORDER BY p.created_at DESC LIMIT 100`, [ctx.now]);
    const { posts } = await postsWithReplies(ctx, rows, { viewer });
    return posts.map((post) => ({ ...post, announcement: true }));
}
/** The profile's bookmarked posts, latest bookmark first (GET /app/bookmarks). */
export async function bookmarks(ctx, args) {
    const a = argsOf(args);
    const profile = await actingProfile(ctx, a.profile_id);
    const limit = limitOf(a.limit);
    const cursor = cursorOf(a.cursor);
    let where = "b.profile_id = ? AND p.deleted_at IS NULL";
    const values = [profile.id];
    if (cursor) {
        const [at, postId] = cursor.split("|");
        if (at && postId) {
            where += " AND (b.created_at, b.post_id) < (?, ?)";
            values.push(Number(at), postId);
        }
    }
    const { rows: read } = await ctx.sql(`SELECT p.*, b.created_at AS bookmarked_at
     FROM post_bookmarks b JOIN posts p ON p.id = b.post_id
     WHERE ${where}
     ORDER BY b.created_at DESC, b.post_id DESC LIMIT ?`, [...values, limit + 1]);
    const { rows, hasMore } = firstOf(read, limit);
    const extras = await extrasFor(ctx, rows, null);
    return page(rows.map((row) => ({
        ...postJson(row, extras),
        is_bookmarked: true,
        bookmarked_at: iso(row.bookmarked_at),
    })), rows[rows.length - 1], hasMore, (last) => `${last.bookmarked_at}|${last.id}`);
}
/** The profile's posts waiting for their time (GET /app/scheduled-posts). */
export async function scheduled(ctx, args) {
    const a = argsOf(args);
    await requireMembership(ctx);
    const profile = await actingProfile(ctx, a.profile_id);
    if (profile.activated_at === null)
        notFound(ctx, "프로필을 찾을 수 없습니다");
    const limit = limitOf(a.limit);
    const cursor = cursorOf(a.cursor);
    const base = `p.author_id = ? AND p.deleted_at IS NULL AND p.published_at IS NULL
    AND p.scheduled_at > ?`;
    const values = [profile.id, ctx.now];
    const { rows: read } = await ctx.sql(`SELECT p.* FROM posts p WHERE ${base} ${cursor ? "AND p.id < ?" : ""}
     ORDER BY p.id DESC LIMIT ?`, [...values, ...(cursor ? [cursor] : []), limit + 1]);
    const total = await countOf(ctx, base, values);
    const { rows, hasMore } = firstOf(read, limit);
    const extras = await extrasFor(ctx, rows, null);
    return page(rows.map((row) => ({
        ...postJson(row, extras),
        scheduled_at: iso(row.scheduled_at),
        published_at: iso(row.published_at),
        is_bookmarked: false,
    })), rows[rows.length - 1], hasMore, (last) => last.id, total);
}
/**
 * A profile's posts, pinned first, then newest first, with their first
 * replies and, for replies, a summary of the post replied to
 * (GET /app/profiles/:username/posts). `kind` "posts" keeps to the posts
 * that start a thread, "replies" to the replies; both when absent.
 */
export async function byProfile(ctx, args) {
    const a = argsOf(args);
    const username = typeof a.username === "string" ? a.username.replace(/^@/, "") : "";
    const limit = limitOf(a.limit);
    const cursor = cursorOf(a.cursor);
    const { rows: profiles } = await ctx.sql `
    SELECT id FROM profiles
    WHERE lower(username) = lower(${username})
      AND activated_at IS NOT NULL AND deleted_at IS NULL`;
    const profile = profiles[0];
    if (!profile)
        notFound(ctx, "프로필을 찾을 수 없습니다");
    const viewer = await viewerProfile(ctx, a.profile_id);
    const kind = a.kind === "posts"
        ? " AND p.depth = 0"
        : a.kind === "replies"
            ? " AND p.depth > 0"
            : "";
    const base = `p.author_id = ? AND ${VISIBLE}${kind}`;
    let where = base;
    const values = [profile.id, ctx.now];
    // Pinned posts come first, so the cursor says which part the last one was in.
    const [part, at, last] = (cursor ?? "").split("|");
    if (part === "p" && at && last) {
        where +=
            " AND ((p.pinned_at IS NOT NULL AND (p.pinned_at < ? OR (p.pinned_at = ? AND p.id < ?))) OR p.pinned_at IS NULL)";
        values.push(Number(at), Number(at), last);
    }
    else if (part === "u" && at) {
        where += " AND p.pinned_at IS NULL AND p.id < ?";
        values.push(at);
    }
    const { rows: read } = await ctx.sql(`SELECT p.* FROM posts p WHERE ${where}
     ORDER BY p.pinned_at IS NULL, p.pinned_at DESC, p.id DESC LIMIT ?`, [...values, limit + 1]);
    const total = await countOf(ctx, base, [profile.id, ctx.now]);
    const { rows, hasMore } = firstOf(read, limit);
    const { posts } = await postsWithReplies(ctx, rows, {
        viewer,
        replyLimit: TIMELINE_REPLY_LIMIT,
    });
    const summaries = await parentSummaries(ctx, rows);
    return page(posts.map((post) => ({
        ...post,
        parent_summary: post.in_reply_to_id
            ? (summaries.get(post.in_reply_to_id) ?? null)
            : null,
    })), rows[rows.length - 1], hasMore, (row) => row.pinned_at !== null ? `p|${row.pinned_at}|${row.id}` : `u|${row.id}`, total);
}
/** A short summary of each reply's parent, by the parent's ID. */
async function parentSummaries(ctx, rows) {
    const parentIds = [
        ...new Set(rows.flatMap((row) => row.in_reply_to_id ?? [])),
    ];
    const summaries = new Map();
    if (!parentIds.length)
        return summaries;
    const { rows: parents } = await ctx.sql `SELECT p.id, p.content, p.author_id, pr.name, pr.username
     FROM posts p JOIN profiles pr ON pr.id = p.author_id
     WHERE p.id IN (SELECT value FROM json_each(${jsonList(parentIds)}))
       AND p.deleted_at IS NULL`;
    for (const parent of parents) {
        const trimmed = parent.content.trim();
        summaries.set(parent.id, {
            id: parent.id,
            content_excerpt: trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed,
            author: {
                id: parent.author_id,
                name: parent.name,
                username: parent.username,
            },
        });
    }
    return summaries;
}
/** FTS5 phrase for `text` in the content column. */
const phrase = (text) => `content : "${text.replace(/"/g, '""')}"`;
/**
 * Posts and replies whose text holds `q` (GET /app/posts/search), newest
 * first: two characters by LIKE, three or more by the trigram index; `#tag`
 * by hashtag. `@username` in front keeps to that profile's posts (alone,
 * all of them), and `kind` "posts" or "replies" to one of the two. Replies
 * carry a summary of the post they answer, so a conversation can be found
 * without going through profiles.
 */
export async function search(ctx, args) {
    const a = argsOf(args);
    await requireMembership(ctx);
    const q = typeof a.q === "string" ? a.q.trim() : "";
    const limit = limitOf(a.limit);
    const cursor = cursorOf(a.cursor);
    if (q.length < 2)
        return {
            data: [],
            pagination: { next_cursor: null, has_more: false, total_count: 0 },
        };
    const viewer = await viewerProfile(ctx, a.profile_id);
    const conditions = [VISIBLE];
    const values = [ctx.now];
    const author = /^@([A-Za-z0-9_]+)(?:\s+([\s\S]*))?$/.exec(q);
    const text = author ? (author[2] ?? "").trim() : q;
    if (author) {
        conditions.push("p.author_id IN (SELECT id FROM profiles WHERE lower(username) = lower(?))");
        values.push(author[1] ?? "");
    }
    if (a.kind === "posts")
        conditions.push("p.depth = 0");
    else if (a.kind === "replies")
        conditions.push("p.depth > 0");
    if (/^#[\p{L}\p{N}_]+$/u.test(text)) {
        conditions.push("p.id IN (SELECT post_id FROM post_hashtags WHERE tag = ?)");
        values.push(text.slice(1).toLowerCase());
    }
    else if (text.length >= 3) {
        conditions.push("p.id IN (SELECT post_id FROM posts_search WHERE posts_search MATCH ?)");
        values.push(phrase(text));
    }
    else if (text) {
        conditions.push("p.content LIKE ? ESCAPE '\\'");
        values.push(`%${text.replace(/[\\%_]/g, "\\$&")}%`);
    }
    const base = conditions.join(" AND ");
    const { rows: read } = await ctx.sql(`SELECT p.* FROM posts p WHERE ${base} ${cursor ? "AND p.id < ?" : ""}
     ORDER BY p.id DESC LIMIT ?`, [...values, ...(cursor ? [cursor] : []), limit + 1]);
    const total = await countOf(ctx, base, values);
    const { rows, hasMore } = firstOf(read, limit);
    const { posts } = await postsWithReplies(ctx, rows, {
        viewer,
        replyLimit: TIMELINE_REPLY_LIMIT,
    });
    const summaries = await parentSummaries(ctx, rows);
    return page(posts.map((post) => ({
        ...post,
        parent_summary: post.in_reply_to_id
            ? (summaries.get(post.in_reply_to_id) ?? null)
            : null,
    })), rows[rows.length - 1], hasMore, (last) => last.id, total);
}
/**
 * How many posts a timeline clean-up before `before` would take, replies
 * under them included (the owner, before confirming).
 */
export async function purgeCount(ctx, args) {
    await requireOwner(ctx);
    const a = argsOf(args);
    const before = msOf(ctx, a.before, "before");
    if (before === null)
        invalid(ctx, "날짜를 골라 주세요.");
    const { where, values } = purgeWhere(before, a.keep_announcements !== false);
    const { rows } = await ctx.sql(`SELECT count(*) AS n FROM posts WHERE ${where}`, values);
    return { count: rows[0]?.n ?? 0 };
}
