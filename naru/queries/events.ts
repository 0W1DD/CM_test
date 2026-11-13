// The daily check-in and the weekly gift exchange, as a member and as the
// staff see them (mutations/events.ts writes them).
import { actingProfile, requireStaff } from "../modules/access.js";
import { argsOf, type QueryCtx } from "../modules/core.js";
import {
  CHECK_IN_COINS,
  coinCurrency,
  EVENTS_START,
  type EntryRow,
  entriesJson,
  GIFT_COINS,
  isMorning,
  kstDay,
  weekBefore,
  weekOf,
  weekTimes,
} from "../modules/events.js";

const isoOf = (ms: number) => new Date(ms).toISOString();

function timesJson(week: string) {
  const t = weekTimes(week);
  return {
    week,
    signup_ends: isoOf(t.signupEnds),
    gifts_close: isoOf(t.giftsClose),
    opens: isoOf(t.opens),
  };
}

/**
 * The acting profile's day and week: whether it checked in today and may
 * now, this week's exchange (signed up, its gift: who it goes to is never
 * shown to the sender), and
 * last week's gifts to it once they have opened (Monday 08:00).
 */
export async function status(ctx: QueryCtx, args: unknown) {
  const profile = await actingProfile(ctx, argsOf(args).profile_id);
  const today = kstDay(ctx.now);
  const week = weekOf(ctx.now);
  const last = weekBefore(week);
  const times = weekTimes(week);
  const { rows: checks } = await ctx.sql<{ n: number }>`
    SELECT count(*) AS n FROM attendance
    WHERE profile_id = ${profile.id} AND day = ${today}`;
  const coin = await coinCurrency(ctx);
  const { rows: entries } = await ctx.sql<EntryRow>`
    SELECT * FROM gift_entries
    WHERE (week = ${week} AND profile_id = ${profile.id})
       OR (week = ${last} AND recipient_id = ${profile.id} AND submitted_at IS NOT NULL)`;
  const { rows: counts } = await ctx.sql<{ n: number }>`
    SELECT count(*) AS n FROM gift_entries WHERE week = ${week}`;
  const mine = entries.find(
    (e) => e.week === week && e.profile_id === profile.id,
  );
  const lastOpen = ctx.now >= weekTimes(last).opens;
  const received = entries.filter((e) => e.week === last);
  const [mineJson] = mine ? await entriesJson(ctx, [mine]) : [];
  const receivedJson = lastOpen ? await entriesJson(ctx, received) : [];
  return {
    started: ctx.now >= EVENTS_START,
    starts_at: isoOf(EVENTS_START),
    check_in: {
      day: today,
      checked_in: (checks[0]?.n ?? 0) > 0,
      open: isMorning(ctx.now),
      coins: CHECK_IN_COINS,
    },
    currency: coin?.name ?? null,
    gift_coins: GIFT_COINS,
    gift: {
      ...timesJson(week),
      phase:
        ctx.now < times.signupEnds
          ? "signup"
          : ctx.now < times.giftsClose
            ? "writing"
            : "closed",
      participants: counts[0]?.n ?? 0,
      signed_up: !!mine,
      content: mineJson?.content ?? null,
      images: mineJson?.images ?? [],
      submitted_at: mineJson?.submitted_at ?? null,
    },
    received: {
      ...timesJson(last),
      open: lastOpen,
      count: received.length,
      gifts: receivedJson.map((g) => ({
        giver: g.giver,
        content: g.content,
        images: g.images,
      })),
    },
  };
}

/**
 * A week of the exchange as the staff see it (this week when `week` is
 * absent): every participant, who they give to and whether it was pinned,
 * and their gift. With the weeks there have been, newest first.
 */
export async function admin(ctx: QueryCtx, args: unknown) {
  await requireStaff(ctx);
  const a = argsOf(args);
  const current = weekOf(ctx.now);
  const week =
    typeof a.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.week)
      ? a.week
      : current;
  const { rows } = await ctx.sql<EntryRow>`
    SELECT * FROM gift_entries WHERE week = ${week} ORDER BY created_at`;
  const { rows: weeks } = await ctx.sql<{ week: string }>`
    SELECT DISTINCT week FROM gift_entries ORDER BY week DESC LIMIT 20`;
  const { rows: state } = await ctx.sql<{
    assigned_at: number | null;
    paid_at: number | null;
  }>`SELECT assigned_at, paid_at FROM gift_weeks WHERE week = ${week}`;
  return {
    ...timesJson(week),
    weeks: [...new Set([current, ...weeks.map((w) => w.week)])],
    assigned_at:
      state[0]?.assigned_at == null ? null : isoOf(state[0].assigned_at),
    paid_at: state[0]?.paid_at == null ? null : isoOf(state[0].paid_at),
    entries: await entriesJson(ctx, rows),
  };
}
