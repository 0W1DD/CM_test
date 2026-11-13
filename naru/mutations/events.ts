// The daily check-in and the weekly gift exchange (modules/events.ts). Each
// call first settles what is due: a week's draw once sign-up has closed, its
// pay once the gifts have opened.
import { actingProfile, requireStaff } from "../modules/access.js";
import {
  argsOf,
  id,
  ids,
  invalid,
  list,
  type MutationCtx,
  notFound,
  optionalText,
} from "../modules/core.js";
import {
  CHECK_IN_COINS,
  coinCurrency,
  EVENTS_NOT_STARTED,
  EVENTS_START,
  isMorning,
  kstDay,
  settleGifts,
  weekOf,
  weekTimes,
} from "../modules/events.js";
import { ownImages } from "../modules/images.js";
import { failShop, grantCurrency } from "../modules/shop.js";

/** A profile the calling member acts as, active in the community. */
async function activeProfile(ctx: MutationCtx, profileId: unknown) {
  const profile = await actingProfile(ctx, profileId);
  if (profile.activated_at === null)
    notFound(ctx, "프로필을 찾을 수 없습니다.");
  return profile;
}

/** Refuses taking part before the events open (EVENTS_START). */
function requireStarted(ctx: MutationCtx) {
  if (ctx.now < EVENTS_START)
    invalid(ctx, EVENTS_NOT_STARTED, "not_started");
}

/** Runs what is due (pages call it as they open). */
export async function settle(ctx: MutationCtx) {
  await settleGifts(ctx);
  return null;
}

/**
 * Checks the acting profile in for today, before noon, once a day: a coin
 * of the community's currency.
 */
export async function checkIn(ctx: MutationCtx, args: unknown) {
  const profile = await activeProfile(ctx, argsOf(args).profile_id);
  await settleGifts(ctx);
  if (!isMorning(ctx.now))
    invalid(
      ctx,
      "출석체크는 오전(0시~12시)에만 할 수 있습니다.",
      "not_morning",
    );
  const coin = await coinCurrency(ctx);
  if (!coin)
    invalid(
      ctx,
      "커뮤에 화폐가 없어 출석체크를 할 수 없습니다.",
      "no_currency",
    );
  const day = kstDay(ctx.now);
  const { changes } = await ctx.sql`
    INSERT INTO attendance (profile_id, day, created_at)
    VALUES (${profile.id}, ${day}, ${ctx.now}) ON CONFLICT DO NOTHING`;
  if (!changes) invalid(ctx, "오늘은 이미 출석했습니다.", "already_checked_in");
  await failShop(ctx, () =>
    grantCurrency(ctx, {
      profileId: profile.id,
      currencyId: coin.id,
      amount: CHECK_IN_COINS,
      source: "owner_grant",
      actor: profile.membership.member,
      reason: "출석체크",
    }),
  );
  return { day, coins: CHECK_IN_COINS, currency: coin.name };
}

/** Signs the acting profile up for this week's exchange (Monday to Saturday). */
export async function giftSignup(ctx: MutationCtx, args: unknown) {
  const profile = await activeProfile(ctx, argsOf(args).profile_id);
  await settleGifts(ctx);
  requireStarted(ctx);
  const week = weekOf(ctx.now);
  if (ctx.now >= weekTimes(week).signupEnds)
    invalid(ctx, "이번 주 신청은 마감되었습니다.", "signup_closed");
  await ctx.sql`
    INSERT INTO gift_entries (week, profile_id, created_at, updated_at)
    VALUES (${week}, ${profile.id}, ${ctx.now}, ${ctx.now})
    ON CONFLICT DO NOTHING`;
  return { week };
}

/** Takes the acting profile out of this week's exchange, while sign-up is open. */
export async function giftCancel(ctx: MutationCtx, args: unknown) {
  const profile = await activeProfile(ctx, argsOf(args).profile_id);
  await settleGifts(ctx);
  const week = weekOf(ctx.now);
  if (ctx.now >= weekTimes(week).signupEnds)
    invalid(ctx, "신청이 마감되어 취소할 수 없습니다.", "signup_closed");
  // Whoever was pinned to give to them goes back to the draw.
  await ctx.sql`
    UPDATE gift_entries SET recipient_id = NULL, pinned = 0, updated_at = ${ctx.now}
    WHERE week = ${week} AND recipient_id = ${profile.id}`;
  await ctx.sql`
    DELETE FROM gift_images WHERE week = ${week} AND profile_id = ${profile.id}`;
  await ctx.sql`
    DELETE FROM gift_entries WHERE week = ${week} AND profile_id = ${profile.id}`;
  return { week };
}

