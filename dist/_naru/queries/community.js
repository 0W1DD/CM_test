// The community's settings and links (commung's console community detail,
// settings and links routes).
import { requireOwner, requireSiteOwner } from "../modules/access.js";
import { settingsJson, settingsOf } from "../modules/community.js";
import { linkJson } from "../modules/admin.js";
/** The settings as the owner's settings page reads them. */
export async function settings(ctx) {
    await requireOwner(ctx);
    return settingsJson(ctx, await settingsOf(ctx));
}
/** The community's links, newest first, for anyone. */
export async function links(ctx) {
    const { rows } = await ctx.sql `
    SELECT id, title, url, created_at, updated_at FROM community_links
    WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1000`;
    return rows.map(linkJson);
}
/**
 * For the site's owner signed in as the owner: whether the community is set
 * up and which member owns it, so the admin page can offer to set it up or
 * to claim it.
 */
export async function ownerStatus(ctx) {
    requireSiteOwner(ctx);
    const settings = await settingsOf(ctx);
    const { rows } = await ctx.sql `
    SELECT member FROM members WHERE role = 'owner' LIMIT 1`;
    return {
        is_set_up: settings !== null,
        owner_member: rows[0]?.member ?? null,
    };
}
