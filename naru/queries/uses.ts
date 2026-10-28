// The use log, newest first, for members (mutations/uses.ts writes it).
import { isStaff, requireMembership } from "../modules/access.js";
import {
  argsOf,
  limitOf,
  optionalId,
  type QueryCtx,
  type SqlValue,
} from "../modules/core.js";
import { type ItemUseRow, useJson, viewerOf } from "../modules/item-uses.js";

/**
 * A page of the use log before `cursor`; `pending: true` keeps to the uses
 * not yet confirmed. The staff also get how many wait (`pending_count`).
 */
export async function list(ctx: QueryCtx, args: unknown) {
  const membership = await requireMembership(ctx);
  const staff = isStaff(membership);
  const a = argsOf(args);
  const limit = limitOf(a.limit);
  const cursor = optionalId(ctx, a.cursor, "cursor");
  const conditions: string[] = [];
  const values: SqlValue[] = [];
  if (a.pending === true) conditions.push("approved_at IS NULL");
  if (cursor) {
    conditions.push("id < ?");
    values.push(cursor);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows: read } = await ctx.sql<ItemUseRow>(
    `SELECT * FROM item_uses ${where} ORDER BY id DESC LIMIT ?`,
    [...values, limit + 1],
  );
  const hasMore = read.length > limit;
  const rows = read.slice(0, limit);
  const viewer = await viewerOf(ctx, membership.member, staff);
  let pendingCount: number | null = null;
  if (staff) {
    const { rows: counts } = await ctx.sql<{ n: number }>`
      SELECT count(*) AS n FROM item_uses WHERE approved_at IS NULL`;
    pendingCount = counts[0]?.n ?? 0;
  }
  return {
    data: await useJson(ctx, rows, viewer),
    pagination: {
      next_cursor: hasMore ? (rows[rows.length - 1]?.id ?? null) : null,
      has_more: hasMore,
    },
    staff,
    pending_count: pendingCount,
  };
}
