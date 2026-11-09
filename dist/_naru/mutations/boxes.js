// The Christmas random box (modules/boxes.ts): opening one, registering
// what came out in the community's book (도감), and the staff's reset.
import { actingProfile, requireStaff } from "../modules/access.js";
import { categoryOf, giveBox } from "../modules/boxes.js";
import { argsOf, id, invalid, notFound, uuidv7, } from "../modules/core.js";
import { coinCurrency } from "../modules/events.js";
import { failShop, grantCurrency } from "../modules/shop.js";
/** Coins for registering an entry first in the book. */
const REGISTER_COINS = 2;
/** A live profile the calling member acts as. */
async function activeProfile(ctx, profileId) {
    const profile = await actingProfile(ctx, profileId);
    if (profile.activated_at === null)
        notFound(ctx, "프로필을 찾을 수 없습니다.");
    return profile;
}
/**
 * Opens one random box the acting profile holds: the box goes, and what
 * was inside comes into its inventory. Answers what that was.
 */
export async function open(ctx, args) {
    const a = argsOf(args);
    const profile = await activeProfile(ctx, a.profile_id);
    const itemId = id(ctx, a.item_id, "item_id");
    const { rows } = await ctx.sql `
    SELECT random_box, currency_id FROM shop_items
    WHERE id = ${itemId} AND deleted_at IS NULL`;
    const box = rows[0] ?? notFound(ctx, "상품을 찾을 수 없습니다.");
    if (box.random_box !== 1)
        invalid(ctx, "랜덤박스가 아닙니다.", "not_random_box");
    const { changes } = await ctx.sql `
    UPDATE shop_inventory SET qty = qty - 1, updated_at = ${ctx.now}
    WHERE profile_id = ${profile.id} AND item_id = ${itemId} AND qty >= 1`;
    if (!changes)
        invalid(ctx, "가지고 있는 랜덤박스가 없습니다.", "no_box");
    await ctx.sql `
    INSERT INTO shop_transactions (id, profile_id, kind, source, item_id, item_qty_delta, reason, actor_member, created_at)
    VALUES (${uuidv7(ctx.now)}, ${profile.id}, 'item_consume', 'consume', ${itemId}, -1,
      '랜덤박스 열기', ${profile.membership.member}, ${ctx.now})`;
    const got = await giveBox(ctx, profile.id, box.currency_id);
    return {
        entry: got.entry,
        category: got.category,
        item_id: got.itemId,
        registered: got.registered,
    };
}
/**
 * Registers an item the acting profile holds in the book, if it is one of
 * the box's list and not there yet, for REGISTER_COINS of the default
 * currency. The item stays where it is.
 */
export async function register(ctx, args) {
    const a = argsOf(args);
    const profile = await activeProfile(ctx, a.profile_id);
    const itemId = id(ctx, a.item_id, "item_id");
    const { rows } = await ctx.sql `
    SELECT i.name FROM shop_inventory v JOIN shop_items i ON i.id = v.item_id
    WHERE v.profile_id = ${profile.id} AND v.item_id = ${itemId} AND v.qty > 0
      AND i.deleted_at IS NULL`;
    const item = rows[0] ?? notFound(ctx, "가지고 있지 않은 물건입니다.");
    const category = categoryOf(item.name);
    if (!category)
        invalid(ctx, "도감에 없는 물건입니다.", "not_in_book");
    const { changes } = await ctx.sql `
    INSERT INTO box_registry (entry, category, profile_id, registered_at)
    VALUES (${item.name}, ${category}, ${profile.id}, ${ctx.now})
    ON CONFLICT (entry) DO NOTHING`;
    if (!changes)
        invalid(ctx, "이미 도감에 등록된 물건입니다.", "already_registered");
    // The first to register an entry (the only one who can) is rewarded.
    const coin = await coinCurrency(ctx);
    if (coin)
        await failShop(ctx, () => grantCurrency(ctx, {
            profileId: profile.id,
            currencyId: coin.id,
            amount: REGISTER_COINS,
            source: "owner_grant",
            actor: profile.membership.member,
            reason: "도감 최초 등록",
        }));
    return {
        entry: item.name,
        category,
        coins: coin ? REGISTER_COINS : 0,
        currency: coin?.name ?? null,
    };
}
/** Empties the book (the staff); the items stay with those who hold them. */
export async function reset(ctx) {
    await requireStaff(ctx);
    const { changes } = await ctx.sql `DELETE FROM box_registry`;
    return { removed: changes };
}
