import { listBalances } from "../shop.js";
import { defineCommand } from "../command-kit.js";

export default defineCommand({
  name: "balance",
  description: "내 잔액을 확인합니다.",
  run: async (ctx, { trigger }) => {
    const balances = await listBalances(ctx, trigger.authorProfileId);
    if (!balances.length) return "잔액이 없습니다.";
    const lines = balances.map(
      (b) =>
        `- **${b.currencyName}**: ${b.amount}${b.isDefault ? " (기본)" : ""}`,
    );
    return `**잔액**\n\n${lines.join("\n")}`;
  },
});
