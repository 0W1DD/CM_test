import { coinCurrency } from "./events.js";
import { grantCurrency } from "./shop.js";
export const ACHIEVEMENTS = [
    {
        key: "reactions",
        name: "좋아요 부탁드립니다",
        condition: "글에 반응 남기기",
        unit: "번",
        goals: [100, 500, 2000],
    },
    {
        key: "coins_earned",
        name: "난 부자가 될거야",
        condition: "코인 모으기 (써도 줄지 않아요)",
        unit: "개",
        goals: [50, 200, 500],
    },
    {
        key: "coins_spent",
        name: "큰 손",
        condition: "상점에서 코인 쓰기",
        unit: "개",
        goals: [30, 150, 400],
    },
    {
        key: "streak",
        name: "개근상",
        condition: "하루도 빠짐없이 출석하기",
        unit: "일",
        goals: [7, 14, 30],
    },
    {
        key: "check_ins",
        name: "이렇게나 오래됐어",
        condition: "출석체크 한 날",
        unit: "일",
        goals: [30, 90, 180],
    },
    {
        key: "gifts",
        name: "시켜줘 너의 명예 산타",
        condition: "선물 교환식에 선물 내기",
        unit: "회",
        goals: [1, 5, 10],
    },
    {
        key: "boxes",
        name: "착한 아이에게는 선물을...",
        condition: "랜덤박스 열기",
        unit: "개",
        goals: [10, 50, 150],
    },
    {
        key: "cookies",
        name: "쿠키 먹기",
        condition: "쿠키·과자 상품 사기",
        unit: "번",
        goals: [3, 10, 30],
    },
];
export const TIER_COINS = [2, 5, 10];
export const TIER_NAMES = ["Ⅰ", "Ⅱ", "Ⅲ"];
/** Coins the achievements give start their reason with this, and are not
 * counted toward "난 부자가 될거야". */
export const REWARD_REASON = "업적 보상";
const DAY = 86_400_000;
/** The longest run of days in a row among `days` (Korean dates, sorted). */
export function longestRun(days) {
    let best = 0;
    let run = 0;
    let last = Number.NaN;
    for (const day of days) {
        const t = Date.parse(`${day}T00:00:00Z`);
        run = t - last === DAY ? run + 1 : 1;
        last = t;
        if (run > best)
            best = run;
    }
    return best;
}
/** How far a profile has come in each achievement, by key. */
export async function progressOf(ctx, profileId) {
    const coin = await coinCurrency(ctx);
    const coinId = coin?.id ?? "";
    const { rows } = await ctx.sql `
    SELECT
      (SELECT count(*) FROM post_reactions WHERE profile_id = ${profileId}) AS reactions,
      (SELECT coalesce(sum(currency_delta), 0) FROM shop_transactions
       WHERE profile_id = ${profileId} AND currency_id = ${coinId}
         AND kind = 'currency_grant' AND currency_delta > 0
         AND (reason IS NULL OR reason NOT LIKE ${`${REWARD_REASON}%`})) AS coins_earned,
      (SELECT coalesce(-sum(currency_delta), 0) FROM shop_transactions
       WHERE profile_id = ${profileId} AND currency_id = ${coinId}
         AND kind = 'item_purchase') AS coins_spent,
      (SELECT count(*) FROM attendance WHERE profile_id = ${profileId}) AS check_ins,
      (SELECT count(*) FROM gift_entries
       WHERE profile_id = ${profileId} AND submitted_at IS NOT NULL) AS gifts,
      (SELECT count(*) FROM shop_transactions
       WHERE profile_id = ${profileId} AND kind = 'item_consume'
         AND reason = '랜덤박스 열기') AS boxes,
      (SELECT count(*) FROM shop_transactions t JOIN shop_items i ON i.id = t.item_id
       WHERE t.profile_id = ${profileId} AND t.kind = 'item_purchase'
         AND (i.name LIKE '%쿠키%' OR i.name LIKE '%과자%')) AS cookies`;
    const { rows: days } = await ctx.sql `
    SELECT day FROM attendance WHERE profile_id = ${profileId} ORDER BY day`;
    return { ...rows[0], streak: longestRun(days.map((d) => d.day)) };
}
/** The tiers a profile has reached, as "key:tier". */
export async function reachedOf(ctx, profileId) {
    const { rows } = await ctx.sql `
    SELECT achievement, tier, reached_at FROM achievement_tiers
    WHERE profile_id = ${profileId}`;
    return new Map(rows.map((r) => [`${r.achievement}:${r.tier}`, r.reached_at]));
}
/**
 * Grants a profile every tier it has newly reached: the tiers, their coins
 * in one grant, and the third tiers' badges. Answers what was new.
 */
