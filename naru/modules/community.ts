// The community's settings row (commung's `community`).
import { bool, type Ctx, iso, type SqlValue } from "./core.js";

export interface Settings {
  name: string;
  description: string | null;
  starts_at: number;
  ends_at: number;
  is_recruiting: number;
  recruiting_starts_at: number | null;
  recruiting_ends_at: number | null;
  minimum_birth_year: number | null;
  mute_new_members: number;
  show_all_replies: number;
  bump_on_reply: number;
  auto_approve: number;
  theme_key_color: string | null;
  banner_image_id: string | null;
  banner_image_url: string | null;
  custom_css: string | null;
  owner_files: number;
  gate_html: string | null;
  gate_image_id: string | null;
  gate_image_url: string | null;
  created_at: number;
  updated_at: number;
  [key: string]: SqlValue;
}

/** The settings, or null before the owner has set the community up. */
export async function settingsOf(ctx: Ctx): Promise<Settings | null> {
  const { rows } = await ctx.sql<Settings>`
    SELECT s.*, i.url AS banner_image_url, g.url AS gate_image_url
    FROM settings s
    LEFT JOIN images i ON i.id = s.banner_image_id
    LEFT JOIN images g ON g.id = s.gate_image_id
    WHERE s.id = 1`;
  return rows[0] ?? null;
}

/** The site's own name, standing in for commung's slug. */
export const slugOf = (ctx: Ctx) => ctx.ownerName;

/** What commung's /instance answered, for anyone. */
export function publicInstance(ctx: Ctx, settings: Settings | null) {
  return {
    id: slugOf(ctx),
    name: settings?.name ?? slugOf(ctx),
    slug: slugOf(ctx),
    description: settings?.description ?? null,
    banner_image_url: settings?.banner_image_url ?? null,
    theme_key_color: settings?.theme_key_color ?? null,
    // The site owner's own look (lookHead, routes.ts): 사용자 CSS, and whether
    // the page loads /_owner/style.css and /_owner/script.js.
    custom_css: settings?.custom_css ?? null,
    owner_files: bool(settings?.owner_files),
    // The front gate (home.tsx), for visitors who are not members yet: the
    // owner's HTML, which the page sanitizes, and its picture.
    gate_html: settings?.gate_html ?? null,
    gate_image_url: settings?.gate_image_url ?? null,
    is_set_up: settings !== null,
  };
}

/** The settings as the owner's settings page reads and writes them. */
export function settingsJson(ctx: Ctx, settings: Settings | null) {
  return {
    ...publicInstance(ctx, settings),
    starts_at: iso(settings?.starts_at),
    ends_at: iso(settings?.ends_at),
    is_recruiting: bool(settings?.is_recruiting),
    recruiting_starts_at: iso(settings?.recruiting_starts_at),
    recruiting_ends_at: iso(settings?.recruiting_ends_at),
    minimum_birth_year: settings?.minimum_birth_year ?? null,
    mute_new_members: bool(settings?.mute_new_members),
    show_all_replies: bool(settings?.show_all_replies),
    bump_on_reply: bool(settings?.bump_on_reply),
    auto_approve: bool(settings?.auto_approve),
    banner_image_id: settings?.banner_image_id ?? null,
    gate_image_id: settings?.gate_image_id ?? null,
    created_at: iso(settings?.created_at),
  };
}
