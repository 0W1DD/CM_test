// The shop (commung's shop.service): currencies, balances, items, inventory
// and the transaction log. Every change happens in the calling mutation's
// one transaction, and checks before it writes, so a refused purchase or
// grant writes nothing: balances and quantities never go below zero, and a
// unique item is held once. Rows answer in commung's shapes (camelCase, as
// its API passed its rows through).
import { bool, iso, list, uuidv7 } from "./core.js";
export const CURRENCY_NAME_MAX = 50;
export const NAME_MAX = 100;
export const DESC_MAX = 1000;
export const REASON_MAX = 500;
export const MAX_AMOUNT = 1_000_000_000;
/**
 * A refusal from the shop, which slash commands answer with as their reply
 * and mutations turn into ctx.fail (`failShop`).
 */
export class ShopError extends Error {
    code;
    reason;
    constructor(code, message, reason) {
        super(message);
        this.code = code;
        this.reason = reason;
    }
}
/** Runs `fn`, turning a ShopError into the call's refusal. */
export async function failShop(ctx, fn) {
    try {
        return await fn();
    }
    catch (error) {
        if (error instanceof ShopError)
            ctx.fail(error.code, error.message, { reason: error.reason });
        throw error;
    }
}
const invalid = (message, reason = "invalid") => new ShopError("INVALID_REQUEST", message, reason);
export const currencyJson = (row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    isDefault: bool(row.is_default),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    deletedAt: iso(row.deleted_at),
});
export const itemJson = (row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    priceAmount: row.price_amount,
    currencyId: row.currency_id,
    consumable: bool(row.consumable),
    isUnique: bool(row.is_unique),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    ...(row.currency_name === undefined
        ? {}
        : { currencyName: row.currency_name }),
});
// ---------- Currencies ----------
export async function listCurrencies(ctx) {
    const { rows } = await ctx.sql `
    SELECT * FROM shop_currencies WHERE deleted_at IS NULL
    ORDER BY is_default DESC, name`;
    return rows.map(currencyJson);
}
export async function getCurrency(ctx, currencyId) {
    const { rows } = await ctx.sql `
    SELECT * FROM shop_currencies WHERE id = ${currencyId} AND deleted_at IS NULL`;
    return rows[0] ? currencyJson(rows[0]) : null;
}
export async function getCurrencyByName(ctx, name) {
    const { rows } = await ctx.sql `
    SELECT * FROM shop_currencies
    WHERE lower(name) = ${name.toLowerCase()} AND deleted_at IS NULL`;
    return rows[0] ? currencyJson(rows[0]) : null;
}
export async function validateCurrencyExists(ctx, currencyId) {
    const row = await getCurrency(ctx, currencyId);
    if (!row)
        throw new ShopError("NOT_FOUND", "통화를 찾을 수 없습니다", "not_found");
    return row;
}
function currencyName(value) {
    const name = value.trim();
    if (!name || name.length > CURRENCY_NAME_MAX)
        throw invalid(`통화 이름은 1~${CURRENCY_NAME_MAX}자여야 합니다`);
    return name;
}
async function currencyNameFree(ctx, name, except) {
    const found = await getCurrencyByName(ctx, name);
    if (found && found.id !== except)
        throw new ShopError("CONFLICT", `이미 있는 통화 이름입니다: ${name}`, "duplicate_entry");
}
export async function createCurrency(ctx, params) {
    const name = currencyName(params.name);
    if (params.description && params.description.length > 500)
        throw invalid("통화 설명은 500자 이하여야 합니다");
    await currencyNameFree(ctx, name, null);
    if (params.isDefault)
        await ctx.sql `
      UPDATE shop_currencies SET is_default = 0, updated_at = ${ctx.now}
      WHERE is_default = 1 AND deleted_at IS NULL`;
    const { rows } = await ctx.sql `
    INSERT INTO shop_currencies (id, name, description, is_default, created_at, updated_at)
    VALUES (${uuidv7(ctx.now)}, ${name}, ${params.description ?? null}, ${params.isDefault ?? false}, ${ctx.now}, ${ctx.now})
    RETURNING *`;
    return currencyJson(rows[0]);
}
export async function updateCurrency(ctx, currencyId, params) {
    const current = await validateCurrencyExists(ctx, currencyId);
    const name = params.name === undefined ? current.name : currencyName(params.name);
    if (params.description && params.description.length > 500)
        throw invalid("통화 설명은 500자 이하여야 합니다");
    if (name.toLowerCase() !== current.name.toLowerCase())
        await currencyNameFree(ctx, name, currencyId);
    if (params.isDefault === true)
        await ctx.sql `
      UPDATE shop_currencies SET is_default = 0, updated_at = ${ctx.now}
      WHERE is_default = 1 AND id <> ${currencyId} AND deleted_at IS NULL`;
    const description = params.description === undefined ? current.description : params.description;
    const isDefault = params.isDefault ?? current.isDefault;
    const { rows } = await ctx.sql `
    UPDATE shop_currencies SET name = ${name}, description = ${description},
      is_default = ${isDefault}, updated_at = ${ctx.now}
    WHERE id = ${currencyId} RETURNING *`;
    return currencyJson(rows[0]);
}
export async function deleteCurrency(ctx, currencyId) {
    await validateCurrencyExists(ctx, currencyId);
    await ctx.sql `
    UPDATE shop_currencies SET deleted_at = ${ctx.now}, is_default = 0
    WHERE id = ${currencyId}`;
}
// ---------- Items ----------
export async function listItems(ctx) {
    const { rows } = await ctx.sql `
    SELECT i.*, c.name AS currency_name FROM shop_items i
    JOIN shop_currencies c ON c.id = i.currency_id
    WHERE i.deleted_at IS NULL ORDER BY i.name`;
    return rows.map(itemJson);
}
export async function getItem(ctx, itemId) {
    const { rows } = await ctx.sql `
    SELECT * FROM shop_items WHERE id = ${itemId} AND deleted_at IS NULL`;
    return rows[0] ? itemJson(rows[0]) : null;
}
export async function getItemByName(ctx, name) {
    const { rows } = await ctx.sql `
    SELECT i.*, c.name AS currency_name FROM shop_items i
    LEFT JOIN shop_currencies c ON c.id = i.currency_id
    WHERE lower(i.name) = ${name.toLowerCase()} AND i.deleted_at IS NULL`;
    return rows[0]
        ? itemJson({ ...rows[0], currency_name: rows[0].currency_name ?? "" })
        : null;
}
export async function validateItemExists(ctx, itemId) {
    const row = await getItem(ctx, itemId);
    if (!row)
        throw new ShopError("NOT_FOUND", "상품을 찾을 수 없습니다", "not_found");
    return row;
}
function itemName(value) {
    const name = value.trim();
    if (!name || name.length > NAME_MAX)
        throw invalid(`상품 이름은 1~${NAME_MAX}자여야 합니다`);
    return name;
}
function price(value) {
    if (!Number.isInteger(value) || value <= 0 || value > MAX_AMOUNT)
        throw invalid("가격은 1 이상의 정수여야 합니다");
    return value;
}
async function itemNameFree(ctx, name, except) {
    const found = await getItemByName(ctx, name);
    if (found && found.id !== except)
        throw new ShopError("CONFLICT", `이미 있는 상품 이름입니다: ${name}`, "duplicate_entry");
}
export async function createItem(ctx, params) {
    const name = itemName(params.name);
    if (params.description && params.description.length > DESC_MAX)
        throw invalid(`상품 설명은 ${DESC_MAX}자 이하여야 합니다`);
    const amount = price(params.priceAmount);
    await validateCurrencyExists(ctx, params.currencyId);
    await itemNameFree(ctx, name, null);
    const { rows } = await ctx.sql `
    INSERT INTO shop_items (id, name, description, price_amount, currency_id, consumable, is_unique, created_at, updated_at)
    VALUES (${uuidv7(ctx.now)}, ${name}, ${params.description ?? null}, ${amount}, ${params.currencyId},
      ${params.consumable ?? false}, ${params.isUnique ?? false}, ${ctx.now}, ${ctx.now})
    RETURNING *`;
    return itemJson(rows[0]);
}
export async function updateItem(ctx, itemId, params) {
    const current = await validateItemExists(ctx, itemId);
    const name = params.name === undefined ? current.name : itemName(params.name);
    if (name.toLowerCase() !== current.name.toLowerCase())
        await itemNameFree(ctx, name, itemId);
    if (params.description && params.description.length > DESC_MAX)
        throw invalid(`상품 설명은 ${DESC_MAX}자 이하여야 합니다`);
    const amount = params.priceAmount === undefined
        ? current.priceAmount
        : price(params.priceAmount);
    if (params.currencyId !== undefined)
        await validateCurrencyExists(ctx, params.currencyId);
    const { rows } = await ctx.sql `
    UPDATE shop_items SET name = ${name},
      description = ${params.description === undefined ? current.description : params.description},
      price_amount = ${amount},
      currency_id = ${params.currencyId ?? current.currencyId},
      consumable = ${params.consumable ?? current.consumable},
      is_unique = ${params.isUnique ?? current.isUnique},
      updated_at = ${ctx.now}
    WHERE id = ${itemId} RETURNING *`;
    return itemJson(rows[0]);
}
export async function deleteItem(ctx, itemId) {
    await validateItemExists(ctx, itemId);
    await ctx.sql `UPDATE shop_items SET deleted_at = ${ctx.now} WHERE id = ${itemId}`;
}
export async function listBalances(ctx, profileId) {
    const { rows } = await ctx.sql `
    SELECT b.id, b.currency_id, c.name AS currency_name, c.is_default, b.amount, b.updated_at
    FROM shop_balances b JOIN shop_currencies c ON c.id = b.currency_id
    WHERE b.profile_id = ${profileId} AND c.deleted_at IS NULL
    ORDER BY c.is_default DESC, c.name`;
    return rows.map((row) => ({
        id: row.id,
        currencyId: row.currency_id,
        currencyName: row.currency_name,
        isDefault: bool(row.is_default),
        amount: row.amount,
        updatedAt: iso(row.updated_at),
    }));
}
export async function listInventory(ctx, profileId) {
    const { rows } = await ctx.sql `
    SELECT v.id, v.item_id, i.name AS item_name, i.description AS item_description,
      i.consumable, i.is_unique, v.qty, v.granted_at, v.updated_at
    FROM shop_inventory v JOIN shop_items i ON i.id = v.item_id
    WHERE v.profile_id = ${profileId} AND v.qty > 0 AND i.deleted_at IS NULL
    ORDER BY i.name`;
    return rows.map((row) => ({
        id: row.id,
        itemId: row.item_id,
        itemName: row.item_name,
        itemDescription: row.item_description,
        consumable: bool(row.consumable),
        isUnique: bool(row.is_unique),
        qty: row.qty,
        grantedAt: iso(row.granted_at),
        updatedAt: iso(row.updated_at),
    }));
}
// ---------- Changes ----------
function validateAmount(amount) {
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT)
        throw invalid("수량은 1 이상의 정수여야 합니다");
}
function validateReason(reason) {
    if (reason && reason.length > REASON_MAX)
        throw invalid(`사유는 ${REASON_MAX}자 이하여야 합니다`);
}
async function profileExists(ctx, profileId) {
    const { rows } = await ctx.sql `
    SELECT id FROM profiles WHERE id = ${profileId} AND deleted_at IS NULL`;
    if (!rows[0])
        throw new ShopError("NOT_FOUND", "프로필을 찾을 수 없습니다", "profile_not_found");
}
async function record(ctx, t) {
    await ctx.sql `
    INSERT INTO shop_transactions (id, profile_id, kind, source, currency_id, currency_delta, item_id, item_qty_delta, reason, actor_member, created_at)
    VALUES (${uuidv7(ctx.now)}, ${t.profileId}, ${t.kind}, ${t.source}, ${t.currencyId ?? null},
      ${t.currencyDelta ?? null}, ${t.itemId ?? null}, ${t.itemQtyDelta ?? null}, ${t.reason ?? null},
      ${t.actor ?? null}, ${ctx.now})`;
}
export async function grantCurrency(ctx, p) {
    validateAmount(p.amount);
    validateReason(p.reason);
    await validateCurrencyExists(ctx, p.currencyId);
    await profileExists(ctx, p.profileId);
    await ctx.sql `
    INSERT INTO shop_balances (id, profile_id, currency_id, amount, updated_at)
    VALUES (${uuidv7(ctx.now)}, ${p.profileId}, ${p.currencyId}, ${p.amount}, ${ctx.now})
    ON CONFLICT (profile_id, currency_id) DO UPDATE
    SET amount = amount + excluded.amount, updated_at = excluded.updated_at`;
    await record(ctx, {
        profileId: p.profileId,
        kind: p.source === "refund" ? "currency_refund" : "currency_grant",
        source: p.source,
        currencyId: p.currencyId,
        currencyDelta: p.amount,
        reason: p.reason,
        actor: p.actor,
    });
}
/** Takes `amount` from a balance, or refuses without writing when it is short. */
async function charge(ctx, profileId, currencyId, amount) {
    const { changes } = await ctx.sql `
    UPDATE shop_balances SET amount = amount - ${amount}, updated_at = ${ctx.now}
    WHERE profile_id = ${profileId} AND currency_id = ${currencyId} AND amount >= ${amount}`;
    if (!changes)
        throw invalid("잔액이 부족합니다", "insufficient_balance");
}
export async function chargeCurrency(ctx, p) {
    validateAmount(p.amount);
    validateReason(p.reason);
    await charge(ctx, p.profileId, p.currencyId, p.amount);
    await record(ctx, {
        profileId: p.profileId,
        kind: "currency_charge",
        source: p.source,
        currencyId: p.currencyId,
        currencyDelta: -p.amount,
        reason: p.reason,
        actor: p.actor,
    });
}
async function owns(ctx, profileId, itemId) {
    const { rows } = await ctx.sql `
    SELECT qty FROM shop_inventory WHERE profile_id = ${profileId} AND item_id = ${itemId}`;
    return (rows[0]?.qty ?? 0) > 0;
}
function alreadyOwned() {
    return new ShopError("CONFLICT", "이미 보유 중인 상품입니다", "already_owned");
}
async function addToInventory(ctx, profileId, itemId, qty) {
    await ctx.sql `
    INSERT INTO shop_inventory (id, profile_id, item_id, qty, granted_at, updated_at)
    VALUES (${uuidv7(ctx.now)}, ${profileId}, ${itemId}, ${qty}, ${ctx.now}, ${ctx.now})
    ON CONFLICT (profile_id, item_id) DO UPDATE
    SET qty = qty + excluded.qty, updated_at = excluded.updated_at`;
}
export async function grantItem(ctx, p) {
    const qty = p.qty ?? 1;
    validateAmount(qty);
    validateReason(p.reason);
    const item = await validateItemExists(ctx, p.itemId);
    await profileExists(ctx, p.profileId);
    if (item.isUnique && (await owns(ctx, p.profileId, p.itemId)))
        throw alreadyOwned();
    await addToInventory(ctx, p.profileId, p.itemId, qty);
    await record(ctx, {
        profileId: p.profileId,
        kind: "item_grant",
        source: p.source,
        itemId: p.itemId,
        itemQtyDelta: qty,
        reason: p.reason,
        actor: p.actor,
    });
}
/**
 * Hands `qty` of an item from one profile to another: taken, then given,
 * or neither (short, or the receiver already holds a unique one). The
 * ledger has no transfer kind, so each side is written as a consume and a
 * grant whose reason names the other profile.
 */
