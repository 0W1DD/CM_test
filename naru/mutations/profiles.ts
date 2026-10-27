// Writing profiles: commung's POST/PUT/DELETE /app/profiles, PUT
// /me/profiles (as `update`), /profiles/set-primary, /profile-picture,
// /profiles/online-status-settings, profile sharing, and the last-activity
// heartbeat.
import {
  actingProfile,
  requireOwner,
  requireStaff,
} from "../modules/access.js";
import {
  argsOf,
  invalid,
  iso,
  type MutationCtx,
  id,
  text,
  uuidv7,
} from "../modules/core.js";
import { imageJson, ownImages } from "../modules/images.js";
import {
  ownedProfile,
  ownerOf,
  profileByUsername,
  usernameOf,
} from "../modules/ownership.js";
import {
  PROFILE_COLUMNS,
  PROFILE_PICTURE_JOIN,
  type ProfileJsonRow,
  profileJson,
} from "../modules/profiles.js";

/** A heartbeat is written at most this often for a profile. */
const HEARTBEAT_EVERY_MS = 60 * 1000;

const USERNAME_TAKEN = "이 커뮤에서 이미 사용 중인 사용자명입니다";

/** A bio as commung took it: absent leaves it, null or blank clears it. */
function bioOf(ctx: MutationCtx, value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") invalid(ctx, "소개 값이 올바르지 않습니다.");
  if (value.length > 10000) invalid(ctx, "소개는 10000자 이하여야 합니다.");
  return value.trim() ? value : null;
}

/** A profile picture: one of the caller's own images. */
async function pictureOf(ctx: MutationCtx, value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const imageId = text(ctx, value, "profile_picture_id", { max: 200 });
  const images = await ownImages(ctx, [imageId]).catch(() =>
    invalid(ctx, "잘못된 프로필 사진 ID입니다", "invalid_profile_picture"),
  );
  return images[0];
}

async function profileAnswer(ctx: MutationCtx, profileId: string) {
  const { rows } = await ctx.sql<ProfileJsonRow>(
    `SELECT ${PROFILE_COLUMNS} FROM profiles p ${PROFILE_PICTURE_JOIN}
     WHERE p.id = ?`,
    [profileId],
  );
  const row = rows[0];
  return {
    ...profileJson(row),
    activatedAt: iso(row.activated_at),
    online_status_visible: row.online_status_visible === 1,
  };
}

/** Unsets primary on every live profile `member` owns. */
async function clearPrimary(ctx: MutationCtx, member: string) {
  await ctx.sql`
    UPDATE profiles SET is_primary = 0
    WHERE is_primary = 1 AND deleted_at IS NULL AND id IN (
      SELECT profile_id FROM profile_owners WHERE member = ${member} AND role = 'owner')`;
}

/**
 * Another profile for the calling member, active at once (commung's POST
 * /profiles: moderators and the owner).
 */
export async function create(ctx: MutationCtx, args: unknown) {
  const membership = await requireStaff(ctx);
  const a = argsOf(args);
  const name = text(ctx, a.name, "이름", { max: 100 });
  const username = usernameOf(ctx, a.username);
  const bio = bioOf(ctx, a.bio) ?? null;
  const isPrimary = a.is_primary === true;
  if (await profileByUsername(ctx, username))
    invalid(ctx, USERNAME_TAKEN, "username_taken");
  const picture = await pictureOf(ctx, a.profile_picture_id);
  if (isPrimary) await clearPrimary(ctx, membership.member);
  const profileId = await insertProfile(ctx, {
    member: membership.member,
    name,
    username,
    bio,
    isPrimary,
    pictureId: picture?.id ?? null,
  });
  const profile = await profileAnswer(ctx, profileId);
  return { ...profile, primary: profile.is_primary };
}

/** Inserts an active profile owned by `member`; answers its ID. */
async function insertProfile(
  ctx: MutationCtx,
  p: {
    member: string;
    name: string;
    username: string;
    bio: string | null;
    isPrimary: boolean;
    pictureId: string | null;
  },
) {
  const profileId = uuidv7(ctx.now);
  await ctx.sql`
    INSERT INTO profiles (id, name, username, bio, picture_id, is_primary,
      activated_at, created_at, updated_at)
    VALUES (${profileId}, ${p.name}, ${p.username}, ${p.bio}, ${p.pictureId},
      ${p.isPrimary}, ${ctx.now}, ${ctx.now}, ${ctx.now})`;
  await ctx.sql`
    INSERT INTO profile_owners (profile_id, member, role, created_at, created_by)
    VALUES (${profileId}, ${p.member}, 'owner', ${ctx.now}, ${p.member})`;
  return profileId;
}

