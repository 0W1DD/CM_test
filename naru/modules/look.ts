// The community's look in index.html's <head> (routes.ts), as the page
// would apply it once its scripts load (app/components/
// community-theme-injector.tsx), so the first paint is already the
// community's: the theme colour's CSS, the site's /_owner/style.css when the
// owner turned it on, and 사용자 CSS, last. The <style> and <link> elements
// carry the ids the page reuses. Nothing in the CSS can end its element: a
// `</` in it is written `<\/`, which CSS reads as the same two characters.
import { settingsOf } from "./community.js";
import type { Ctx } from "./core.js";
import { buildThemeCss } from "./theme.js";

/** The site owner's stylesheet in Naru's _owner/ folder (owner_files). */
export const OWNER_STYLE = "/_owner/style.css";
/** And its script, which the page loads once it is set up. */
export const OWNER_SCRIPT = "/_owner/script.js";

export async function lookHead(ctx: Ctx): Promise<string> {
  const settings = await settingsOf(ctx);
  const css = (text: string) => text.replace(/<\//g, "<\\/");
  const theme = buildThemeCss(settings?.theme_key_color);
  return [
    theme && `<style id="community-theme">${css(theme)}</style>`,
    settings?.owner_files === 1 &&
      `<link rel="stylesheet" id="owner-file" href="${OWNER_STYLE}" />`,
    settings?.custom_css &&
      `<style id="community-owner-css">${css(settings.custom_css)}</style>`,
  ]
    .filter(Boolean)
    .join("\n");
}
