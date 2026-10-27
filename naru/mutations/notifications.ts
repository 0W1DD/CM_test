// Marking a profile's notifications: commung's POST /app/notifications/
// :id/read, :id/unread and mark-all-read, and deleting one.
import {
  argsOf,
  id,
  iso,
  type MutationCtx,
  notFound,
} from "../modules/core.js";
import { recipientProfile } from "../modules/post-notifications.js";

async function target(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profileId = await recipientProfile(ctx, a.profile_id);
  return {
    profileId,
    notificationId: id(ctx, a.notification_id, "notification_id"),
  };
}

export async function markRead(ctx: MutationCtx, args: unknown) {
  const { profileId, notificationId } = await target(ctx, args);
  const { changes } = await ctx.sql`
    UPDATE notifications SET read_at = ${ctx.now}
    WHERE id = ${notificationId} AND recipient_id = ${profileId}`;
  if (!changes) notFound(ctx, "알림을 찾을 수 없습니다");
  return { id: notificationId, is_read: true, read_at: iso(ctx.now) };
}

export async function markUnread(ctx: MutationCtx, args: unknown) {
  const { profileId, notificationId } = await target(ctx, args);
  const { changes } = await ctx.sql`
    UPDATE notifications SET read_at = NULL
    WHERE id = ${notificationId} AND recipient_id = ${profileId}`;
  if (!changes) notFound(ctx, "알림을 찾을 수 없습니다");
  return { id: notificationId, is_read: false };
}

export async function markAllRead(ctx: MutationCtx, args: unknown) {
  const profileId = await recipientProfile(ctx, argsOf(args).profile_id);
  await ctx.sql`
    UPDATE notifications SET read_at = ${ctx.now}
    WHERE recipient_id = ${profileId} AND read_at IS NULL`;
  return { profile_id: profileId, all_read: true, read_at: iso(ctx.now) };
}

/** Deletes one of the profile's notifications (not in commung's app API). */
export async function remove(ctx: MutationCtx, args: unknown) {
  const { profileId, notificationId } = await target(ctx, args);
  const { changes } = await ctx.sql`
    DELETE FROM notifications
    WHERE id = ${notificationId} AND recipient_id = ${profileId}`;
  if (!changes) notFound(ctx, "알림을 찾을 수 없습니다");
  return { id: notificationId, deleted: true };
}
