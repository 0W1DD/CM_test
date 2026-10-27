// Applications to join: the applicant's own, and the owner's and
// moderators' review list (commung's console my-applications and
// applications routes).
import {
  isStaff,
  memberId,
  membershipOf,
  requireStaff,
} from "../modules/access.js";
import {
  APPLICATION_SELECT,
  type ApplicationRow,
  applicationById,
  attachmentsJson,
  reviewJson,
} from "../modules/applications.js";
import { argsOf, denied, id, iso, type QueryCtx } from "../modules/core.js";

/** The signed-in member's applications, newest first (my-applications). */
export async function mine(ctx: QueryCtx) {
  const member = memberId(ctx);
  const { rows } = await ctx.sql<ApplicationRow>(
    `${APPLICATION_SELECT} WHERE a.member = ? ORDER BY a.created_at DESC LIMIT 100`,
    [member],
  );
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    profile_name: row.profile_name,
    profile_username: row.profile_username,
    message: row.message,
    rejection_reason: row.rejection_reason,
    created_at: iso(row.created_at),
    attachments: attachmentsJson(row),
  }));
}

/** Every application, newest first, for the owner and moderators. */
export async function list(ctx: QueryCtx) {
  await requireStaff(ctx);
  const { rows } = await ctx.sql<ApplicationRow>(
    `${APPLICATION_SELECT} ORDER BY a.created_at DESC LIMIT 1000`,
  );
  return reviewJson(ctx, rows);
}

/** One application, for its applicant or the owner and moderators. */
export async function get(ctx: QueryCtx, args: unknown) {
  const member = memberId(ctx);
  const application = await applicationById(
    ctx,
    id(ctx, argsOf(args).application_id, "application_id"),
  );
  const own = application.member === member;
  if (!own && !isStaff(await membershipOf(ctx)))
    denied(
      ctx,
      "모더레이터 또는 소유자만 접근할 수 있습니다.",
      "not_moderator",
    );
  const [json] = await reviewJson(ctx, [application]);
  return { ...json, is_own: own };
}
