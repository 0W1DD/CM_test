// The shop as members see it (commung's /app/shop) and as the owner and
// moderators manage it (the console's community shop).
import {
  actingProfile,
  requireMembership,
  requireStaff,
} from "../modules/access.js";
import {
  argsOf,
  invalid,
  limitOf,
  notFound,
  optionalId,
  type QueryCtx,
} from "../modules/core.js";
import {
  listBalances,
  listCurrencies,
  listInventory,
  listItems,
  listTransactions,
} from "../modules/shop.js";

const USERNAME = /^[a-zA-Z0-9_]{1,50}$/;

/**
 * The shop for the acting profile: currencies, items, its balances and
 * inventory (GET /shop).
 */
export async function summary(ctx: QueryCtx, args: unknown) {
  const profile = await actingProfile(ctx, argsOf(args).profile_id);
  if (profile.activated_at === null)
    notFound(ctx, "프로필을 찾을 수 없습니다.");
  const currencies = await listCurrencies(ctx);
  const items = await listItems(ctx);
  return {
    default_currency: currencies.find((c) => c.isDefault) ?? null,
    currencies,
    items,
    balances: await listBalances(ctx, profile.id),
    inventory: await listInventory(ctx, profile.id),
    has_currency: currencies.length > 0,
    has_items: items.length > 0,
  };
}

/** What a profile owns, by username (GET /shop/inventory/:username). */
export async function inventory(ctx: QueryCtx, args: unknown) {
  await requireMembership(ctx);
  const username = argsOf(args).username;
  if (typeof username !== "string" || !USERNAME.test(username))
    invalid(ctx, "사용자명이 올바르지 않습니다.");
  const { rows } = await ctx.sql<{ id: string }>`
    SELECT id FROM profiles
    WHERE lower(username) = ${username.toLowerCase()}
      AND activated_at IS NOT NULL AND deleted_at IS NULL`;
  const target = rows[0] ?? notFound(ctx, "프로필을 찾을 수 없습니다.");
  return { profile_id: target.id, items: await listInventory(ctx, target.id) };
}

// The console's shop management (owner and moderators read).

export async function adminCurrencies(ctx: QueryCtx) {
  await requireStaff(ctx);
  return await listCurrencies(ctx);
}

export async function adminItems(ctx: QueryCtx) {
  await requireStaff(ctx);
  return await listItems(ctx);
}

/** Active profiles whose username or name holds `q`, for granting. */
export async function adminProfiles(ctx: QueryCtx, args: unknown) {
  await requireStaff(ctx);
  const a = argsOf(args);
  const q =
    typeof a.q === "string" ? a.q.trim().toLowerCase().slice(0, 100) : "";
  const limit = limitOf(a.limit, 10, 50);
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const { rows } = await ctx.sql<{
    id: string;
    name: string;
    username: string;
  }>`
    SELECT id, name, username FROM profiles
    WHERE activated_at IS NOT NULL AND deleted_at IS NULL
      AND (${q} = '' OR lower(username) LIKE ${pattern} ESCAPE '\\'
        OR lower(name) LIKE ${pattern} ESCAPE '\\')
    ORDER BY username LIMIT ${limit}`;
  return rows;
}

/** The shop's transactions, newest first, by cursor. */
export async function adminTransactions(ctx: QueryCtx, args: unknown) {
  await requireStaff(ctx);
  const a = argsOf(args);
  const result = await listTransactions(ctx, {
    limit: limitOf(a.limit, 50, 200),
    cursor: optionalId(ctx, a.cursor, "cursor"),
    profileId: optionalId(ctx, a.profile_id, "profile_id"),
  });
  return {
    data: result.data,
    pagination: { next_cursor: result.nextCursor, has_more: result.hasMore },
  };
}
