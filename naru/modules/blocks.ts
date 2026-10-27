// Blocks between members (commung's user_block): what other areas filter by.
import type { Ctx } from "./core.js";

/** The members the calling member blocked ([] for visitors). */
export async function blockedMembers(ctx: Ctx): Promise<string[]> {
  if (!ctx.member) return [];
  const { rows } = await ctx.sql<{ blocked: string }>`
    SELECT blocked FROM member_blocks WHERE blocker = ${ctx.member.id}
    LIMIT 1000`;
  return rows.map((row) => row.blocked);
}

/** Whether `blocker` blocked `blocked`. */
export async function isBlocked(ctx: Ctx, blocker: string, blocked: string) {
  const { rows } = await ctx.sql`
    SELECT 1 FROM member_blocks WHERE blocker = ${blocker} AND blocked = ${blocked}`;
  return rows.length > 0;
}
