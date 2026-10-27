// What a built-in slash command is. Each command is one file in commands/,
// named after it, whose default export is `defineCommand({ ... })`, and is
// listed in commands.ts; docs/commands.md shows how to write one.
import type { MutationCtx } from "./core.js";
import { ShopError } from "./shop.js";

export type CommandRole = "owner" | "moderator";

/** The post a command is in. */
export interface CommandTrigger {
  /** The post that may hold a command. */
  id: string;
  content: string;
  authorProfileId: string;
  /** The member who wrote it (for a bot's post, the bot's creator). */
  actorMember: string | null;
  rootPostId: string | null;
}

export interface CommandInput {
  /** What follows the command's name, as written (may be ""). */
  args: string;
  trigger: CommandTrigger;
  /** Every built-in command, for /help. */
  commands: readonly Command[];
}

export interface Command {
  /** What follows the slash: lowercase letters, digits, `-` and `_`, up to 31. */
  name: string;
  /** One line, shown in the composer's suggestions and in /help. */
  description: string;
  /** Who may run it; anyone when left out. */
  requiredRole?: CommandRole;
  /**
   * The reply the community's bot posts. It runs inside the mutation that
   * published the post: what it writes with `ctx.sql` is kept only if the
   * post is, and a throw fails the post. Return a message for mistakes
   * (wrong arguments, not enough money) instead of throwing.
   */
  run(ctx: MutationCtx, input: CommandInput): Promise<string>;
}

/** A command, typed: `export default defineCommand({ name, description, run })`. */
export const defineCommand = (command: Command): Command => command;

// ---------- For the shop's commands ----------

/** Runs a shop change, answering the shop's refusal as the reply. */
export async function orShopMessage(fn: () => Promise<string>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ShopError) return error.message;
    throw error;
  }
}

export function itemNotFound(name: string) {
  return new ShopError(
    "NOT_FOUND",
    `상품을 찾을 수 없습니다: ${name}`,
    "not_found",
  );
}