export async function check(ctx, profileId, actor) {
    const progress = await progressOf(ctx, profileId);
    const reached = await reachedOf(ctx, profileId);
    const fresh = [];
    for (const a of ACHIEVEMENTS)
        a.goals.forEach((goal, i) => {
            if ((progress[a.key] ?? 0) >= goal && !reached.has(`${a.key}:${i + 1}`))
                fresh.push({ key: a.key, name: a.name, tier: i + 1 });
        });
    if (!fresh.length)
        return [];
    const { changes } = await ctx.sql `
    INSERT INTO achievement_tiers (profile_id, achievement, tier, reached_at)
    SELECT ${profileId}, json_extract(value, '$.key'), json_extract(value, '$.tier'), ${ctx.now}
    FROM json_each(${JSON.stringify(fresh)}) WHERE true
    ON CONFLICT DO NOTHING`;
    if (!changes)
        return [];
    const coin = await coinCurrency(ctx);
    const coins = fresh.reduce((sum, f) => sum + TIER_COINS[f.tier - 1], 0);
    if (coin)
        await grantCurrency(ctx, {
            profileId,
            currencyId: coin.id,
            amount: coins,
            source: "owner_grant",
            actor,
            reason: `${REWARD_REASON}: ${fresh.map((f) => `${f.name} ${TIER_NAMES[f.tier - 1]}`).join(", ")}`.slice(0, 500),
        });
    const tops = fresh.filter((f) => f.tier === 3).map((f) => f.key);
    const badges = new Map();
    if (tops.length) {
        const list = JSON.stringify(tops);
        await ctx.sql `
      INSERT INTO profile_badges (profile_id, badge_id, featured, granted_at, granted_by)
      SELECT ${profileId}, b.id,
        NOT EXISTS (SELECT 1 FROM profile_badges o WHERE o.profile_id = ${profileId}),
        ${ctx.now}, ${actor}
      FROM badges b WHERE b.achievement IN (SELECT value FROM json_each(${list}))
      ON CONFLICT (profile_id, badge_id) DO NOTHING`;
        const { rows } = await ctx.sql `
      SELECT achievement, name, emoji FROM badges
      WHERE achievement IN (SELECT value FROM json_each(${list}))`;
        for (const r of rows)
            badges.set(r.achievement, { name: r.name, emoji: r.emoji });
    }
    return fresh.map((f) => ({
        ...f,
        coins: coin ? TIER_COINS[f.tier - 1] : 0,
        badge: f.tier === 3 ? (badges.get(f.key) ?? null) : null,
    }));
}
/** Every achievement, with a profile's progress and the tiers it reached. */
export async function listFor(ctx, profileId) {
    const progress = await progressOf(ctx, profileId);
    const reached = await reachedOf(ctx, profileId);
    const { rows } = await ctx.sql `SELECT achievement, name, emoji FROM badges WHERE achievement IS NOT NULL`;
    const badges = new Map(rows.map((r) => [r.achievement, r]));
    return ACHIEVEMENTS.map((a) => ({
        key: a.key,
        name: a.name,
        condition: a.condition,
        unit: a.unit,
        progress: progress[a.key] ?? 0,
        tiers: a.goals.map((goal, i) => {
            const at = reached.get(`${a.key}:${i + 1}`);
            return {
                tier: i + 1,
                goal,
                coins: TIER_COINS[i],
                reached_at: at === undefined ? null : new Date(at).toISOString(),
            };
        }),
        badge: badges.has(a.key)
            ? {
                name: badges.get(a.key)?.name ?? "",
                emoji: badges.get(a.key)?.emoji ?? "",
            }
            : null,
    }));
}
