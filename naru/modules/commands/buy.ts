import { getItemByName, purchaseItem } from "../shop.js";
import { defineCommand, orShopMessage, itemNotFound } from "../command-kit.js";

export default defineCommand({
  name: "buy",
  description: "상품을 구매합니다. 사용법: /buy <상품 이름>",
  run: async (ctx, { args, trigger }) => {
    const name = args.trim();
    if (!name) return "사용법: `/buy <상품 이름>`";
    return await orShopMessage(async () => {
      const item = await getItemByName(ctx, name);
      if (!item) throw itemNotFound(name);
      await purchaseItem(ctx, {
        profileId: trigger.authorProfileId,
        itemId: item.id,
        actor: trigger.actorMember,
      });
      return `🛒 **${item.name}** 구매 완료!`;
    });
  },
});
