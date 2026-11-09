// A profile's collection (도감) of what its random boxes gave, against the
// whole list (modules/boxes.ts), for any member to look at.
import { requireMembership } from "../modules/access.js";
import { BOX_ENTRIES, BOX_ITEMS } from "../modules/boxes.js";
import { argsOf, id, iso, type QueryCtx } from "../modules/core.js";

/**
 * Every category with its entries, each with how many times this profile
 * got it (0 when not yet), and the most recent ones first in `recent`.
 */
export async function collection(ctx: QueryCtx, args: unknown) {
  await requireMembership(ctx);
  const profileId = id(ctx, argsOf(args).profile_id, "profile_id");
  const { rows } = await ctx.sql<{
    entry: string;
    count: number;
    first_at: number;
    last_at: number;
  }>`
    SELECT entry, count, first_at, last_at FROM box_collection
    WHERE profile_id = ${profileId} ORDER BY last_at DESC LIMIT 1000`;
  const got = new Map(rows.map((r) => [r.entry, r]));
  return {
    total: BOX_ENTRIES.length,
    collected: rows.length,
    recent: rows.slice(0, 50).map((r) => ({
      entry: r.entry,
      count: r.count,
      last_at: iso(r.last_at),
    })),
    categories: Object.entries(BOX_ITEMS).map(([name, entries]) => ({
      name,
      entries: entries.map((entry) => ({
        entry,
        count: got.get(entry)?.count ?? 0,
      })),
    })),
  };
}