export async function transferItem(ctx, p) {
    validateAmount(p.qty);
    const item = await validateItemExists(ctx, p.itemId);
    await profileExists(ctx, p.toId);
    if (item.isUnique && (await owns(ctx, p.toId, p.itemId)))
        throw new ShopError("CONFLICT", "받는 사람이 이미 보유 중인 상품입니다", "already_owned");
    const { changes } = await ctx.sql `
    UPDATE shop_inventory SET qty = qty - ${p.qty}, updated_at = ${ctx.now}
    WHERE profile_id = ${p.fromId} AND item_id = ${p.itemId} AND qty >= ${p.qty}`;
    if (!changes)
        throw invalid("보유 수량이 부족합니다", "insufficient_quantity");
    await addToInventory(ctx, p.toId, p.itemId, p.qty);
    await record(ctx, {
        profileId: p.fromId,
        kind: "item_consume",
        source: "consume",
        itemId: p.itemId,
        itemQtyDelta: -p.qty,
        reason: `양도 → @${p.toName}`,
        actor: p.actor,
    });
    await record(ctx, {
        profileId: p.toId,
        kind: "item_grant",
        source: "owner_grant",
        itemId: p.itemId,
        itemQtyDelta: p.qty,
        reason: `양도 ← @${p.fromName}`,
        actor: p.actor,
    });
    return item;
}
/** Buys one of an item with its currency: charges, then adds it, or neither. */
export async function purchaseItem(ctx, p) {
    const item = await getItem(ctx, p.itemId);
    if (!item)
        throw new ShopError("NOT_FOUND", "상품을 찾을 수 없습니다", "not_found");
    if (item.isUnique && (await owns(ctx, p.profileId, p.itemId)))
        throw alreadyOwned();
    await charge(ctx, p.profileId, item.currencyId, item.priceAmount);
    await addToInventory(ctx, p.profileId, p.itemId, 1);
    await record(ctx, {
        profileId: p.profileId,
        kind: "item_purchase",
        source: "purchase",
        currencyId: item.currencyId,
        currencyDelta: -item.priceAmount,
        itemId: p.itemId,
        itemQtyDelta: 1,
        actor: p.actor,
    });
    return item;
}
export async function consumeItem(ctx, p) {
    const qty = p.qty ?? 1;
    validateAmount(qty);
    validateReason(p.reason);
    const item = await validateItemExists(ctx, p.itemId);
    if (!item.consumable)
        throw invalid("소비할 수 없는 상품입니다", "not_consumable");
    const { changes } = await ctx.sql `
    UPDATE shop_inventory SET qty = qty - ${qty}, updated_at = ${ctx.now}
    WHERE profile_id = ${p.profileId} AND item_id = ${p.itemId} AND qty >= ${qty}`;
    if (!changes)
        throw invalid("보유 수량이 부족합니다", "insufficient_quantity");
    await record(ctx, {
        profileId: p.profileId,
        kind: "item_consume",
        source: "consume",
        itemId: p.itemId,
        itemQtyDelta: -qty,
        reason: p.reason,
        actor: p.actor,
    });
}
// ---------- Owner adjustments ----------
/**
 * The live member profiles a grant to "everyone" reaches: activated, not
 * deleted, and not a bot (the owner's bots or the slash command bot).
 */
