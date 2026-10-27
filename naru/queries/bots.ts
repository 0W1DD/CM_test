// The community's bots as the owner and moderators manage them (the
// console's community bots).
import { requireStaff } from "../modules/access.js";
import { listBots, listTokens, requireBot } from "../modules/bots.js";
import { argsOf, id, type QueryCtx } from "../modules/core.js";

export async function adminList(ctx: QueryCtx) {
  await requireStaff(ctx);
  return await listBots(ctx);
}

/** A bot with its tokens (never their secrets). */
export async function adminGet(ctx: QueryCtx, args: unknown) {
  await requireStaff(ctx);
  const bot = await requireBot(ctx, id(ctx, argsOf(args).bot_id, "bot_id"));
  return { ...bot, tokens: await listTokens(ctx, bot.id) };
}

export async function adminTokens(ctx: QueryCtx, args: unknown) {
  await requireStaff(ctx);
  const bot = await requireBot(ctx, id(ctx, argsOf(args).bot_id, "bot_id"));
  return await listTokens(ctx, bot.id);
}