/**
 * Changes a profile's name, username, bio and picture (commung's PUT
 * /profiles and PUT /me/profiles): its owner.
 */
export async function update(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await ownedProfile(
    ctx,
    a.profile_id,
    "프로필을 찾을 수 없거나 관리 권한이 없습니다",
  );
  const name = text(ctx, a.name, "이름", { max: 100 });
  const username = usernameOf(ctx, a.username);
  const bio = bioOf(ctx, a.bio);
  if (username !== profile.username.toLowerCase()) {
    const other = await profileByUsername(ctx, username);
    if (other && other.id !== profile.id)
      invalid(ctx, "사용자명이 이미 사용 중입니다", "username_taken");
  }
  const picture = await pictureOf(ctx, a.profile_picture_id);
  await ctx.sql`
    UPDATE profiles SET name = ${name}, username = ${username},
      bio = CASE WHEN ${bio === undefined} THEN bio ELSE ${bio ?? null} END,
      picture_id = coalesce(${picture?.id ?? null}, picture_id),
      updated_at = ${ctx.now}
    WHERE id = ${profile.id}`;
  return await profileAnswer(ctx, profile.id);
}

/**
 * Sets a profile's picture to an image the caller uploaded and registered
 * (images:register), in place of commung's upload to /profile-picture: its
 * owner or a member it is shared with.
 */
export async function setPicture(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await actingProfile(ctx, a.profile_id);
  if (profile.activated_at === null)
    ctx.fail("NOT_FOUND", "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다", {
      reason: "not_found",
    });
  const imageId = text(ctx, a.image_id, "image_id", { max: 200 });
  const [image] = await ownImages(ctx, [imageId]);
  await ctx.sql`
    UPDATE profiles SET picture_id = ${image.id}, updated_at = ${ctx.now}
    WHERE id = ${profile.id}`;
  return { ...imageJson(image), image_id: image.id };
}

/** Deletes a profile the caller owns, but not their primary or only one. */
async function deleteProfile(ctx: MutationCtx, args: unknown) {
  const profile = await ownedProfile(
    ctx,
    argsOf(args).profile_id,
    "프로필을 찾을 수 없거나 관리 권한이 없습니다",
  );
  if (profile.is_primary === 1)
    invalid(ctx, "메인 프로필은 삭제할 수 없습니다", "primary_profile");
  const { rows } = await ctx.sql<{ n: number }>`
    SELECT count(*) AS n FROM profile_owners o
    JOIN profiles p ON p.id = o.profile_id AND p.deleted_at IS NULL
    WHERE o.member = ${profile.membership.member}`;
  if ((rows[0]?.n ?? 0) <= 1)
    invalid(ctx, "유일한 프로필은 삭제할 수 없습니다", "only_profile");
  await ctx.sql`
    UPDATE profiles SET deleted_at = ${ctx.now}, activated_at = NULL,
      updated_at = ${ctx.now}
    WHERE id = ${profile.id}`;
  return { id: profile.id, deleted: true };
}
export { deleteProfile as delete };

/** Makes a profile the caller owns their primary one. */
export async function setPrimary(ctx: MutationCtx, args: unknown) {
  const profile = await ownedProfile(
    ctx,
    argsOf(args).profile_id,
    "공유된 프로필은 기본 프로필로 설정할 수 없습니다",
    "ACCESS_DENIED",
  );
  if (profile.activated_at === null)
    ctx.fail("NOT_FOUND", "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다", {
      reason: "not_found",
    });
  await clearPrimary(ctx, profile.membership.member);
  await ctx.sql`UPDATE profiles SET is_primary = 1 WHERE id = ${profile.id}`;
  return { profile_id: profile.id, is_primary: true, updated_at: iso(ctx.now) };
}

/** Shows or hides a profile's online status: its owner. */
export async function updateOnlineStatusSettings(
  ctx: MutationCtx,
  args: unknown,
) {
  const a = argsOf(args);
  const profile = await ownedProfile(
    ctx,
    a.profile_id,
    "프로필을 찾을 수 없거나 관리 권한이 없습니다",
  );
  if (typeof a.visible !== "boolean")
    invalid(ctx, "visible 값이 올바르지 않습니다.");
  await ctx.sql`
    UPDATE profiles SET online_status_visible = ${a.visible}
    WHERE id = ${profile.id}`;
  return {
    profile_id: profile.id,
    visible: a.visible,
    updated_at: iso(ctx.now),
  };
}

