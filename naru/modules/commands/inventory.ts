import { listInventory } from "../shop.js";
import { defineCommand } from "../command-kit.js";

export default defineCommand({
  name: "inventory",
  description: "보유 중인 상품 목록을 봅니다.",
  run: async (ctx, { trigger }) => {
    const inventory = await listInventory(ctx, trigger.authorProfileId);
    if (!inventory.length) return "보유 중인 상품이 없습니다.";
    const lines = inventory.map(
      (i) => `- **${i.itemName}** ×${i.qty}${i.consumable ? " · 소모품" : ""}`,
    );
    return `**보유 상품**\n\n${lines.join("\n")}`;
  },
});
