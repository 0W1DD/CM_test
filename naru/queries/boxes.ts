// The community's book (도감) of the random box's list (modules/boxes.ts):
// every category with what has been registered in it and by whom.
import { requireMembership } from "../modules/access.js";
import { BOX_ENTRIES, BOX_ITEMS } from "../modules/boxes.js";
import { iso, type QueryCtx } from "../modules/core.js";

// The list's entries, to count only what is still on it.
const LISTED = new Set(BOX_ENTRIES.map((e) => e.entry));

export async function collection(ctx: QueryCtx) {
  await requireMembership(ctx);
  const { rows } = await ctx.sql<{
    entry: string;
    registered_at: number;
    profile_id: string;
    name: string | null;
    username: string | null;
  }>`
    SELECT r.entry, r.registered_at, r.profile_id, p.name, p.username
    FROM box_registry r LEFT JOIN profiles p ON p.id = r.profile_id
    ORDER BY r.registered_at DESC LIMIT 1000`;
  const found = new Map(rows.map((r) => [r.entry, r]));
  return {
    total: BOX_ENTRIES.length,
    registered: rows.filter((r) => LISTED.has(r.entry)).length,
    latest_at: rows[0] ? iso(rows[0].registered_at) : null,
    categories: Object.entries(BOX_ITEMS).map(([name, entries]) => ({
      name,
      total: entries.length,
      entries: entries.flatMap((entry) => {
        const r = found.get(entry);
        return r
          ? [
              {
                entry,
                registered_at: iso(r.registered_at),
                by: r.name ? { name: r.name, username: r.username } : null,
              },
            ]
          : [];
      }),
    })),
  };
}