/**
 * Writes the acting profile's gift for this week (until Sunday 23:30):
 * `content` (text and links) and `image_ids` (pictures and GIFs it
 * uploaded), at least one of the two. Saving again replaces it.
 */
export async function giftSave(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await activeProfile(ctx, a.profile_id);
  await settleGifts(ctx);
  requireStarted(ctx);
  const week = weekOf(ctx.now);
  if (ctx.now >= weekTimes(week).giftsClose)
    invalid(ctx, "선물 입력 시간이 지났습니다.", "gifts_closed");
  const content = optionalText(ctx, a.content, "선물 내용", { max: 5000 });
  const imageIds = ids(ctx, a.image_ids, "image_ids", 4);
  if (!content && !imageIds.length)
    invalid(ctx, "선물 내용이나 이미지를 넣어 주세요.", "empty_gift");
  await ownImages(ctx, imageIds);
  const { changes } = await ctx.sql`
    UPDATE gift_entries SET content = ${content}, submitted_at = ${ctx.now},
      updated_at = ${ctx.now}
    WHERE week = ${week} AND profile_id = ${profile.id}`;
  if (!changes)
    invalid(ctx, "먼저 선물 교환식에 신청해 주세요.", "not_signed_up");
  await ctx.sql`
    DELETE FROM gift_images WHERE week = ${week} AND profile_id = ${profile.id}`;
  if (imageIds.length)
    await ctx.sql`
      INSERT INTO gift_images (week, profile_id, image_id, position)
      SELECT ${week}, ${profile.id}, value, key FROM json_each(${list(imageIds)})`;
  return { week };
}

/**
 * Pins who a participant gives to (the staff, until sign-up closes), or
 * unpins it when `recipient_id` is null. The draw at sign-up's close keeps
 * the pinned pairs and draws everyone else; nobody sees a pair until then.
 */
export async function giftPin(ctx: MutationCtx, args: unknown) {
  await requireStaff(ctx);
  const a = argsOf(args);
  const week = typeof a.week === "string" ? a.week : weekOf(ctx.now);
  if (ctx.now >= weekTimes(week).signupEnds)
    invalid(
      ctx,
      "신청이 마감되어 받는 사람을 지정할 수 없습니다.",
      "pin_closed",
    );
  const giver = id(ctx, a.profile_id, "profile_id");
  const recipient =
    a.recipient_id === null || a.recipient_id === undefined
      ? null
      : id(ctx, a.recipient_id, "recipient_id");
  if (recipient === giver)
    invalid(ctx, "자기 자신에게는 보낼 수 없습니다.", "self_gift");
  const { rows } = await ctx.sql<{ profile_id: string; pinned: number }>`
    SELECT profile_id, pinned FROM gift_entries
    WHERE week = ${week} AND profile_id IN (SELECT value FROM json_each(${list(
      recipient ? [giver, recipient] : [giver],
    )}))`;
  if (!rows.some((row) => row.profile_id === giver))
    notFound(ctx, "신청하지 않은 프로필입니다.");
  if (recipient && !rows.some((row) => row.profile_id === recipient))
    invalid(
      ctx,
      "받는 사람도 이번 주 신청자여야 합니다.",
      "recipient_not_signed_up",
    );
  if (recipient) {
    const { rows: holders } = await ctx.sql<{ profile_id: string }>`
      SELECT profile_id FROM gift_entries
      WHERE week = ${week} AND recipient_id = ${recipient} AND pinned = 1
        AND profile_id != ${giver}`;
    if (holders.length)
      invalid(
        ctx,
        "이미 다른 사람이 지정된 받는 사람입니다.",
        "recipient_taken",
      );
    await ctx.sql`
      UPDATE gift_entries SET recipient_id = NULL, updated_at = ${ctx.now}
      WHERE week = ${week} AND recipient_id = ${recipient} AND profile_id != ${giver}`;
  }
  await ctx.sql`
    UPDATE gift_entries SET recipient_id = ${recipient}, pinned = ${recipient ? 1 : 0},
      updated_at = ${ctx.now}
    WHERE week = ${week} AND profile_id = ${giver}`;
  return { week };
}
