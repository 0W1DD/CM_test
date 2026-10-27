// Applying to join and reviewing applications (commung's console apply,
// application edit/withdraw, review and revoke routes).
import {
  memberId,
  membershipOf,
  requireOwner,
  requireStaff,
} from "../modules/access.js";
import {
  applicationById,
  applicationFields,
  approve,
  checkUsernameFree,
  isRecruiting,
  staffMembers,
  writeAttachments,
} from "../modules/applications.js";
import { settingsOf } from "../modules/community.js";
import {
  argsOf,
  id,
  invalid,
  iso,
  type MutationCtx,
  notFound,
  optionalText,
  uuidv7,
} from "../modules/core.js";

/** Applies to join: a profile name and username, a message, attachments. */
export async function apply(ctx: MutationCtx, args: unknown) {
  const member = memberId(ctx);
  const settings = await settingsOf(ctx);
  if (!settings) notFound(ctx, "커뮤를 찾을 수 없습니다");
  if (await membershipOf(ctx))
    invalid(ctx, "이미 이 커뮤의 회원입니다", "already_member");
  const { rows: pending } = await ctx.sql`
    SELECT id FROM applications WHERE member = ${member} AND status = 'pending' LIMIT 1`;
  if (pending.length)
    invalid(
      ctx,
      "이 커뮤에 이미 대기 중인 지원서가 있습니다",
      "already_pending",
    );
  if (!isRecruiting(settings, ctx.now))
    invalid(ctx, "현재 가입 신청을 받고 있지 않습니다", "not_recruiting");
  const f = await applicationFields(ctx, argsOf(args));
  await checkUsernameFree(ctx, member, f.profileUsername, null);

  const applicationId = uuidv7(ctx.now);
  await ctx.sql`
    INSERT INTO applications (id, member, message, status, profile_name,
      profile_username, created_at, updated_at)
    VALUES (${applicationId}, ${member}, ${f.message}, 'pending', ${f.profileName},
      ${f.profileUsername}, ${ctx.now}, ${ctx.now})`;
  await writeAttachments(ctx, applicationId, f.attachmentIds);

  const staff = await staffMembers(ctx);
  let status = "pending";
  if (settings.auto_approve === 1) {
    // The owner reviews it, or the applicant when there is no owner yet.
    await approve(ctx, applicationId, staff[0] ?? member);
    status = "approved";
    if (staff.length)
      await ctx.notify(staff, {
        title: "새 회원이 자동 승인되었습니다",
        body: `${f.profileName}님이 ${settings.name}에 가입했습니다`,
        path: "/admin/applications",
      });
  } else if (staff.length)
    await ctx.notify(staff, {
      title: "새로운 가입 신청",
      body: `${f.profileName}님이 ${settings.name}에 가입 신청했습니다`,
      path: `/admin/applications/${applicationId}`,
    });

  return {
    id: applicationId,
    status,
    profile_name: f.profileName,
    profile_username: f.profileUsername,
    message: f.message,
    created_at: iso(ctx.now),
  };
}

/** The applicant's own pending application. */
async function ownPending(ctx: MutationCtx, args: unknown, verb: string) {
  const member = memberId(ctx);
  const application = await applicationById(
    ctx,
    id(ctx, argsOf(args).application_id, "application_id"),
  );
  if (application.member !== member) notFound(ctx, "지원서를 찾을 수 없습니다");
  if (application.status !== "pending")
    invalid(ctx, `대기 중인 지원서만 ${verb}할 수 있습니다`, "not_pending");
  return application;
}

