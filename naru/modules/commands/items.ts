import { listItems } from "../shop.js";
import { defineCommand } from "../command-kit.js";

export default defineCommand({
  name: "items",
  description: "판매 중인 상품 목록을 봅니다.",
  run: async (ctx) => {
    const items = await listItems(ctx);
    if (!items.length) return "판매 중인 상품이 없습니다.";
    const lines = items.map((i) => {
      const tags: string[] = [];
      if (i.consumable) tags.push("소모품");
      if (i.isUnique) tags.push("유니크");
      const tagStr = tags.length ? ` · ${tags.join(", ")}` : "";
      const desc = i.description ? ` — ${i.description}` : "";
      return `- **${i.name}** (${i.priceAmount} ${i.currencyName})${desc}${tagStr}`;
    });
    return `**상점**\n\n${lines.join("\n")}`;
  },
});
