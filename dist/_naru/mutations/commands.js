// Turning the built-in slash commands on and off, the community owner's.
import { requireOwner } from "../modules/access.js";
import { BUILTIN_COMMANDS } from "../modules/commands.js";
import { argsOf, invalid, notFound, } from "../modules/core.js";
export async function setEnabled(ctx, args) {
    await requireOwner(ctx);
    const a = argsOf(args);
    const command = BUILTIN_COMMANDS.find((cmd) => cmd.name === a.name);
    if (!command)
        notFound(ctx, "명령어를 찾을 수 없습니다");
    if (typeof a.enabled !== "boolean")
        invalid(ctx, "enabled는 참이나 거짓이어야 합니다.");
    if (a.enabled) {
        await ctx.sql `DELETE FROM disabled_commands WHERE name = ${command.name}`;
    }
    else {
        await ctx.sql `
      INSERT INTO disabled_commands (name) VALUES (${command.name})
      ON CONFLICT (name) DO NOTHING`;
    }
    return { name: command.name, enabled: a.enabled };
}