const MEMBER_PROFILES = `SELECT p.id FROM profiles p
  WHERE p.activated_at IS NOT NULL AND p.deleted_at IS NULL
    AND p.id NOT IN (SELECT profile_id FROM bots)
    AND p.id IS NOT (SELECT command_bot_profile_id FROM settings WHERE id = 1)`;
/**
 * Grants currency or an item to many profiles in a handful of statements
 * (a call may make only 100): `profileIds`, or every member profile when it
 * is null. Each profile gets its own transaction row, so its history shows
 * the grant. Answers how many profiles it reached. A unique item skips the
 * profiles that already own it.
 */
export async function grantMany(ctx, p) {
    validateReason(p.reason);
    const prefix = uuidv7(ctx.now);
    const targets = p.profileIds
        ? `SELECT id FROM profiles WHERE deleted_at IS NULL
         AND id IN (SELECT value FROM json_each(?))`
        : MEMBER_PROFILES;
    const targetValues = p.profileIds ? [list([...new Set(p.profileIds)])] : [];
    if (p.grant.kind === "currency") {
        validateAmount(p.grant.amount);
        await validateCurrencyExists(ctx, p.grant.currencyId);
        const { changes } = await ctx.sql(`INSERT INTO shop_balances (id, profile_id, currency_id, amount, updated_at)
       SELECT ? || '-' || t.id, t.id, ?, ?, ? FROM (${targets}) t WHERE true
       ON CONFLICT (profile_id, currency_id) DO UPDATE
       SET amount = amount + excluded.amount, updated_at = excluded.updated_at`, [prefix, p.grant.currencyId, p.grant.amount, ctx.now, ...targetValues]);
        await ctx.sql(`INSERT INTO shop_transactions (id, profile_id, kind, source, currency_id, currency_delta, reason, actor_member, created_at)
       SELECT ? || '-' || t.id, t.id, 'currency_grant', 'owner_grant', ?, ?, ?, ?, ?
       FROM (${targets}) t`, [
            prefix,
            p.grant.currencyId,
            p.grant.amount,
            p.reason,
            p.actor,
            ctx.now,
            ...targetValues,
        ]);
        return changes;
    }
    validateAmount(p.grant.qty);
    const item = await validateItemExists(ctx, p.grant.itemId);
    const qty = item.isUnique ? 1 : p.grant.qty;
    // A unique item goes only to those without it.
    const eligible = item.isUnique
        ? `SELECT t.id FROM (${targets}) t WHERE NOT EXISTS (
         SELECT 1 FROM shop_inventory i
         WHERE i.profile_id = t.id AND i.item_id = ? AND i.qty > 0)`
        : `SELECT t.id FROM (${targets}) t`;
    const eligibleValues = item.isUnique
        ? [...targetValues, p.grant.itemId]
        : targetValues;
    // Transactions first, while "without it" still describes who will get it.
    await ctx.sql(`INSERT INTO shop_transactions (id, profile_id, kind, source, item_id, item_qty_delta, reason, actor_member, created_at)
     SELECT ? || '-' || e.id, e.id, 'item_grant', 'owner_grant', ?, ?, ?, ?, ?
     FROM (${eligible}) e`, [
        prefix,
        p.grant.itemId,
        qty,
        p.reason,
        p.actor,
        ctx.now,
        ...eligibleValues,
    ]);
    const { changes } = await ctx.sql(`INSERT INTO shop_inventory (id, profile_id, item_id, qty, granted_at, updated_at)
     SELECT ? || '-' || e.id, e.id, ?, ?, ?, ? FROM (${eligible}) e WHERE true
     ON CONFLICT (profile_id, item_id) DO UPDATE
     SET qty = qty + excluded.qty, updated_at = excluded.updated_at`, [prefix, p.grant.itemId, qty, ctx.now, ctx.now, ...eligibleValues]);
    return changes;
}
/**
 * Takes currency or items back from one profile (a mistaken grant, a game
 * lost, a gift between members undone). Refuses without writing when the
 * profile holds less than that.
 */