/** Edits the applicant's pending application. */
export async function update(ctx: MutationCtx, args: unknown) {
  const application = await ownPending(ctx, args, "수정");
  const f = await applicationFields(ctx, argsOf(args));
  if (f.profileUsername !== application.profile_username.toLowerCase())
    await checkUsernameFree(
      ctx,
      application.member,
      f.profileUsername,
      application.id,
    );
  await ctx.sql`
    UPDATE applications SET message = ${f.message}, profile_name = ${f.profileName},
      profile_username = ${f.profileUsername}, updated_at = ${ctx.now}
    WHERE id = ${application.id}`;
  await ctx.sql`DELETE FROM application_attachments WHERE application_id = ${application.id}`;
  await writeAttachments(ctx, application.id, f.attachmentIds);
  return {
    id: application.id,
    status: application.status,
    profile_name: f.profileName,
    profile_username: f.profileUsername,
    message: f.message,
    updated_at: iso(ctx.now),
  };
}

/** Withdraws (deletes) the applicant's pending application. */
export async function withdraw(ctx: MutationCtx, args: unknown) {
  const application = await ownPending(ctx, args, "철회");
  await ctx.sql`DELETE FROM application_attachments WHERE application_id = ${application.id}`;
  await ctx.sql`DELETE FROM applications WHERE id = ${application.id}`;
  return { id: application.id, withdrawn: true };
}

/** Approves or rejects a pending application (owner and moderators). */
export async function review(ctx: MutationCtx, args: unknown) {
  const reviewer = await requireStaff(ctx);
  const a = argsOf(args);
  const applicationId = id(ctx, a.application_id, "application_id");
  if (a.status !== "approved" && a.status !== "rejected")
    invalid(ctx, "status 값이 올바르지 않습니다.");
  if (a.status === "approved") {
    const result = await approve(ctx, applicationId, reviewer.member);
    return {
      id: applicationId,
      status: "approved",
      ...result,
      reviewed_at: iso(ctx.now),
    };
  }
  const application = await applicationById(ctx, applicationId);
  if (application.status !== "pending")
    invalid(ctx, "지원서가 대기 중이 아닙니다", "not_pending");
  const reason = optionalText(ctx, a.rejection_reason, "거절 사유", {
    max: 1000,
  });
  await ctx.sql`
    UPDATE applications SET status = 'rejected', reviewed_at = ${ctx.now},
      reviewed_by = ${reviewer.member}, rejection_reason = ${reason},
      updated_at = ${ctx.now}
    WHERE id = ${applicationId}`;
  const settings = await settingsOf(ctx);
  await ctx.notify([application.member], {
    title: "가입 신청 결과",
    body: `${settings?.name ?? "커뮤"} 가입 신청이 거절되었습니다${reason ? `: ${reason}` : ""}`.slice(
      0,
      500,
    ),
    path: "/apply",
  });
  return { id: applicationId, status: "rejected", reviewed_at: iso(ctx.now) };
}

/**
 * Takes back a review (the owner only): the application is pending again,
 * and an approved one's membership ends and its profile is deactivated.
 */
export async function revoke(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const application = await applicationById(
    ctx,
    id(ctx, argsOf(args).application_id, "application_id"),
  );
  if (application.status === "pending")
    invalid(ctx, "대기 중인 지원서는 취소할 수 없습니다", "pending");
  if (application.status === "approved") {
    await ctx.sql`
      DELETE FROM members WHERE application_id = ${application.id} AND role <> 'owner'`;
    await ctx.sql`
      UPDATE profiles SET activated_at = NULL, updated_at = ${ctx.now}
      WHERE deleted_at IS NULL AND id IN (
        SELECT p.id FROM profiles p JOIN profile_owners o
          ON o.profile_id = p.id AND o.member = ${application.member}
        WHERE p.id = ${application.profile_id ?? ""}
           OR lower(p.username) = ${application.profile_username.toLowerCase()})`;
  }
  await ctx.sql`
    UPDATE applications SET status = 'pending', reviewed_at = NULL,
      reviewed_by = NULL, rejection_reason = NULL, updated_at = ${ctx.now}
    WHERE id = ${application.id}`;
  return { id: application.id, revoked: true, revoked_at: iso(ctx.now) };
}
