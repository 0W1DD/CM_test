// The slash commands members can use (commung's GET /app/commands), for the
// composer's suggestions: the built-in ones, always on.
import { requireMembership } from "../modules/access.js";
import { BUILTIN_COMMANDS } from "../modules/commands.js";
export async function list(ctx) {
    await requireMembership(ctx);
    return BUILTIN_COMMANDS.map((cmd) => ({
        id: cmd.name,
        name: cmd.name,
        description: cmd.description,
    }));
}
