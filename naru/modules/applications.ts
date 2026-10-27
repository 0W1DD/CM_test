// Applications to join (commung's community_application and its
// membership.service): who may apply, approving one into a member with a
// profile, and the shapes commung's console answered with.
import {
  logModeration,
  moderatorProfileId,
  primaryProfileIds,
} from "./admin.js";
import type { Settings } from "./community.js";
import { settingsOf } from "./community.js";
import {
  type Ctx,
  invalid,
  iso,
  list,
  type MutationCtx,
  notFound,
  optionalText,
  type SqlValue,
  text,
  uuidv7,
} from "./core.js";

export interface ApplicationRow {
  id: string;
  member: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  profile_name: string;
  profile_username: string;
  profile_id: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: number | null;
  created_at: number;
  updated_at: number;
  attachments_json?: string;
  [key: string]: SqlValue | undefined;
}

/** An application's columns with its attachments as one JSON column. */
export const APPLICATION_SELECT = `SELECT a.*, (
  SELECT json_group_array(json_object('id', t.id, 'image_id', t.image_id,
    'url', i.url, 'width', i.width, 'height', i.height,
    'filename', i.filename, 'image_created_at', i.created_at,
    'created_at', t.created_at))
  FROM application_attachments t JOIN images i ON i.id = t.image_id
  WHERE t.application_id = a.id) AS attachments_json
  FROM applications a`;

interface AttachmentJson {
  id: string;
  image_id: string;
  url: string;
  width: number;
  height: number;
  filename: string;
  image_created_at: number;
  created_at: number;
}

/** Attachments as commung answered them (`image_url` is the image row). */
export function attachmentsJson(row: ApplicationRow) {
  const parsed = JSON.parse(
    String(row.attachments_json ?? "[]"),
  ) as AttachmentJson[];
  return parsed.map((t) => ({
    id: t.id,
    image_id: t.image_id,
    image_url: {
      key: t.image_id,
      id: t.image_id,
      created_at: iso(t.image_created_at),
      deleted_at: null,
      width: t.width,
      height: t.height,
      filename: t.filename,
      url: t.url,
    },
    created_at: iso(t.created_at),
  }));
}

/** An application by ID, with attachments, or a refusal. */
export async function applicationById(ctx: Ctx, applicationId: string) {
  const { rows } = await ctx.sql<ApplicationRow>(
    `${APPLICATION_SELECT} WHERE a.id = ?`,
    [applicationId],
  );
  if (!rows[0]) notFound(ctx, "지원서를 찾을 수 없습니다");
  return rows[0];
}

/** Applications as the console's list and detail answered them. */
export async function reviewJson(ctx: Ctx, rows: ApplicationRow[]) {
  const profiles = await primaryProfileIds(
    ctx,
    rows.flatMap((row) => [row.member, row.reviewed_by]),
  );
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    profile_name: row.profile_name,
    profile_username: row.profile_username,
    message: row.message,
    rejection_reason: row.rejection_reason,
    created_at: iso(row.created_at),
    reviewed_at: iso(row.reviewed_at),
    applicant: { profile_id: profiles.get(row.member) ?? null },
    reviewed_by: row.reviewed_by
      ? { profile_id: profiles.get(row.reviewed_by) ?? null }
      : null,
    attachments: attachmentsJson(row),
  }));
}

/** Whether the community takes applications now (commung's recruiting list). */
export function isRecruiting(settings: Settings, now: number) {
  return (
    settings.is_recruiting === 1 &&
    settings.ends_at > now &&
    (settings.recruiting_starts_at === null ||
      settings.recruiting_starts_at <= now) &&
    (settings.recruiting_ends_at === null || settings.recruiting_ends_at > now)
  );
}

const USERNAME = /^[a-zA-Z0-9_]+$/;

