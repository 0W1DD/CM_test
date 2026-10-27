// Buying (commung's /app/shop/buy) and the owner's shop management (the
// console's community shop). Each call is one transaction: a refused
// purchase or grant writes nothing.
import { actingProfile, requireOwner } from "../modules/access.js";
import {
  argsOf,
  type Ctx,
  id,
  ids,
  invalid,
  type MutationCtx,
  notFound,
} from "../modules/core.js";
import {
  createCurrency,
  createItem,
  deleteCurrency,
  deleteItem,
  failShop,
  grantCurrency,
  grantItem,
  grantMany,
  type ItemParams,
  MAX_AMOUNT,
  purchaseItem,
  revoke,
  updateCurrency,
  updateItem,
} from "../modules/shop.js";

/** Buys one item for the acting profile (POST /shop/buy). */
export async function buy(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await actingProfile(ctx, a.profile_id);
  if (profile.activated_at === null)
    notFound(ctx, "프로필을 찾을 수 없습니다.");
  const itemId = id(ctx, a.item_id, "item_id");
  const item = await failShop(ctx, () =>
    purchaseItem(ctx, {
      profileId: profile.id,
      itemId,
      actor: profile.membership.member,
    }),
  );
  return { item };
}

// Argument checks as the console's schemas made them.

function optionalString(ctx: Ctx, value: unknown, field: string, max: number) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length < 1 || value.length > max)
    invalid(ctx, `${field} 값이 올바르지 않습니다.`);
  return value;
}

function optionalNullableString(
  ctx: Ctx,
  value: unknown,
  field: string,
  max: number,
) {
  if (value === undefined || value === null) return value as undefined | null;
  if (typeof value !== "string" || value.length > max)
    invalid(ctx, `${field}은(는) ${max}자 이하여야 합니다.`);
  return value;
}

function optionalBoolean(ctx: Ctx, value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean")
    invalid(ctx, `${field} 값이 올바르지 않습니다.`);
  return value;
}

function optionalInt(ctx: Ctx, value: unknown, field: string, max: number) {
  if (value === undefined) return undefined;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > max
  )
    invalid(ctx, `${field}은(는) 1 이상 ${max} 이하의 정수여야 합니다.`);
  return value;
}

function nothingToChange(ctx: Ctx, values: Record<string, unknown>) {
  if (Object.values(values).every((v) => v === undefined))
    invalid(ctx, "변경할 필드가 없습니다");
}

export async function adminCreateCurrency(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const a = argsOf(args);
  const name = optionalString(ctx, a.name, "통화 이름", 50);
  if (name === undefined) invalid(ctx, "통화 이름을(를) 입력해 주세요.");
  return await failShop(ctx, () =>
    createCurrency(ctx, {
      name,
      description:
        optionalNullableString(ctx, a.description, "통화 설명", 500) ?? null,
      isDefault: optionalBoolean(ctx, a.is_default, "is_default"),
    }),
  );
}

export async function adminUpdateCurrency(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const a = argsOf(args);
  const currencyId = id(ctx, a.currency_id, "currency_id");
  const params = {
    name: optionalString(ctx, a.name, "통화 이름", 50),
    description: optionalNullableString(ctx, a.description, "통화 설명", 500),
    isDefault: optionalBoolean(ctx, a.is_default, "is_default"),
  };
  nothingToChange(ctx, params);
  return await failShop(ctx, () => updateCurrency(ctx, currencyId, params));
}

export async function adminDeleteCurrency(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const currencyId = id(ctx, argsOf(args).currency_id, "currency_id");
  await failShop(ctx, () => deleteCurrency(ctx, currencyId));
  return null;
}

function itemParams(ctx: Ctx, a: Record<string, unknown>): ItemParams {
  return {
    name: optionalString(ctx, a.name, "상품 이름", 100),
    description: optionalNullableString(ctx, a.description, "상품 설명", 1000),
    priceAmount: optionalInt(ctx, a.price_amount, "가격", MAX_AMOUNT),
    currencyId:
      a.currency_id === undefined
        ? undefined
        : id(ctx, a.currency_id, "currency_id"),
    consumable: optionalBoolean(ctx, a.consumable, "consumable"),
    isUnique: optionalBoolean(ctx, a.is_unique, "is_unique"),
  };
}

