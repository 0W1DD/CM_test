// Blocking members (commung's console POST and DELETE /blocks/:user_id).
// A block is made from a profile the caller saw and blocks the member who
// owns it; member IDs never reach the page.
import { memberId } from "../modules/access.js";
import { argsOf, id, invalid, type MutationCtx } from "../modules/core.js";
import { ownerOf } from "../modules/ownership.js";

/** Blocks the member who owns `profile_id`. */
export async function create(ctx: MutationCtx, args: unknown) {
  const member = memberId(ctx);
  const profileId = id(ctx, argsOf(args).profile_id, "profile_id");
  const { rows } = await ctx.sql`
    SELECT 1 FROM profiles WHERE id = ${profileId} AND deleted_at IS NULL`;
  const blocked = rows.length ? await ownerOf(ctx, profileId) : null;
  if (!blocked)
    ctx.fail("NOT_FOUND", "사용자를 찾을 수 없습니다", { reason: "not_found" });
  if (blocked === member)
    invalid(ctx, "자기 자신은 차단할 수 없습니다", "cannot_block_self");
  const { changes } = await ctx.sql`
    INSERT INTO member_blocks (blocker, blocked, profile_id, created_at)
    VALUES (${member}, ${blocked}, ${profileId}, ${ctx.now})
    ON CONFLICT (blocker, blocked) DO NOTHING`;
  if (!changes)
    ctx.fail("CONFLICT", "이미 차단한 사용자입니다", {
      reason: "already_blocked",
    });
  return { blocked: true };
}

/** Unblocks the member a block named by `id` (its profile, from blocks:list) is for. */
async function deleteBlock(ctx: MutationCtx, args: unknown) {
  const member = memberId(ctx);
  const profileId = id(ctx, argsOf(args).id, "id");
  const { changes } = await ctx.sql`
    DELETE FROM member_blocks
    WHERE blocker = ${member} AND (profile_id = ${profileId}
      OR blocked = (SELECT member FROM profile_owners
                    WHERE profile_id = ${profileId} AND role = 'owner'))`;
  if (!changes)
    ctx.fail("NOT_FOUND", "차단하지 않은 사용자입니다", {
      reason: "not_blocked",
    });
  return { unblocked: true };
}
export { deleteBlock as delete };
