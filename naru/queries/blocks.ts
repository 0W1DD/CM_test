// The members the caller blocked (commung's console GET /blocks).
import { memberId } from "../modules/access.js";
import { iso, type QueryCtx } from "../modules/core.js";

/**
 * Each block, newest first, named by the profile it was made from: `id` is
 * that profile's ID (what blocks:delete takes), `login_name` its username.
 */
export async function list(ctx: QueryCtx) {
  const member = memberId(ctx);
  const { rows } = await ctx.sql<{
    profile_id: string | null;
    username: string | null;
    name: string | null;
    profile_picture_url: string | null;
    created_at: number;
  }>`
    SELECT b.profile_id, p.username, p.name, pic.url AS profile_picture_url,
      b.created_at
    FROM member_blocks b
    LEFT JOIN profiles p ON p.id = b.profile_id
    LEFT JOIN images pic ON pic.id = p.picture_id
    WHERE b.blocker = ${member}
    ORDER BY b.created_at DESC LIMIT 1000`;
  return rows
    .filter((row) => row.profile_id !== null)
    .map((row) => ({
      id: row.profile_id,
      login_name: row.username ?? "",
      name: row.name ?? "",
      profile_picture_url: row.profile_picture_url,
      blocked_at: iso(row.created_at),
    }));
}
