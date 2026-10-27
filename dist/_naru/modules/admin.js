import { invalid, iso, list, msOf, optionalText, text, uuidv7, } from "./core.js";
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const DEFAULTS = {
    name: "",
    description: null,
    starts_at: 0,
    ends_at: 0,
    is_recruiting: 0,
    recruiting_starts_at: null,
    recruiting_ends_at: null,
    minimum_birth_year: null,
    mute_new_members: 0,
    show_all_replies: 0,
    bump_on_reply: 0,
    auto_approve: 0,
    theme_key_color: null,
    banner_image_id: null,
    gate_html: null,
    gate_image_id: null,
};
function flag(ctx, value, field) {
    if (typeof value !== "boolean")
        invalid(ctx, `${field} 값이 올바르지 않습니다.`);
    return value ? 1 : 0;
}
/** A theme key color (#RRGGBB, lower-cased) or null. */
export function themeColorOf(ctx, value) {
    if (value === null || value === "")
        return null;
    if (typeof value !== "string" || !HEX_COLOR.test(value))
        invalid(ctx, "테마 색상은 #RRGGBB 형식이어야 합니다.");
    return value.toLowerCase();
}
/**
 * The settings `a` asks for over `current` (fields left out keep theirs),
 * checked as commung's community form and API checked them.
 */
export async function settingsValuesOf(ctx, a, current) {
    const out = { ...DEFAULTS };
    if (current)
        for (const key of Object.keys(DEFAULTS))
            out[key] = current[key];
    const has = (key) => Object.hasOwn(a, key) && a[key] !== undefined;
    if (has("name") || !current)
        out.name = text(ctx, a.name, "커뮤 이름", { max: 100 });
    if (has("description"))
        out.description = optionalText(ctx, a.description, "커뮤 소개", {
            max: 10000,
        });
    if (has("starts_at") || !current)
        out.starts_at = msOf(ctx, a.starts_at, "시작일") ?? ctx.now;
    if (has("ends_at") || !current) {
        const endsAt = msOf(ctx, a.ends_at, "종료일");
        if (endsAt === null)
            invalid(ctx, "시작일과 종료일을 모두 선택해주세요");
        out.ends_at = endsAt;
    }
    if (out.ends_at <= out.starts_at)
        invalid(ctx, "종료일은 시작일보다 나중이어야 합니다");
    if (has("is_recruiting"))
        out.is_recruiting = flag(ctx, a.is_recruiting, "모집 여부");
    if (has("recruiting_starts_at"))
        out.recruiting_starts_at = msOf(ctx, a.recruiting_starts_at, "모집 시작일");
    if (has("recruiting_ends_at"))
        out.recruiting_ends_at = msOf(ctx, a.recruiting_ends_at, "모집 종료일");
    if (out.recruiting_starts_at !== null && out.recruiting_ends_at === null)
        invalid(ctx, "모집 시작일을 설정했다면 모집 종료일도 설정해주세요");
    if (out.recruiting_starts_at === null && out.recruiting_ends_at !== null)
        invalid(ctx, "모집 종료일을 설정했다면 모집 시작일도 설정해주세요");
    if (out.recruiting_starts_at !== null &&
        out.recruiting_ends_at !== null &&
        out.recruiting_ends_at <= out.recruiting_starts_at)
        invalid(ctx, "모집 종료일은 모집 시작일보다 나중이어야 합니다");
    if (has("minimum_birth_year")) {
        const year = a.minimum_birth_year;
        if (year === null || year === "")
            out.minimum_birth_year = null;
        else if (typeof year !== "number" || !Number.isInteger(year) || year < 1900)
            invalid(ctx, "최소 나이 제한 값이 올바르지 않습니다.");
        else
            out.minimum_birth_year = year;
    }
    if (has("mute_new_members"))
        out.mute_new_members = flag(ctx, a.mute_new_members, "신규 멤버 자동 음소거");
    if (has("show_all_replies"))
        out.show_all_replies = flag(ctx, a.show_all_replies, "모든 답글 표시");
    if (has("bump_on_reply"))
        out.bump_on_reply = flag(ctx, a.bump_on_reply, "답글도 타임라인에 올리기");
    if (has("auto_approve"))
        out.auto_approve = flag(ctx, a.auto_approve, "가입 자동 승인");
    if (has("theme_key_color"))
        out.theme_key_color = themeColorOf(ctx, a.theme_key_color);
    if (has("banner_image_id"))
        out.banner_image_id = await imageIdOf(ctx, a.banner_image_id, "배너 이미지");
    // The front gate (home.tsx): the owner's HTML, sanitized as the page
    // shows it, and its picture.
    if (has("gate_html"))
        out.gate_html = optionalText(ctx, a.gate_html, "첫 화면 글", {
            max: 20000,
        });
    if (has("gate_image_id"))
        out.gate_image_id = await imageIdOf(ctx, a.gate_image_id, "첫 화면 그림");
    return out;
}
/** A registered image's ID (images:register), or null to remove it. */
async function imageIdOf(ctx, value, field) {
    if (value === null || value === "")
        return null;
    const imageId = text(ctx, value, field, { max: 200 });
    const { rows } = await ctx.sql `
    SELECT id FROM images WHERE id = ${imageId} AND deleted_at IS NULL`;
    if (!rows.length)
        invalid(ctx, `잘못된 이미지 ID입니다: ${imageId}`, "invalid_image");
    return imageId;
}
/** Writes the settings row (inserting it when `insert`). */
export async function writeSettings(ctx, v, { insert = false } = {}) {
    if (insert)
        await ctx.sql `
      INSERT INTO settings (id, name, description, starts_at, ends_at,
        is_recruiting, recruiting_starts_at, recruiting_ends_at,
        minimum_birth_year, mute_new_members, show_all_replies, bump_on_reply,
        auto_approve, theme_key_color, banner_image_id, gate_html,
        gate_image_id, created_at, updated_at)
      VALUES (1, ${v.name}, ${v.description}, ${v.starts_at}, ${v.ends_at},
        ${v.is_recruiting}, ${v.recruiting_starts_at}, ${v.recruiting_ends_at},
        ${v.minimum_birth_year}, ${v.mute_new_members}, ${v.show_all_replies},
        ${v.bump_on_reply}, ${v.auto_approve}, ${v.theme_key_color},
        ${v.banner_image_id}, ${v.gate_html}, ${v.gate_image_id}, ${ctx.now},
        ${ctx.now})`;
    else
        await ctx.sql `
      UPDATE settings SET name = ${v.name}, description = ${v.description},
        starts_at = ${v.starts_at}, ends_at = ${v.ends_at},
        is_recruiting = ${v.is_recruiting},
        recruiting_starts_at = ${v.recruiting_starts_at},
        recruiting_ends_at = ${v.recruiting_ends_at},
        minimum_birth_year = ${v.minimum_birth_year},
        mute_new_members = ${v.mute_new_members},
        show_all_replies = ${v.show_all_replies},
        bump_on_reply = ${v.bump_on_reply}, auto_approve = ${v.auto_approve},
        theme_key_color = ${v.theme_key_color},
        banner_image_id = ${v.banner_image_id}, gate_html = ${v.gate_html},
        gate_image_id = ${v.gate_image_id}, updated_at = ${ctx.now}
      WHERE id = 1`;
}
/**
 * Members' primary profiles (commung's getPrimaryProfileIdForUserInCommunity):
 * a live profile they own or were shared, the primary one first.
 */
