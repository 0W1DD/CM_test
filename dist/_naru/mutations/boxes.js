// Opening a Christmas random box (modules/boxes.ts): one leaves the acting
// profile's inventory and what was inside joins its collection (도감).
import { actingProfile } from "../modules/access.js";
import { drawBox } from "../modules/boxes.js";
import { argsOf, id, invalid, notFound, uuidv7, } from "../modules/core.js";
/** Opens one random box the acting profile holds; answers what was inside. */
export async function open(ctx, args) {
    const a = argsOf(args);
    const profile = await actingProfile(ctx, a.profile_id);
    if (profile.activated_at === null)
        notFound(ctx, "프로필을 찾을 수 없습니다.");
    const itemId = id(ctx, a.item_id, "item_id");
    const { rows } = await ctx.sql `
    SELECT random_box FROM shop_items WHERE id = ${itemId} AND deleted_at IS NULL`;
    if (!rows[0])
        notFound(ctx, "상품을 찾을 수 없습니다.");
    if (rows[0].random_box !== 1)
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
    const drawn = await drawBox(ctx, profile.id);
    return {
        entry: drawn.entry,
        category: drawn.category,
        is_new: drawn.isNew,
        collected: drawn.collected,
    };
}