/** An application form's fields, checked as commung's schema checked them. */
export async function applicationFields(ctx: Ctx, a: Record<string, unknown>) {
  const profileName = text(ctx, a.profile_name, "프로필 이름", { max: 100 });
  const raw = text(ctx, a.profile_username, "프로필 ID", { max: 50 });
  if (!USERNAME.test(raw))
    invalid(ctx, "프로필 ID는 영문, 숫자, 언더스코어만 사용할 수 있습니다.");
  const rawIds = a.attachment_ids ?? [];
  if (
    !Array.isArray(rawIds) ||
    rawIds.length > 20 ||
    rawIds.some((v) => typeof v !== "string" || !v || v.length > 200)
  )
    invalid(ctx, "attachment_ids 값이 올바르지 않습니다.");
  const attachmentIds = [...new Set(rawIds as string[])];
  if (attachmentIds.length) {
    const { rows } = await ctx.sql<{ n: number }>`
      SELECT count(*) AS n FROM images
      WHERE id IN (SELECT value FROM json_each(${list(attachmentIds)}))
        AND deleted_at IS NULL`;
    if (rows[0].n !== attachmentIds.length)
      invalid(
        ctx,
        "하나 이상의 첨부 이미지를 찾을 수 없습니다",
        "invalid_image",
      );
  }
  return {
    message: optionalText(ctx, a.message, "신청 메시지", { max: 10000 }),
    profileName,
    profileUsername: raw.toLowerCase(),
    attachmentIds,
  };
}

/**
 * Refuses a username a live profile holds (unless it is the applicant's own
 * deactivated one) or another member's pending application holds.
 */
export async function checkUsernameFree(
  ctx: Ctx,
  member: string,
  username: string,
  exceptApplication: string | null,
) {
  const { rows: taken } = await ctx.sql<{
    own: number;
    activated_at: number | null;
  }>`
    SELECT p.activated_at, EXISTS (SELECT 1 FROM profile_owners o
      WHERE o.profile_id = p.id AND o.member = ${member} AND o.role = 'owner') AS own
    FROM profiles p
    WHERE lower(p.username) = ${username} AND p.deleted_at IS NULL`;
  const profile = taken[0];
  if (profile && (!profile.own || profile.activated_at !== null))
    ctx.fail(
      "CONFLICT",
      "이 사용자명은 이미 사용중입니다. 다른 사용자명을 선택해주세요",
      { reason: "username_taken" },
    );
  const { rows: pending } = await ctx.sql`
    SELECT id FROM applications
    WHERE lower(profile_username) = ${username} AND status = 'pending'
      AND member <> ${member} AND id <> ${exceptApplication ?? ""}
    LIMIT 1`;
  if (pending.length)
    ctx.fail(
      "CONFLICT",
      "이 사용자명은 다른 대기 중인 지원서에서 사용중입니다. 다른 사용자명을 선택해주세요",
      { reason: "username_pending" },
    );
}

export async function writeAttachments(
  ctx: Ctx,
  applicationId: string,
  imageIds: readonly string[],
) {
  if (!imageIds.length) return;
  await ctx.sql`
    INSERT INTO application_attachments (id, application_id, image_id, created_at)
    SELECT json_extract(value, '$[0]'), ${applicationId}, json_extract(value, '$[1]'), ${ctx.now}
    FROM json_each(${JSON.stringify(imageIds.map((imageId) => [uuidv7(ctx.now), imageId]))})`;
}

/**
 * Approves a pending application (commung's approveMembershipApplication):
 * the applicant becomes a member and gets the application's profile as
 * their primary one, muted when the community mutes new members.
 */
