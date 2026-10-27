// The owner's and moderators' analytics (commung's getCommunityStats and
// getCommunityActivityStats): applications and members, and posts, direct
// messages and group chat messages over time.
import { requireStaff } from "../modules/access.js";
import { settingsOf, slugOf } from "../modules/community.js";
import { argsOf, iso, type QueryCtx } from "../modules/core.js";

/** Applications by status and the member count (commung's /stats). */
export async function stats(ctx: QueryCtx) {
  await requireStaff(ctx);
  const settings = await settingsOf(ctx);
  const { rows } = await ctx.sql<{
    pending: number;
    approved: number;
    rejected: number;
    members: number;
  }>`
    SELECT
      (SELECT count(*) FROM applications WHERE status = 'pending') AS pending,
      (SELECT count(*) FROM applications WHERE status = 'approved') AS approved,
      (SELECT count(*) FROM applications WHERE status = 'rejected') AS rejected,
      (SELECT count(*) FROM members) AS members`;
  const counts = rows[0];
  let bannerWidth: number | null = null;
  let bannerHeight: number | null = null;
  if (settings?.banner_image_id) {
    const { rows: images } = await ctx.sql<{ width: number; height: number }>`
      SELECT width, height FROM images WHERE id = ${settings.banner_image_id}`;
    bannerWidth = images[0]?.width ?? null;
    bannerHeight = images[0]?.height ?? null;
  }
  return {
    community: {
      id: slugOf(ctx),
      name: settings?.name ?? slugOf(ctx),
      slug: slugOf(ctx),
      banner_image_url: settings?.banner_image_url ?? null,
      banner_image_width: bannerWidth,
      banner_image_height: bannerHeight,
      hashtags: [],
    },
    applications: {
      pending: counts.pending,
      approved: counts.approved,
      rejected: counts.rejected,
      total: counts.pending + counts.approved + counts.rejected,
    },
    members: { total: counts.members },
  };
}

// Days and hours of day are Korea's (UTC+9, no daylight saving time).
const KST = 9 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

interface Activity {
  daily: string;
  hourly: string;
  heatmap: string;
  total: number;
  by_profile: string;
}

/**
 * One table's activity since `since`, in one statement over its rows once:
 * counts by day, by hour (the hour's start in ms), by weekday and hour, in
 * all, and by profile. `from` selects `created_at` and `profile_id` of the
 * live rows.
 */
async function activityOf(ctx: QueryCtx, from: string, since: number) {
  const { rows } = await ctx.sql<Activity>(
    `WITH w AS MATERIALIZED (${from})
     SELECT
       (SELECT json_group_array(json_array(d, n)) FROM (
         SELECT strftime('%Y-%m-%d', (created_at + ${KST}) / 1000, 'unixepoch') AS d,
           count(*) AS n FROM w GROUP BY d ORDER BY d)) AS daily,
       (SELECT json_group_array(json_array(h, n)) FROM (
         SELECT (created_at / ${HOUR}) * ${HOUR} AS h, count(*) AS n
         FROM w GROUP BY h ORDER BY h)) AS hourly,
       (SELECT json_group_array(json_array(hr, dow, n)) FROM (
         SELECT CAST(strftime('%H', (created_at + ${KST}) / 1000, 'unixepoch') AS INTEGER) AS hr,
           CAST(strftime('%w', (created_at + ${KST}) / 1000, 'unixepoch') AS INTEGER) AS dow,
           count(*) AS n FROM w GROUP BY hr, dow)) AS heatmap,
       (SELECT count(*) FROM w) AS total,
       (SELECT json_group_array(json_array(profile_id, n)) FROM (
         SELECT profile_id, count(*) AS n FROM w
         WHERE profile_id IS NOT NULL GROUP BY profile_id)) AS by_profile`,
    [since],
  );
  const row = rows[0];
  return {
    daily: (JSON.parse(row.daily) as [string, number][]).map(
      ([date, count]) => ({
        date,
        count,
      }),
    ),
    hourly: (JSON.parse(row.hourly) as [number, number][]).map(
      ([h, count]) => ({
        datetime: iso(h),
        count,
      }),
    ),
    heatmap: (JSON.parse(row.heatmap) as [number, number, number][]).map(
      ([hour, dayOfWeek, count]) => ({ hour, dayOfWeek, count }),
    ),
    total: row.total,
    byProfile: new Map(JSON.parse(row.by_profile) as [string, number][]),
  };
}

