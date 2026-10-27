// Searching beyond posts (commung's search.service): hashtags by prefix.
// Posts themselves are searched by `posts:search`.
import { argsOf, limitOf, type QueryCtx } from "../modules/core.js";

/** Hashtags starting with `q` (two characters or more), alphabetically. */
export async function hashtags(ctx: QueryCtx, args: unknown) {
  const a = argsOf(args);
  const q =
    typeof a.q === "string" ? a.q.trim().replace(/^#/, "").toLowerCase() : "";
  if (q.length < 2) return [];
  const limit = limitOf(a.limit, 10, 50);
  const { rows } = await ctx.sql<{ tag: string }>`
    SELECT tag FROM hashtags
    WHERE tag >= ${q} AND tag < ${`${q}\u{10FFFF}`}
    ORDER BY tag LIMIT ${limit}`;
  return rows.map((row) => ({ id: row.tag, tag: row.tag }));
}