export async function approve(
  ctx: MutationCtx,
  applicationId: string,
  reviewer: string,
) {
  const application = await applicationById(ctx, applicationId);
  if (application.status !== "pending")
    invalid(ctx, "지원서가 대기 중이 아닙니다", "not_pending");
  const settings = await settingsOf(ctx);
  const muted = settings?.mute_new_members === 1;
  const applicant = application.member;

  await ctx.sql`
    UPDATE applications SET status = 'approved', reviewed_at = ${ctx.now},
      reviewed_by = ${reviewer}, updated_at = ${ctx.now}
    WHERE id = ${applicationId}`;
  // A member already (added since applying) keeps their role.
  await ctx.sql`
    INSERT INTO members (member, role, application_id, created_at, updated_at, activated_at)
    VALUES (${applicant}, 'member', ${applicationId}, ${ctx.now}, ${ctx.now}, ${ctx.now})
    ON CONFLICT (member) DO UPDATE SET application_id = excluded.application_id,
      activated_at = excluded.activated_at, updated_at = excluded.updated_at`;

  const reviewerProfileId = muted
    ? await moderatorProfileId(ctx, reviewer, { primaryOnly: true })
    : null;
  const { rows: existing } = await ctx.sql<{
    id: string;
    own: number;
    activated_at: number | null;
  }>`
    SELECT p.id, p.activated_at, EXISTS (SELECT 1 FROM profile_owners o
      WHERE o.profile_id = p.id AND o.member = ${applicant} AND o.role = 'owner') AS own
    FROM profiles p
    WHERE lower(p.username) = ${application.profile_username.toLowerCase()}
      AND p.deleted_at IS NULL`;
  let profileId: string;
  let description: string;
  if (existing[0]) {
    // The applicant's own deactivated profile (from this application or an
    // earlier membership) comes back; anyone else's username is taken.
    if (!existing[0].own || existing[0].activated_at !== null)
      ctx.fail("CONFLICT", "이 사용자명은 이미 다른 사용자가 사용중입니다", {
        reason: "username_taken",
      });
    profileId = existing[0].id;
    description = "재가입 시 자동 음소거 (커뮤 설정)";
    if (muted)
      await ctx.sql`
        UPDATE profiles SET name = ${application.profile_name}, activated_at = ${ctx.now},
          muted_at = ${ctx.now}, muted_by_id = ${reviewerProfileId}, updated_at = ${ctx.now}
        WHERE id = ${profileId}`;
    else
      await ctx.sql`
        UPDATE profiles SET name = ${application.profile_name}, activated_at = ${ctx.now},
          updated_at = ${ctx.now}
        WHERE id = ${profileId}`;
  } else {
    profileId = uuidv7(ctx.now);
    description = "신규 가입 시 자동 음소거 (커뮤 설정)";
    await ctx.sql`
      INSERT INTO profiles (id, name, username, is_primary, muted_at, muted_by_id,
        activated_at, created_at, updated_at)
      VALUES (${profileId}, ${application.profile_name}, ${application.profile_username},
        0, ${muted ? ctx.now : null}, ${muted ? reviewerProfileId : null},
        ${ctx.now}, ${ctx.now}, ${ctx.now})`;
    await ctx.sql`
      INSERT INTO profile_owners (profile_id, member, role, created_at, created_by)
      VALUES (${profileId}, ${applicant}, 'owner', ${ctx.now}, ${reviewer})`;
  }
  if (muted && reviewerProfileId)
    await logModeration(ctx, {
      action: "mute_profile",
      description,
      moderator: reviewerProfileId,
      target_profile_id: profileId,
      target_member: applicant,
    });
  await ctx.sql`
    UPDATE profiles SET is_primary = CASE WHEN id = ${profileId} THEN 1 ELSE 0 END
    WHERE deleted_at IS NULL AND id IN (
      SELECT profile_id FROM profile_owners WHERE member = ${applicant} AND role = 'owner')`;
  await ctx.sql`
    UPDATE applications SET profile_id = ${profileId} WHERE id = ${applicationId}`;

  if (settings)
    await ctx.notify([applicant], {
      title: "가입 신청 승인",
      body: `${settings.name} 가입이 승인되었습니다`,
      path: "/",
    });
  return { membership_id: applicant, profile_id: profileId };
}

/** The owner and moderators, for notifying them. */
export async function staffMembers(ctx: Ctx): Promise<string[]> {
  const { rows } = await ctx.sql<{ member: string; role: string }>`
    SELECT member, role FROM members WHERE role IN ('owner', 'moderator')
    ORDER BY role = 'owner' DESC LIMIT 1000`;
  return rows.map((row) => row.member);
}