/**
 * Posts, direct messages and group chat messages over the last `days`
 * (1–365, 30) days, as commung's analytics page draws them, with the ten
 * most and least active profiles.
 */
export async function activity(ctx: QueryCtx, args: unknown) {
  await requireStaff(ctx);
  const n = Number(argsOf(args).days ?? 30);
  const days = Number.isFinite(n)
    ? Math.min(365, Math.max(1, Math.floor(n)))
    : 30;
  const since = ctx.now - days * DAY;
  const posts = await activityOf(
    ctx,
    "SELECT created_at, author_id AS profile_id FROM posts WHERE deleted_at IS NULL AND created_at >= ?",
    since,
  );
  const dms = await activityOf(
    ctx,
    "SELECT created_at, sender_id AS profile_id FROM direct_messages WHERE deleted_at IS NULL AND created_at >= ?",
    since,
  );
  const groups = await activityOf(
    ctx,
    `SELECT m.created_at, m.sender_id AS profile_id FROM group_chat_messages m
     JOIN group_chats c ON c.id = m.group_chat_id AND c.deleted_at IS NULL
     WHERE m.deleted_at IS NULL AND m.created_at >= ?`,
    since,
  );

  const totals = new Map<
    string,
    { posts: number; dms: number; groupMessages: number }
  >();
  const add = (
    map: Map<string, number>,
    key: "posts" | "dms" | "groupMessages",
  ) => {
    for (const [profileId, count] of map) {
      const entry = totals.get(profileId) ?? {
        posts: 0,
        dms: 0,
        groupMessages: 0,
      };
      entry[key] = count;
      totals.set(profileId, entry);
    }
  };
  add(posts.byProfile, "posts");
  add(dms.byProfile, "dms");
  add(groups.byProfile, "groupMessages");
  const ranked = [...totals.entries()]
    .map(([profileId, a]) => ({
      profileId,
      ...a,
      total: a.posts + a.dms + a.groupMessages,
    }))
    .sort((x, y) => y.total - x.total);
  const most = ranked.slice(0, 10);
  const least = ranked
    .filter((p) => p.total > 0)
    .slice(-10)
    .reverse();

  const wanted = [...new Set([...most, ...least].map((p) => p.profileId))];
  const { rows: profiles } = wanted.length
    ? await ctx.sql<{
        id: string;
        name: string;
        username: string;
        avatar_url: string | null;
      }>`
        SELECT p.id, p.name, p.username, pic.url AS avatar_url FROM profiles p
        LEFT JOIN images pic ON pic.id = p.picture_id
        WHERE p.id IN (SELECT value FROM json_each(${JSON.stringify(wanted)}))
          AND p.deleted_at IS NULL`
    : { rows: [] };
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const withProfiles = (list: typeof ranked) =>
    list.flatMap((a) => {
      const p = byId.get(a.profileId);
      if (!p) return [];
      return [
        {
          profile_id: p.id,
          profile_name: p.name,
          profile_username: p.username,
          avatar_url: p.avatar_url,
          posts_count: a.posts,
          dms_count: a.dms,
          group_messages_count: a.groupMessages,
          total_activity: a.total,
        },
      ];
    });

  return {
    timeline: {
      posts: posts.daily,
      directMessages: dms.daily,
      groupMessages: groups.daily,
    },
    hourlyTimeline: {
      posts: posts.hourly,
      directMessages: dms.hourly,
      groupMessages: groups.hourly,
    },
    heatmap: {
      posts: posts.heatmap,
      directMessages: dms.heatmap,
      groupMessages: groups.heatmap,
    },
    totals: {
      posts: posts.total,
      directMessages: dms.total,
      groupMessages: groups.total,
    },
    mostActiveProfiles: withProfiles(most),
    leastActiveProfiles: withProfiles(least),
  };
}
