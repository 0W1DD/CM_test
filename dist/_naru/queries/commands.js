// The slash commands members can use (commung's GET /app/commands), for the
// composer's suggestions: the built-in ones the owner has not turned off.
import { requireMembership, requireOwner } from "../modules/access.js";
import { BUILTIN_COMMANDS, enabledCommands } from "../modules/commands.js";
export async function list(ctx) {
    await requireMembership(ctx);
    return (await enabledCommands(ctx)).map((cmd) => ({
        id: cmd.name,
        name: cmd.name,
        description: cmd.description,
    }));
}
/** Every built-in command and whether it is on, for the owner's page. */
export async function settings(ctx) {
    await requireOwner(ctx);
    const enabled = new Set((await enabledCommands(ctx)).map((cmd) => cmd.name));
    return BUILTIN_COMMANDS.map((cmd) => ({
        name: cmd.name,
        description: cmd.description,
        enabled: enabled.has(cmd.name),
    }));
}