/**
 * Marks a profile the caller acts as active now, for online status; written
 * at most once a minute (commung's debounced updateLastActivity).
 */
export async function heartbeat(ctx: MutationCtx, args: unknown) {
  const profile = await actingProfile(ctx, argsOf(args).profile_id);
  await ctx.sql`
    INSERT INTO profile_activity (profile_id, last_active_at)
    VALUES (${profile.id}, ${ctx.now})
    ON CONFLICT (profile_id) DO UPDATE SET last_active_at = excluded.last_active_at
    WHERE profile_activity.last_active_at <= ${ctx.now - HEARTBEAT_EVERY_MS}`;
  return { profile_id: profile.id };
}

/**
 * Shares a profile with the member who owns the profile `username`, as
 * `admin`: the community owner, for a profile they own.
 */
export async function addUser(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const a = argsOf(args);
  const profile = await ownedProfile(
    ctx,
    a.profile_id,
    "이 프로필을 관리할 권한이 없습니다",
    "ACCESS_DENIED",
  );
  const username = text(ctx, a.username, "사용자명", { max: 200 });
  if (a.role !== "admin") invalid(ctx, "role 값이 올바르지 않습니다.");
  if (profile.is_primary === 1)
    invalid(ctx, "주 프로필는 공유할 수 없습니다", "primary_profile");
  const target = await profileByUsername(ctx, username);
  const targetMember = target ? await ownerOf(ctx, target.id) : null;
  if (!targetMember)
    ctx.fail("NOT_FOUND", "사용자를 찾을 수 없습니다", { reason: "not_found" });
  const { rows: members } = await ctx.sql`
    SELECT 1 FROM members WHERE member = ${targetMember}`;
  if (!members.length)
    invalid(ctx, "사용자가 이 커뮤의 회원이 아닙니다", "not_member");
  const { rows: existing } = await ctx.sql`
    SELECT 1 FROM profile_owners
    WHERE profile_id = ${profile.id} AND member = ${targetMember}`;
  if (existing.length)
    invalid(
      ctx,
      "사용자가 이미 이 프로필에 액세스 권한을 가지고 있습니다",
      "already_shared",
    );
  await ctx.sql`
    INSERT INTO profile_owners (profile_id, member, role, created_at, created_by)
    VALUES (${profile.id}, ${targetMember}, 'admin', ${ctx.now}, ${profile.membership.member})`;
  const { rows: primary } = await ctx.sql<{ id: string }>`
    SELECT p.id FROM profile_owners o
    JOIN profiles p ON p.id = o.profile_id AND p.deleted_at IS NULL
    WHERE o.member = ${targetMember} AND o.role = 'owner'
    ORDER BY p.is_primary DESC, p.created_at LIMIT 1`;
  return {
    message: "사용자가 성공적으로 추가되었습니다",
    user: { primary_profile_id: primary[0]?.id ?? null, role: "admin" },
  };
}

/**
 * Stops sharing a profile with the member who owns `shared_profile_id`
 * (commung's DELETE /profiles/:profile_id/shared-profiles/:shared_profile_id).
 */
export async function removeUser(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const a = argsOf(args);
  const profile = await ownedProfile(
    ctx,
    a.profile_id,
    "이 프로필을 관리할 권한이 없습니다",
    "ACCESS_DENIED",
  );
  const sharedProfileId = id(ctx, a.shared_profile_id, "shared_profile_id");
  const targetMember = await ownerOf(ctx, sharedProfileId);
  if (!targetMember)
    ctx.fail("NOT_FOUND", "프로필 소유권을 찾을 수 없습니다", {
      reason: "not_found",
    });
  if (targetMember === profile.membership.member) {
    const { rows } = await ctx.sql<{ n: number }>`
      SELECT count(*) AS n FROM profile_owners
      WHERE profile_id = ${profile.id} AND role = 'owner'`;
    if ((rows[0]?.n ?? 0) <= 1)
      invalid(ctx, "유일한 소유자는 자신을 제거할 수 없습니다", "only_owner");
  }
  await ctx.sql`
    DELETE FROM profile_owners
    WHERE profile_id = ${profile.id} AND member = ${targetMember}`;
  return {
    profile_id: profile.id,
    shared_profile_id: sharedProfileId,
    deleted: true,
  };
}
