import {
  consumeItem,
  getItemByName,
  listInventory,
  ShopError,
} from "../shop.js";
import { defineCommand, orShopMessage, itemNotFound } from "../command-kit.js";

export default defineCommand({
  name: "use",
  description:
    "보유한 상품을 사용/꺼내 보입니다. 소모품은 1개 차감됩니다. 사용법: /use <상품 이름>",
  run: async (ctx, { args, trigger }) => {
    const name = args.trim();
    if (!name) return "사용법: `/use <상품 이름>`";
    return await orShopMessage(async () => {
      const item = await getItemByName(ctx, name);
      if (!item) throw itemNotFound(name);
      const profileId = trigger.authorProfileId;
      if (item.consumable)
        await consumeItem(ctx, {
          profileId,
          itemId: item.id,
          actor: trigger.actorMember,
        });
      else if (
        !(await listInventory(ctx, profileId)).some(
          (row) => row.itemId === item.id && row.qty > 0,
        )
      )
        throw new ShopError(
          "INVALID_REQUEST",
          `보유하고 있지 않습니다: ${item.name}`,
          "not_owned",
        );
      const { rows } = await ctx.sql<{ name: string }>`
        SELECT name FROM profiles WHERE id = ${profileId}`;
      const verb = item.consumable ? "사용했습니다" : "꺼내 보였습니다";
      let content = `🪄 **${rows[0]?.name ?? ""}**님이 **${item.name}**을(를) ${verb}.`;
      if (item.description) content += `\n\n${item.description}`;
      return content;
    });
  },
});
