// Slash commands in posts (commung's builtin-commands and their dispatch),
// built in and always on: a post that is just `/name args` runs the command
// inside the posting mutation, so the shop commands change balances in the
// same transaction, and answers the reply the community's bot profile
// (@bot) posts. The posts area calls `commandReply` after a post is
// published and writes the reply.
//
// Each command is a file in commands/ (see command-kit.ts and
// docs/commands.md); to add one, write its file and list it here.
import balance from "./commands/balance.js";
import buy from "./commands/buy.js";
import choose from "./commands/choose.js";
import coin from "./commands/coin.js";
import grant from "./commands/grant.js";
import help from "./commands/help.js";
import inventory from "./commands/inventory.js";
import items from "./commands/items.js";
import roll from "./commands/roll.js";
import use from "./commands/use.js";
import type { Command, CommandRole, CommandTrigger } from "./command-kit.js";
import { type MutationCtx, uuidv7 } from "./core.js";

export type { CommandTrigger };

/** The built-in commands, in the order the composer suggests them and /help lists them. */
export const BUILTIN_COMMANDS: readonly Command[] = [
  roll,
  coin,
  choose,
  help,
  balance,
  items,
  buy,
  inventory,
  use,
  grant,
];

const SLASH_COMMAND_PATTERN = /^\/([a-z][a-z0-9_-]{0,30})(?:\s+([\s\S]*))?$/i;

/** The command in a post: one line that starts with `/name`. */
export function parseSlashCommand(
  content: string,
): { name: string; args: string } | null {
  if (content.includes("\n")) return null;
  const match = SLASH_COMMAND_PATTERN.exec(content.trim());
  if (!match?.[1]) return null;
  return { name: match[1].toLowerCase(), args: match[2] ?? "" };
}

function roleSatisfies(actor: string | null, required: CommandRole) {
  if (actor === "owner") return true;
  return actor === "moderator" && required === "moderator";
}

const BOT_NAME = "봇";
const BOT_USERNAME = "bot";

/**
 * The community's bot profile, which posts every command's reply: the one
 * the settings name, or a new one (@bot, or @bot_<n> when a member has
 * @bot) that no member owns.
 */
async function botProfileId(ctx: MutationCtx): Promise<string> {
  const { rows } = await ctx.sql<{ id: string }>`
    SELECT p.id FROM settings s JOIN profiles p ON p.id = s.command_bot_profile_id
    WHERE s.id = 1 AND p.deleted_at IS NULL`;
  if (rows[0]) return rows[0].id;
  const { rows: taken } = await ctx.sql<{ username: string }>`
    SELECT lower(username) AS username FROM profiles
    WHERE deleted_at IS NULL AND (lower(username) = ${BOT_USERNAME}
      OR lower(username) GLOB ${`${BOT_USERNAME}_[0-9]*`})`;
  const used = new Set(taken.map((row) => row.username));
  let username = BOT_USERNAME;
  for (let n = 2; used.has(username); n++) username = `${BOT_USERNAME}_${n}`;
  const id = uuidv7(ctx.now);
  await ctx.sql`
    INSERT INTO profiles (id, name, username, is_primary, activated_at, created_at, updated_at)
    VALUES (${id}, ${BOT_NAME}, ${username}, 0, ${ctx.now}, ${ctx.now}, ${ctx.now})`;
  await ctx.sql`UPDATE settings SET command_bot_profile_id = ${id} WHERE id = 1`;
  return id;
}

/**
 * The reply a command in `trigger` answers with, as the community's bot
 * profile, or null when the post holds no built-in command. The caller
 * writes the reply as a post in reply to `trigger.id`.
 */
export async function commandReply(
  ctx: MutationCtx,
  trigger: CommandTrigger,
): Promise<{ authorProfileId: string; content: string } | null> {
  const parsed = parseSlashCommand(trigger.content);
  if (!parsed) return null;
  const command = BUILTIN_COMMANDS.find((cmd) => cmd.name === parsed.name);
  if (!command) return null;
  const authorProfileId = await botProfileId(ctx);

  if (command.requiredRole) {
    let role: string | null = null;
    if (trigger.actorMember) {
      const { rows: members } = await ctx.sql<{ role: string }>`
        SELECT role FROM members WHERE member = ${trigger.actorMember}`;
      role = members[0]?.role ?? null;
    }
    if (!roleSatisfies(role, command.requiredRole))
      return {
        authorProfileId,
        content: "이 명령어를 사용할 권한이 없습니다.",
      };
  }

  return {
    authorProfileId,
    content: await command.run(ctx, {
      args: parsed.args,
      trigger,
      commands: BUILTIN_COMMANDS,
    }),
  };
}