export async function adminCreateItem(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const p = itemParams(ctx, argsOf(args));
  if (p.name === undefined) invalid(ctx, "상품 이름을(를) 입력해 주세요.");
  if (p.priceAmount === undefined)
    invalid(ctx, "가격은 1 이상의 정수여야 합니다");
  if (p.currencyId === undefined) invalid(ctx, "통화를 선택해 주세요.");
  const { name, priceAmount, currencyId } = p;
  return await failShop(ctx, () =>
    createItem(ctx, {
      ...p,
      name,
      priceAmount,
      currencyId,
      description: p.description ?? null,
    }),
  );
}

export async function adminUpdateItem(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const a = argsOf(args);
  const itemId = id(ctx, a.item_id, "item_id");
  const p = itemParams(ctx, a);
  nothingToChange(ctx, { ...p });
  return await failShop(ctx, () => updateItem(ctx, itemId, p));
}

export async function adminDeleteItem(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const itemId = id(ctx, argsOf(args).item_id, "item_id");
  await failShop(ctx, () => deleteItem(ctx, itemId));
  return null;
}

/**
 * Grants a profile currency (`kind` "currency": currency_id, amount) or an
 * item (`kind` "item": item_id, qty), with an optional reason.
 */
export async function adminGrant(ctx: MutationCtx, args: unknown) {
  const membership = await requireOwner(ctx);
  const a = argsOf(args);
  const profileId = id(ctx, a.profile_id, "profile_id");
  const reason = optionalNullableString(ctx, a.reason, "사유", 500) ?? null;
  if (a.kind === "currency") {
    const currencyId = id(ctx, a.currency_id, "currency_id");
    const amount = optionalInt(ctx, a.amount, "수량", MAX_AMOUNT);
    if (amount === undefined) invalid(ctx, "수량은 1 이상의 정수여야 합니다");
    await failShop(ctx, () =>
      grantCurrency(ctx, {
        profileId,
        currencyId,
        amount,
        source: "owner_grant",
        actor: membership.member,
        reason,
      }),
    );
  } else if (a.kind === "item") {
    const itemId = id(ctx, a.item_id, "item_id");
    const qty = optionalInt(ctx, a.qty, "수량", 1000);
    await failShop(ctx, () =>
      grantItem(ctx, {
        profileId,
        itemId,
        qty,
        source: "owner_grant",
        actor: membership.member,
        reason,
      }),
    );
  } else invalid(ctx, "kind 값이 올바르지 않습니다.");
  return null;
}

/** The currency (amount) or item (qty) a grant or revoke names. */
function adjustmentOf(ctx: MutationCtx, a: Record<string, unknown>) {
  if (a.kind === "currency") {
    const currencyId = id(ctx, a.currency_id, "currency_id");
    const amount = optionalInt(ctx, a.amount, "수량", MAX_AMOUNT);
    if (amount === undefined) invalid(ctx, "수량은 1 이상의 정수여야 합니다");
    return { kind: "currency" as const, currencyId, amount };
  }
  if (a.kind === "item") {
    const itemId = id(ctx, a.item_id, "item_id");
    const qty = optionalInt(ctx, a.qty, "수량", 1000) ?? 1;
    return { kind: "item" as const, itemId, qty };
  }
  return invalid(ctx, "kind 값이 올바르지 않습니다.");
}

/**
 * Grants currency or an item to many profiles at once: `profile_ids`, or
 * every member profile with `all: true` (starting coins, attendance). Answers
 * `{ count }`, how many profiles it reached.
 */
export async function adminGrantMany(ctx: MutationCtx, args: unknown) {
  const membership = await requireOwner(ctx);
  const a = argsOf(args);
  const reason = optionalNullableString(ctx, a.reason, "사유", 500) ?? null;
  const profileIds =
    a.all === true ? null : ids(ctx, a.profile_ids, "profile_ids");
  if (profileIds && profileIds.length === 0)
    invalid(ctx, "받을 프로필을 한 명 이상 골라 주세요");
  const grant = adjustmentOf(ctx, a);
  const count = await failShop(ctx, () =>
    grantMany(ctx, {
      profileIds,
      grant,
      actor: membership.member,
      reason,
    }),
  );
  return { count };
}

/**
 * Takes currency (`kind` "currency": currency_id, amount) or items (`kind`
 * "item": item_id, qty) back from a profile, with an optional reason.
 */
export async function adminRevoke(ctx: MutationCtx, args: unknown) {
  const membership = await requireOwner(ctx);
  const a = argsOf(args);
  const profileId = id(ctx, a.profile_id, "profile_id");
  const reason = optionalNullableString(ctx, a.reason, "사유", 500) ?? null;
  const take = adjustmentOf(ctx, a);
  await failShop(ctx, () =>
    revoke(ctx, { profileId, take, actor: membership.member, reason }),
  );
  return null;
}
