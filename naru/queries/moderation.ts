// The moderation log, newest first, for the owner and moderators.
import { requireStaff } from "../modules/access.js";
import {
  argsOf,
  iso,
  limitOf,
  offsetOf,
  type QueryCtx,
} from "../modules/core.js";
import { profilesById } from "../modules/profiles.js";

interface LogRow {
  id: string;
  action: string;
  description: string;
  moderator: string;
  target_profile_id: string | null;
  target_post_id: string | null;
  created_at: number;
}

/** Log entries, `limit` (50) from `offset`, with the profiles they name. */
export async function log(ctx: QueryCtx, args: unknown) {
  await requireStaff(ctx);
  const a = argsOf(args);
  const { rows } = await ctx.sql<LogRow>`
    SELECT id, action, description, moderator, target_profile_id,
      target_post_id, created_at
    FROM moderation_log ORDER BY created_at DESC, rowid DESC
    LIMIT ${limitOf(a.limit, 50, 100)} OFFSET ${offsetOf(a.offset)}`;
  const profiles = await profilesById(
    ctx,
    rows.flatMap((row) => [row.moderator, row.target_profile_id]),
  );
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    description: row.description,
    moderator: profiles.get(row.moderator) ?? null,
    target_profile: row.target_profile_id
      ? (profiles.get(row.target_profile_id) ?? null)
      : null,
    target_post_id: row.target_post_id,
    created_at: iso(row.created_at),
  }));
}

interface ReportRow {
  id: string;
  post_id: string;
  reason: string;
  reporter_profile_id: string;
  created_at: number;
  author_id: string | null;
  content: string | null;
  post_deleted_at: number | null;
}

/**
 * Post reports, newest first, `limit` (50) from `offset`: the reason, who
 * reported, and the post with its author (for its address,
 * `/@<author username>/<post id>`).
 */
export async function reports(ctx: QueryCtx, args: unknown) {
  await requireStaff(ctx);
  const a = argsOf(args);
  const { rows } = await ctx.sql<ReportRow>`
    SELECT r.id, r.post_id, r.reason, r.reporter_profile_id, r.created_at,
      p.author_id, substr(p.content, 1, 200) AS content,
      p.deleted_at AS post_deleted_at
    FROM post_reports r LEFT JOIN posts p ON p.id = r.post_id
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ${limitOf(a.limit, 50, 100)} OFFSET ${offsetOf(a.offset)}`;
  const profiles = await profilesById(
    ctx,
    rows.flatMap((row) => [row.reporter_profile_id, row.author_id]),
  );
  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    created_at: iso(row.created_at),
    reporter: profiles.get(row.reporter_profile_id) ?? null,
    post: {
      id: row.post_id,
      content: row.content,
      deleted: row.post_deleted_at !== null,
      author: row.author_id ? (profiles.get(row.author_id) ?? null) : null,
    },
  }));
}