export async function revoke(ctx, p) {
    validateReason(p.reason);
    await profileExists(ctx, p.profileId);
    if (p.take.kind === "currency") {
        validateAmount(p.take.amount);
        await validateCurrencyExists(ctx, p.take.currencyId);
        await charge(ctx, p.profileId, p.take.currencyId, p.take.amount);
        await record(ctx, {
            profileId: p.profileId,
            kind: "currency_charge",
            source: "owner_grant",
            currencyId: p.take.currencyId,
            currencyDelta: -p.take.amount,
            reason: p.reason,
            actor: p.actor,
        });
        return;
    }
    validateAmount(p.take.qty);
    await validateItemExists(ctx, p.take.itemId);
    const { changes } = await ctx.sql `
    UPDATE shop_inventory SET qty = qty - ${p.take.qty}, updated_at = ${ctx.now}
    WHERE profile_id = ${p.profileId} AND item_id = ${p.take.itemId} AND qty >= ${p.take.qty}`;
    if (!changes)
        throw invalid("보유 수량이 부족합니다", "insufficient_quantity");
    await record(ctx, {
        profileId: p.profileId,
        kind: "item_consume",
        source: "owner_grant",
        itemId: p.take.itemId,
        itemQtyDelta: -p.take.qty,
        reason: p.reason,
        actor: p.actor,
    });
}
// ---------- Transaction log ----------
export async function listTransactions(ctx, options = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const { rows } = await ctx.sql(`SELECT t.*, p.name AS profile_name, p.username AS profile_username
     FROM shop_transactions t LEFT JOIN profiles p ON p.id = t.profile_id
     WHERE (? IS NULL OR t.profile_id = ?) AND (? IS NULL OR t.id < ?)
     ORDER BY t.id DESC LIMIT ?`, [
        options.profileId ?? null,
        options.profileId ?? null,
        options.cursor ?? null,
        options.cursor ?? null,
        limit + 1,
    ]);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
        data: page.map((row) => ({
            id: row.id,
            profileId: row.profile_id,
            profileName: row.profile_name,
            profileUsername: row.profile_username,
            kind: row.kind,
            source: row.source,
            currencyId: row.currency_id,
            currencyDelta: row.currency_delta,
            itemId: row.item_id,
            itemQtyDelta: row.item_qty_delta,
            reason: row.reason,
            actorUserId: row.actor_member,
            createdAt: iso(row.created_at),
        })),
        nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
        hasMore,
    };
}
