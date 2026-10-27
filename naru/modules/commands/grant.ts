import { getCurrencyByName, grantCurrency } from "../shop.js";
import { defineCommand, orShopMessage } from "../command-kit.js";

export default defineCommand({
  name: "grant",
  description: "소유자 전용. 사용법: /grant <사용자명> <금액> <통화> [사유]",
  requiredRole: "owner",
  run: async (ctx, { args, trigger }) => {
    const usage = "사용법: `/grant <사용자명> <금액> <통화> [사유]`";
    const match = args.trim().match(/^(\S+)\s+(\d+)\s+(\S+)(?:\s+([\s\S]+))?$/);
    if (!match) return usage;
    const [, username, amountStr, currencyName, reason] = match;
    if (!username || !amountStr || !currencyName) return usage;
    const amount = Number.parseInt(amountStr, 10);
    if (!Number.isFinite(amount) || amount <= 0)
      return "금액은 1 이상의 정수여야 합니다.";
    const { rows } = await ctx.sql<{ id: string; name: string }>`
      SELECT id, name FROM profiles
      WHERE lower(username) = ${username.toLowerCase()}
        AND activated_at IS NOT NULL AND deleted_at IS NULL`;
    const profile = rows[0];
    if (!profile) return `사용자를 찾을 수 없습니다: ${username}`;
    const currency = await getCurrencyByName(ctx, currencyName);
    if (!currency) return `통화를 찾을 수 없습니다: ${currencyName}`;
    return await orShopMessage(async () => {
      await grantCurrency(ctx, {
        profileId: profile.id,
        currencyId: currency.id,
        amount,
        source: "owner_grant",
        actor: trigger.actorMember,
        reason: reason ?? null,
      });
      return `🎁 **${profile.name}** 님에게 ${amount} ${currency.name} 지급되었습니다.`;
    });
  },
});
