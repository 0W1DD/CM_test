// Searching beyond posts (commung's search.service): hashtags.
// Posts themselves are searched by `posts:search`.
import { argsOf, limitOf, type QueryCtx } from "../modules/core.js";

/** Tags on posts that are still up, with how many posts carry each. */
const LIVE_TAGS = `SELECT ph.tag AS tag, count(*) AS n FROM post_hashtags ph
  JOIN posts p ON p.id = ph.post_id AND p.deleted_at IS NULL`;

/**
 * Hashtags starting with `q` (one character or more, `#` optional), the
 * most used first, for the composer's suggestions. Only tags some post
 * still carries.
 */
export async function hashtags(ctx: QueryCtx, args: unknown) {
  const a = argsOf(args);
  const q =
    typeof a.q === "string" ? a.q.trim().replace(/^#/, "").toLowerCase() : "";
  if (q.length < 1) return [];
  const limit = limitOf(a.limit, 10, 50);
  const { rows } = await ctx.sql<{ tag: string; n: number }>(
    `${LIVE_TAGS} WHERE ph.tag >= ? AND ph.tag < ?
     GROUP BY ph.tag ORDER BY n DESC, ph.tag LIMIT ?`,
    [q, `${q}\u{10FFFF}`, limit],
  );
  return rows.map((row) => ({ id: row.tag, tag: row.tag, count: row.n }));
}

/** The most used hashtags, for the search page and an empty `#`. */
export async function popularHashtags(ctx: QueryCtx, args: unknown) {
  const limit = limitOf(argsOf(args).limit, 12, 50);
  const { rows } = await ctx.sql<{ tag: string; n: number }>(
    `${LIVE_TAGS} GROUP BY ph.tag ORDER BY n DESC, ph.tag LIMIT ?`,
    [limit],
  );
  return rows.map((row) => ({ id: row.tag, tag: row.tag, count: row.n }));
}
