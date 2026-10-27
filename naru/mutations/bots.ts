// Making and managing bots and their tokens (the console's community bots,
// owner only). A token is shown once, when it is made.
import { requireOwner } from "../modules/access.js";
import {
  type BotRow,
  botJson,
  botProfileFields,
  createBotProfile,
  newSecret,
  requireBot,
} from "../modules/bots.js";
import {
  argsOf,
  type Ctx,
  id,
  invalid,
  iso,
  type MutationCtx,
  msOf,
  uuidv7,
} from "../modules/core.js";

function botFields(ctx: Ctx, a: Record<string, unknown>) {
  if (typeof a.name !== "string" || a.name.length < 1 || a.name.length > 100)
    invalid(ctx, "봇 이름은 1~100자여야 합니다.");
  if (
    a.description !== undefined &&
    a.description !== null &&
    (typeof a.description !== "string" || a.description.length > 1000)
  )
    invalid(ctx, "봇 설명은 1000자 이하여야 합니다.");
  return {
    name: a.name,
    description: (a.description as string | null | undefined) || null,
  };
}

/** Makes a bot with its own profile (POST /console/communities/:id/bots). */
export async function adminCreate(ctx: MutationCtx, args: unknown) {
  const membership = await requireOwner(ctx);
  const a = argsOf(args);
  const { name, description } = botFields(ctx, a);
  const fields = botProfileFields(ctx, a);
  const profile = await createBotProfile(
    ctx,
    fields.name,
    fields.username,
    membership.member,
  );
  const { rows } = await ctx.sql<BotRow>`
    INSERT INTO bots (id, name, description, profile_id, created_by, created_at, updated_at)
    VALUES (${uuidv7(ctx.now)}, ${name}, ${description}, ${profile.id}, ${membership.member}, ${ctx.now}, ${ctx.now})
    RETURNING *`;
  return { ...botJson(rows[0]), profile };
}

export async function adminUpdate(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const a = argsOf(args);
  const botId = id(ctx, a.bot_id, "bot_id");
  const { name, description } = botFields(ctx, a);
  await requireBot(ctx, botId);
  const { rows } = await ctx.sql<BotRow>`
    UPDATE bots SET name = ${name}, description = ${description}, updated_at = ${ctx.now}
    WHERE id = ${botId} RETURNING *`;
  return botJson(rows[0]);
}

/** Deletes a bot: revokes its tokens and deletes its profile. */
export async function adminDelete(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const botId = id(ctx, argsOf(args).bot_id, "bot_id");
  const { rows } = await ctx.sql<{ profile_id: string }>`
    SELECT profile_id FROM bots WHERE id = ${botId} AND deleted_at IS NULL`;
  const bot = rows[0];
  if (!bot) return null;
  await ctx.sql`UPDATE bots SET deleted_at = ${ctx.now} WHERE id = ${botId}`;
  await ctx.sql`
    UPDATE bot_tokens SET revoked_at = ${ctx.now}
    WHERE bot_id = ${botId} AND revoked_at IS NULL`;
  await ctx.sql`
    UPDATE profiles SET deleted_at = ${ctx.now}
    WHERE id = ${bot.profile_id} AND deleted_at IS NULL`;
  return null;
}

/** Makes a token; its secret is in the answer once and never again. */
export async function adminCreateToken(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const a = argsOf(args);
  const bot = await requireBot(ctx, id(ctx, a.bot_id, "bot_id"));
  if (
    a.name !== undefined &&
    a.name !== null &&
    (typeof a.name !== "string" || a.name.length > 100)
  )
    invalid(ctx, "토큰 이름은 100자 이하여야 합니다.");
  const name = (a.name as string | null | undefined) || null;
  const expiresAt = msOf(ctx, a.expires_at, "만료일");
  const tokenId = uuidv7(ctx.now);
  const secret = newSecret();
  const hash = await ctx.passwords.hash(secret);
  await ctx.sql`
    INSERT INTO bot_tokens (id, bot_id, hash, name, created_at, expires_at)
    VALUES (${tokenId}, ${bot.id}, ${hash}, ${name}, ${ctx.now}, ${expiresAt})`;
  return {
    id: tokenId,
    token: `${tokenId}.${secret}`,
    name,
    created_at: iso(ctx.now),
    expires_at: iso(expiresAt),
  };
}

export async function adminRevokeToken(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const a = argsOf(args);
  const bot = await requireBot(ctx, id(ctx, a.bot_id, "bot_id"));
  const tokenId = id(ctx, a.token_id, "token_id");
  await ctx.sql`
    UPDATE bot_tokens SET revoked_at = ${ctx.now}
    WHERE id = ${tokenId} AND bot_id = ${bot.id} AND revoked_at IS NULL`;
  return null;
}
