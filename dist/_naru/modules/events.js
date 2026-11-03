import { imageJson, imagesById } from "./images.js";
import { authorsById } from "./post-data.js";
import { randomInt } from "./random.js";
import { grantMany } from "./shop.js";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const KST = 9 * HOUR;
/** Coins for a morning check-in, and for each gift sent in a week. */
export const CHECK_IN_COINS = 1;
export const GIFT_COINS = 5;
/** A moment's Korean date, "YYYY-MM-DD". */
export const kstDay = (ms) => new Date(ms + KST).toISOString().slice(0, 10);
/** Whether it is before noon in Korea: the check-in's hours. */
export const isMorning = (ms) => new Date(ms + KST).getUTCHours() < 12;
/** The Monday (Korean date) of the week `ms` falls in. */
export function weekOf(ms) {
    const local = ms + KST;
    const daysSinceMonday = (new Date(local).getUTCDay() + 6) % 7;
    return new Date(Math.floor(local / DAY) * DAY - daysSinceMonday * DAY)
        .toISOString()
        .slice(0, 10);
}
/** The week before `week`. */
export const weekBefore = (week) => new Date(Date.parse(`${week}T00:00:00Z`) - 7 * DAY)
    .toISOString()
    .slice(0, 10);
/** A week's moments: sign-up closes, gifts close, gifts open. */
export function weekTimes(week) {
    const start = Date.parse(`${week}T00:00:00Z`) - KST;
    return {
        start,
        signupEnds: start + 6 * DAY,
        giftsClose: start + 6 * DAY + 23.5 * HOUR,
        opens: start + 7 * DAY + 8 * HOUR,
    };
}
/** The community's coin: its default currency, or its first. */
export async function coinCurrency(ctx) {
    const { rows } = await ctx.sql `
    SELECT id, name FROM shop_currencies WHERE deleted_at IS NULL
    ORDER BY is_default DESC, created_at LIMIT 1`;
    return rows[0] ?? null;
}
/**
 * Who gives to whom, for the entries not pinned by the staff: every
 * participant gives once and is given once, never to themselves. Answers
 * [giver, recipient] pairs; a giver left with only themselves gets none.
 */
export function draw(entries) {
    const pinned = entries.filter((e) => e.pinned === 1 && e.recipient_id);
    const taken = new Set(pinned.map((e) => e.recipient_id));
    const givers = entries
        .filter((e) => !(e.pinned === 1 && e.recipient_id))
        .map((e) => e.profile_id);
    const open = entries.map((e) => e.profile_id).filter((id) => !taken.has(id));
    const shuffled = [...open];
    for (let attempt = 0; attempt < 50; attempt++) {
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = randomInt(i + 1);
            [shuffled[i], shuffled[j]] = [
                shuffled[j],
                shuffled[i],
            ];
        }
        if (givers.every((giver, i) => shuffled[i] !== giver))
            break;
    }
    // Still someone giving to themselves (only possible when nothing else
    // fits): swap with a neighbour where that helps, else leave them out.
    const pairs = givers.map((giver, i) => [
        giver,
        shuffled[i] ?? null,
    ]);
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if (pair[1] !== pair[0])
            continue;
        const other = pairs.find((p) => p !== pair && p[1] !== pair[0] && p[0] !== pair[1]);
        if (other)
            [pair[1], other[1]] = [other[1], pair[1]];
        else
            pair[1] = null;
    }
    return pairs;
}
/** Draws a week's unpinned recipients again (a few statements). */
export async function drawWeek(ctx, week) {
    const { rows } = await ctx.sql `
    SELECT * FROM gift_entries WHERE week = ${week}`;
    const pairs = draw(rows);
    if (pairs.length)
        await ctx.sql `
      UPDATE gift_entries SET updated_at = ${ctx.now}, recipient_id = (
        SELECT json_extract(value, '$[1]') FROM json_each(${JSON.stringify(pairs)})
        WHERE json_extract(value, '$[0]') = gift_entries.profile_id)
      WHERE week = ${week} AND NOT (pinned = 1 AND recipient_id IS NOT NULL)`;
    await ctx.sql `
    INSERT INTO gift_weeks (week, assigned_at) VALUES (${week}, ${ctx.now})
    ON CONFLICT (week) DO UPDATE SET assigned_at = excluded.assigned_at`;
}
/** Pays every sender of a gift that reached someone, once a week. */
async function payWeek(ctx, week) {
    const { rows } = await ctx.sql `
    SELECT profile_id FROM gift_entries
    WHERE week = ${week} AND submitted_at IS NOT NULL AND recipient_id IS NOT NULL`;
    const coin = rows.length ? await coinCurrency(ctx) : null;
    if (coin)
        await grantMany(ctx, {
            profileIds: rows.map((row) => row.profile_id),
            grant: { kind: "currency", currencyId: coin.id, amount: GIFT_COINS },
            actor: "system",
            reason: "선물 교환식 참여",
        });
    await ctx.sql `
    INSERT INTO gift_weeks (week, paid_at) VALUES (${week}, ${ctx.now})
    ON CONFLICT (week) DO UPDATE SET paid_at = excluded.paid_at`;
}
/**
 * What is due for this week and the last: the draw once sign-up has
 * closed, the pay once the gifts have opened.
 */
export async function settleGifts(ctx) {
    const week = weekOf(ctx.now);
    for (const w of [weekBefore(week), week]) {
        const times = weekTimes(w);
        if (ctx.now < times.signupEnds)
            continue;
        const { rows } = await ctx.sql `
      SELECT
        (SELECT assigned_at FROM gift_weeks WHERE week = ${w}) AS assigned_at,
        (SELECT paid_at FROM gift_weeks WHERE week = ${w}) AS paid_at,
        (SELECT count(*) FROM gift_entries WHERE week = ${w}) AS entries`;
        const state = rows[0];
        if (!state?.entries)
            continue;
        if (state.assigned_at === null)
            await drawWeek(ctx, w);
        if (ctx.now >= times.opens && state.paid_at === null)
            await payWeek(ctx, w);
    }
}
/**
 * Entries as answers: the giver and recipient, the gift and its images.
 * `withGift` decides, per entry, whether its gift is shown.
 */
export async function entriesJson(ctx, rows, withGift = () => true) {
    const shown = rows.filter(withGift);
    const { rows: pictures } = shown.length
        ? await ctx.sql `
        SELECT week, profile_id, image_id FROM gift_images
        WHERE week || '/' || profile_id IN (SELECT value FROM json_each(${JSON.stringify(shown.map((row) => `${row.week}/${row.profile_id}`))}))
        ORDER BY position`
        : { rows: [] };
    const images = await imagesById(ctx, pictures.map((p) => p.image_id));
    const profiles = await authorsById(ctx, [
        ...rows.map((row) => row.profile_id),
        ...rows.flatMap((row) => row.recipient_id ?? []),
    ]);
    return rows.map((row) => {
        const gift = withGift(row);
        return {
            week: row.week,
            giver: profiles.get(row.profile_id) ?? null,
            recipient: row.recipient_id
                ? (profiles.get(row.recipient_id) ?? null)
                : null,
            pinned: row.pinned === 1,
            submitted: row.submitted_at !== null,
            submitted_at: row.submitted_at === null
                ? null
                : new Date(row.submitted_at).toISOString(),
            content: gift ? row.content : null,
            images: gift
                ? pictures
                    .filter((p) => p.week === row.week && p.profile_id === row.profile_id)
                    .flatMap((p) => {
                    const image = images.get(p.image_id);
                    return image ? [imageJson(image)] : [];
                })
                : [],
        };
    });
}
