// The use log: a member uses an item from their inventory, kept off the
// timeline, and the staff confirm it. Each call is one transaction: a
// refused use takes nothing from the inventory.
import { actingProfile, requireStaff } from "../modules/access.js";
import { argsOf, id, notFound, optionalText, uuidv7, } from "../modules/core.js";
import { useJson, viewerOf } from "../modules/item-uses.js";
import { consumeItem, failShop, listInventory, ShopError, validateItemExists, } from "../modules/shop.js";
/**
 * Uses an item the acting profile holds: a consumable is spent, anything
 * else only shown. `note` says how it was used; `secret` hides the item and
 * the note from everyone but the profile's owner and the staff.
 */
export async function use(ctx, args) {
    const a = argsOf(args);
    const profile = await actingProfile(ctx, a.profile_id);
    if (profile.activated_at === null)
        notFound(ctx, "프로필을 찾을 수 없습니다.");
    const itemId = id(ctx, a.item_id, "item_id");
    const note = optionalText(ctx, a.note, "사용 내용", { max: 500 });
    const secret = a.secret === true;
    const item = await failShop(ctx, async () => {
        const found = await validateItemExists(ctx, itemId);
        if (found.consumable)
            await consumeItem(ctx, {
                profileId: profile.id,
                itemId,
                actor: profile.membership.member,
                reason: "사용 로그",
            });
        else if (!(await listInventory(ctx, profile.id)).some((row) => row.itemId === itemId && row.qty > 0))
            throw new ShopError("INVALID_REQUEST", `보유하고 있지 않습니다: ${found.name}`, "not_owned");
        return found;
    });
    const { rows } = await ctx.sql `
    INSERT INTO item_uses (id, profile_id, item_id, item_name, note, secret, consumed, created_at)
    VALUES (${uuidv7(ctx.now)}, ${profile.id}, ${itemId}, ${item.name}, ${note},
      ${secret ? 1 : 0}, ${item.consumable ? 1 : 0}, ${ctx.now})
    RETURNING *`;
    const viewer = await viewerOf(ctx, profile.membership.member, false);
    return (await useJson(ctx, rows, viewer))[0];
}
/** Confirms a use (the owner or a moderator); confirming twice keeps the first. */
export async function approve(ctx, args) {
    const membership = await requireStaff(ctx);
    const useId = id(ctx, argsOf(args).use_id, "use_id");
    await ctx.sql `
    UPDATE item_uses SET approved_at = ${ctx.now}, approved_by = ${membership.member}
    WHERE id = ${useId} AND approved_at IS NULL`;
    const { rows } = await ctx.sql `
    SELECT * FROM item_uses WHERE id = ${useId}`;
    if (!rows[0])
        notFound(ctx, "사용 기록을 찾을 수 없습니다.");
    const viewer = await viewerOf(ctx, membership.member, true);
    return (await useJson(ctx, rows, viewer))[0];
}
