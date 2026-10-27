// What only the site's owner does, signed in as the owner (`admin` handle):
// opening the community and claiming its owner membership. Everything else
// the community's owner does as a member whose role is `owner`.
import { requireSiteOwner } from "../modules/access.js";
import { settingsValuesOf, writeSettings } from "../modules/admin.js";
import { settingsJson, settingsOf } from "../modules/community.js";
import {
  argsOf,
  invalid,
  type MutationCtx,
  optionalText,
  text,
  uuidv7,
} from "../modules/core.js";

/**
 * Opens the community once (commung's create): its name and dates, and any
 * other settings the community settings page writes.
 */
export async function setup(ctx: MutationCtx, args: unknown) {
  requireSiteOwner(ctx);
  if (await settingsOf(ctx))
    invalid(ctx, "이미 개설된 커뮤입니다.", "already_set_up");
  await writeSettings(ctx, await settingsValuesOf(ctx, argsOf(args), null), {
    insert: true,
  });
  return settingsJson(ctx, await settingsOf(ctx));
}

const USERNAME = /^[a-zA-Z0-9_]+$/;

/**
 * Makes `member` (the owner's own member ID, from the member sign-in on the
 * same page) the community's owner; a previous owner stays a member. With
 * `profile_name` and `profile_username`, also gives the owner their first
 * profile, as commung's create did, when they have no active one.
 */
export async function claim(ctx: MutationCtx, args: unknown) {
  requireSiteOwner(ctx);
  const a = argsOf(args);
  const member = text(ctx, a.member, "member", { max: 200 });
  const profileName = optionalText(ctx, a.profile_name, "프로필 이름", {
    max: 100,
  });
  const rawUsername = optionalText(ctx, a.profile_username, "프로필 ID", {
    max: 50,
  });
  if (rawUsername !== null && !USERNAME.test(rawUsername))
    invalid(ctx, "프로필 ID는 영문, 숫자, 언더스코어만 사용할 수 있습니다.");
  await ctx.sql`
    UPDATE members SET role = 'member', updated_at = ${ctx.now}
    WHERE role = 'owner' AND member <> ${member}`;
  await ctx.sql`
    INSERT INTO members (member, role, created_at, updated_at, activated_at)
    VALUES (${member}, 'owner', ${ctx.now}, ${ctx.now}, ${ctx.now})
    ON CONFLICT (member) DO UPDATE SET role = 'owner', updated_at = excluded.updated_at`;

  let profileId: string | null = null;
  if (profileName !== null && rawUsername !== null) {
    const { rows } = await ctx.sql<{ id: string }>`
      SELECT p.id FROM profile_owners o JOIN profiles p ON p.id = o.profile_id
      WHERE o.member = ${member} AND o.role = 'owner'
        AND p.deleted_at IS NULL AND p.activated_at IS NOT NULL
      LIMIT 1`;
    profileId = rows[0]?.id ?? null;
    if (!profileId) {
      const username = rawUsername.toLowerCase();
      const { rows: taken } = await ctx.sql`
        SELECT id FROM profiles WHERE lower(username) = ${username} AND deleted_at IS NULL`;
      if (taken.length)
        ctx.fail(
          "CONFLICT",
          "이 사용자명은 이미 사용중입니다. 다른 사용자명을 선택해주세요",
          { reason: "username_taken" },
        );
      profileId = uuidv7(ctx.now);
      await ctx.sql`
        INSERT INTO profiles (id, name, username, is_primary, activated_at, created_at, updated_at)
        VALUES (${profileId}, ${profileName}, ${username}, 1, ${ctx.now}, ${ctx.now}, ${ctx.now})`;
      await ctx.sql`
        INSERT INTO profile_owners (profile_id, member, role, created_at, created_by)
        VALUES (${profileId}, ${member}, 'owner', ${ctx.now}, ${member})`;
    }
  }
  return { member, role: "owner", profile_id: profileId };
}
