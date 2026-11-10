// Using a nickname colour pass: it is used up at once, with no staff
// confirmation (unlike the use log), and colours the name for a week from
// now. Using one while a colour lasts starts the week again in the new one.
import { actingProfile, requireUnmuted } from "../modules/access.js";
import { argsOf, id, invalid, notFound, } from "../modules/core.js";
import { NAME_COLOR_DAYS, NAME_COLORS, } from "../modules/name-colors.js";
import { consumeItem, failShop } from "../modules/shop.js";
export async function apply(ctx, args) {
    const a = argsOf(args);
    const profile = await actingProfile(ctx, a.profile_id);
    if (profile.activated_at === null)
        notFound(ctx, "프로필을 찾을 수 없습니다.");
    requireUnmuted(ctx, profile);
    const itemId = id(ctx, a.item_id, "item_id");
    const color = a.color;
    if (!NAME_COLORS.includes(color))
        invalid(ctx, "고를 수 없는 색입니다.", "bad_color");
    const { rows } = await ctx.sql `
    SELECT name_color FROM shop_items WHERE id = ${itemId} AND deleted_at IS NULL`;
    if (!rows[0])
        notFound(ctx, "상품을 찾을 수 없습니다.");
    if (rows[0].name_color !== 1)
        invalid(ctx, "닉네임 색 변경권이 아닙니다.", "not_name_color");
    await failShop(ctx, () => consumeItem(ctx, {
        profileId: profile.id,
        itemId,
        actor: profile.membership.member,
        reason: "닉네임 색 변경",
    }));
    const until = ctx.now + NAME_COLOR_DAYS * 86_400_000;
    await ctx.sql `
    INSERT INTO name_colors (profile_id, color, until)
    VALUES (${profile.id}, ${color}, ${until})
    ON CONFLICT (profile_id) DO UPDATE SET color = excluded.color, until = excluded.until`;
    return { color, until: new Date(until).toISOString() };
}