export async function primaryProfileIds(ctx, members) {
    const wanted = [...new Set(members.filter((m) => !!m))];
    if (!wanted.length)
        return new Map();
    const { rows } = await ctx.sql `
    SELECT o.member, o.profile_id FROM profile_owners o
    JOIN profiles p ON p.id = o.profile_id AND p.deleted_at IS NULL
    WHERE o.member IN (SELECT value FROM json_each(${list(wanted)}))
    ORDER BY p.is_primary DESC, p.created_at`;
    const out = new Map();
    for (const row of rows)
        if (!out.has(row.member))
            out.set(row.member, row.profile_id);
    return out;
}
/** The profile a moderator acts as: their first active profile. */
export async function moderatorProfileId(ctx, member, { primaryOnly = false } = {}) {
    const { rows } = await ctx.sql(`SELECT p.id FROM profile_owners o JOIN profiles p ON p.id = o.profile_id
     WHERE o.member = ? AND p.deleted_at IS NULL AND p.activated_at IS NOT NULL
     ${primaryOnly ? "AND p.is_primary = 1" : ""}
     ORDER BY p.is_primary DESC, p.created_at LIMIT 1`, [member]);
    return rows[0]?.id ?? null;
}
/**
 * Ends a membership as commung's deactivateMembership did: the member's
 * own profiles are deactivated, profiles shared with them are taken back,
 * and their members row goes (so access.ts no longer finds them).
 */
export async function endMembership(ctx, member) {
    await ctx.sql `
    UPDATE profiles SET activated_at = NULL, updated_at = ${ctx.now}
    WHERE deleted_at IS NULL AND id IN (
      SELECT profile_id FROM profile_owners WHERE member = ${member} AND role = 'owner')`;
    await revokeSharedProfiles(ctx, member);
    await ctx.sql `DELETE FROM members WHERE member = ${member}`;
}
/** Takes back the profiles shared with `member` (commung's revokeSharedProfileAccess). */
export async function revokeSharedProfiles(ctx, member) {
    await ctx.sql `
    DELETE FROM profile_owners WHERE member = ${member} AND role <> 'owner'`;
}
/** Logs a moderation action (commung's moderation_log). */
export async function logModeration(ctx, entry) {
    await ctx.sql `
    INSERT INTO moderation_log (id, action, description, moderator,
      target_member, target_profile_id, target_post_id, created_at)
    VALUES (${uuidv7(ctx.now)}, ${entry.action}, ${entry.description},
      ${entry.moderator}, ${entry.target_member ?? null},
      ${entry.target_profile_id ?? null}, ${entry.target_post_id ?? null}, ${ctx.now})`;
}
/** A membership's ID from a page: the member's ID (commung's membership_id). */
export const membershipIdOf = (ctx, value) => text(ctx, value, "membership_id", { max: 200 });
export const linkJson = (row) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
});
