// Every coloured nickname still within its week, by profile ID: one small
// call shared by all names (like badges:featured).
import type { QueryCtx } from "../modules/core.js";

export async function all(ctx: QueryCtx) {
  const { rows } = await ctx.sql<{
    profile_id: string;
    color: string;
    until: number;
  }>`
    SELECT profile_id, color, until FROM name_colors WHERE until > ${ctx.now}`;
  const out: Record<string, { color: string; until: string }> = {};
  for (const r of rows)
    out[r.profile_id] = {
      color: r.color,
      until: new Date(r.until).toISOString(),
    };
  return out;
}
