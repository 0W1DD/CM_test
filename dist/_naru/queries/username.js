// Whether a username is taken (commung's GET /app/username/:username).
import { argsOf, text } from "../modules/core.js";
import { profileByUsername } from "../modules/ownership.js";
/** `{ exists, username }`: an active profile has this username. For anyone. */
export async function get(ctx, args) {
    const username = text(ctx, argsOf(args).username, "사용자명", { max: 200 });
    const profile = await profileByUsername(ctx, username, { active: true });
    return { exists: profile !== null, username };
}
