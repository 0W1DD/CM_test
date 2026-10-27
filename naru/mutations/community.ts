// Changing the community: its settings, theme color and links (commung's
// console community update and links routes, and the app's
// PATCH /me/instance/theme). All the community owner's.
import { requireOwner } from "../modules/access.js";
import {
  type LinkRow,
  linkJson,
  settingsValuesOf,
  themeColorOf,
  writeSettings,
} from "../modules/admin.js";
import { settingsJson, settingsOf } from "../modules/community.js";
import {
  argsOf,
  type Ctx,
  id,
  invalid,
  type MutationCtx,
  notFound,
  uuidv7,
} from "../modules/core.js";

async function currentSettings(ctx: MutationCtx) {
  const settings = await settingsOf(ctx);
  if (!settings) notFound(ctx, "커뮤를 찾을 수 없습니다");
  return settings;
}

/**
 * Updates the settings: name, description, dates, recruiting window,
 * minimum birth year, member and timeline options, theme color and banner
 * image (an image registered with images:register; null removes it).
 * Fields left out keep their values.
 */
export async function update(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const current = await currentSettings(ctx);
  await writeSettings(ctx, await settingsValuesOf(ctx, argsOf(args), current));
  return settingsJson(ctx, await settingsOf(ctx));
}

/** Sets or clears the theme key color (the app's community settings). */
export async function setTheme(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  await currentSettings(ctx);
  const color = themeColorOf(ctx, argsOf(args).theme_key_color ?? null);
  await ctx.sql`
    UPDATE settings SET theme_key_color = ${color}, updated_at = ${ctx.now} WHERE id = 1`;
  return { theme_key_color: color };
}

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

function linkFields(ctx: Ctx, a: Record<string, unknown>) {
  const title = typeof a.title === "string" ? a.title.trim() : "";
  const url = typeof a.url === "string" ? a.url.trim() : "";
  if (!title || !url) invalid(ctx, "제목과 URL을 모두 입력해주세요");
  if (title.length > 200) invalid(ctx, "링크 제목은 200자 이하여야 합니다.");
  if (url.length > 2000 || !URL_PATTERN.test(url))
    invalid(ctx, "올바른 URL을 입력해주세요", "invalid_url");
  return { title, url };
}

export async function createLink(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const { title, url } = linkFields(ctx, argsOf(args));
  const { rows } = await ctx.sql<LinkRow>`
    INSERT INTO community_links (id, title, url, created_at, updated_at)
    VALUES (${uuidv7(ctx.now)}, ${title}, ${url}, ${ctx.now}, ${ctx.now})
    RETURNING id, title, url, created_at, updated_at`;
  return linkJson(rows[0]);
}

export async function updateLink(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const a = argsOf(args);
  const linkId = id(ctx, a.link_id, "link_id");
  const { title, url } = linkFields(ctx, a);
  const { rows } = await ctx.sql<LinkRow>`
    UPDATE community_links SET title = ${title}, url = ${url}, updated_at = ${ctx.now}
    WHERE id = ${linkId} AND deleted_at IS NULL
    RETURNING id, title, url, created_at, updated_at`;
  if (!rows[0]) notFound(ctx, "링크를 찾을 수 없습니다");
  return linkJson(rows[0]);
}

export async function deleteLink(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const linkId = id(ctx, argsOf(args).link_id, "link_id");
  const { changes } = await ctx.sql`
    UPDATE community_links SET deleted_at = ${ctx.now}
    WHERE id = ${linkId} AND deleted_at IS NULL`;
  if (!changes) notFound(ctx, "링크를 찾을 수 없습니다");
  return { id: linkId, deleted: true };
}
