import assert from "node:assert/strict";
import test from "node:test";
import { as, community, refusal } from "./helpers.mjs";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Monday 2 November 2026, 10:00 in Korea.
const MONDAY_10 = Date.parse("2026-11-02T01:00:00Z");

/** A community on Monday morning with a default currency, 코인. */
async function setup(members = ["alice", "bob", "carol"]) {
  const c = await community({ members: [...members, "mod"], now: MONDAY_10 });
  const { site } = c;
  site.run("UPDATE members SET role = 'moderator' WHERE member = 'm-mod'");
  await site.mutate("shop:adminCreateCurrency", { name: "코인", is_default: true }, as("m-owner"));
  const coins = (profile) =>
    site.rows("SELECT amount FROM shop_balances WHERE profile_id = ?", profile)[0]?.amount ?? 0;
  const call = (name, member, profile, args = {}) =>
    site.mutate(`events:${name}`, { profile_id: profile, ...args }, as(member));
  const status = (member, profile) =>
    site.query("events:status", { profile_id: profile }, as(member));
  return { ...c, coins, call, status };
}

test("a morning check-in gives a coin, once a day per profile", async () => {
  const { site, profiles, coins, call, status } = await setup();
  const before = await status("m-alice", profiles.alice);
  assert.deepEqual(
    [before.check_in.day, before.check_in.checked_in, before.check_in.open, before.currency],
    ["2026-11-02", false, true, "코인"],
  );
  assert.deepEqual(await call("checkIn", "m-alice", profiles.alice), { day: "2026-11-02", coins: 1, currency: "코인" });
  assert.equal(coins(profiles.alice), 1);
  assert.equal(await refusal(call("checkIn", "m-alice", profiles.alice)), "already_checked_in");
  assert.equal((await status("m-alice", profiles.alice)).check_in.checked_in, true);
  // Another profile checks in on its own.
  await call("checkIn", "m-bob", profiles.bob);
  assert.equal(coins(profiles.bob), 1);
  // Noon in Korea and after: closed. The next morning: open again.
  site.now = MONDAY_10 + 2 * HOUR;
  assert.equal(await refusal(call("checkIn", "m-carol", profiles.carol)), "not_morning");
  assert.equal((await status("m-carol", profiles.carol)).check_in.open, false);
  site.now = MONDAY_10 + DAY - 9 * HOUR; // Tuesday 01:00
  await call("checkIn", "m-alice", profiles.alice);
  assert.equal(coins(profiles.alice), 2);
  assert.equal(await refusal(call("checkIn", "m-alice", profiles.bob)), "not_found");
});

test("the gift exchange: sign up, draw after Saturday, write, open on Monday 08:00 and get paid", async () => {
  const { site, profiles, coins, call, status } = await setup(["alice", "bob", "carol", "dave"]);
  for (const name of ["alice", "bob", "carol", "dave"])
    await call("giftSignup", `m-${name}`, profiles[name]);
  // Carol changes her mind while sign-up is open, and comes back.
  await call("giftCancel", "m-carol", profiles.carol);
  assert.equal((await status("m-alice", profiles.alice)).gift.participants, 3);
  await call("giftSignup", "m-carol", profiles.carol);

  // The staff pin alice → dave before the draw; members cannot.
  assert.equal(
    await refusal(site.mutate("events:giftPin", { profile_id: profiles.alice, recipient_id: profiles.dave }, as("m-bob"))),
    "not_moderator",
  );
  await site.mutate("events:giftPin", { profile_id: profiles.alice, recipient_id: profiles.dave }, as("m-mod"));
  assert.equal(
    await refusal(site.mutate("events:giftPin", { profile_id: profiles.bob, recipient_id: profiles.dave }, as("m-mod"))),
    "recipient_taken",
  );
  const mine = await status("m-alice", profiles.alice);
  assert.equal(mine.gift.phase, "signup");
  assert.equal(mine.gift.recipient.username, "dave");

  // A gift before the draw is fine; an empty one is not.
  assert.equal(await refusal(call("giftSave", "m-bob", profiles.bob, { content: "  " })), "empty_gift");
  await call("giftSave", "m-alice", profiles.alice, { content: "따뜻한 목도리 https://example.com" });

  // Sunday: sign-up closed, the first call draws everyone else.
  site.now = MONDAY_10 + 6 * DAY;
  assert.equal(await refusal(call("giftSignup", "m-mod", profiles.mod)), "signup_closed");
  await site.mutate("events:settle", {}, as("m-bob"));
  const week = await site.query("events:admin", {}, as("m-mod"));
  const to = Object.fromEntries(week.entries.map((e) => [e.giver.username, e.recipient?.username]));
  assert.equal(to.alice, "dave");
  assert.deepEqual(Object.values(to).sort(), ["alice", "bob", "carol", "dave"]);
  for (const [giver, recipient] of Object.entries(to)) assert.notEqual(giver, recipient);
  assert.equal(week.entries.find((e) => e.giver.username === "alice").pinned, true);

  for (const name of ["bob", "carol"])
    await call("giftSave", `m-${name}`, profiles[name], { content: `${name}의 선물` });
  // Sunday 23:30: closed. Dave sent nothing.
  site.now = MONDAY_10 + 6 * DAY + 13.5 * HOUR;
  assert.equal(await refusal(call("giftSave", "m-dave", profiles.dave, { content: "늦음" })), "gifts_closed");

  // The next Monday 07:59: not open yet, nobody paid. 08:00: open and paid.
  site.now = MONDAY_10 + 7 * DAY - 2 * HOUR - 60_000;
  await site.mutate("events:settle", {}, as("m-bob"));
  const early = await status("m-dave", profiles.dave);
  assert.deepEqual([early.received.open, early.received.gifts.length, early.received.count], [false, 0, 1]);
  assert.equal(coins(profiles.alice), 0);
  site.now = MONDAY_10 + 7 * DAY - 2 * HOUR;
  await site.mutate("events:settle", {}, as("m-bob"));
  const opened = await status("m-dave", profiles.dave);
  assert.deepEqual(opened.received.gifts.map((g) => [g.giver.username, g.content]), [["alice", "따뜻한 목도리 https://example.com"]]);
  for (const name of ["alice", "bob", "carol"]) assert.equal(coins(profiles[name]), 5, name);
  assert.equal(coins(profiles.dave), 0);
  // Paid once only.
  await site.mutate("events:settle", {}, as("m-bob"));
  assert.equal(coins(profiles.alice), 5);
  // A new week's sign-up is open.
  const next = await status("m-alice", profiles.alice);
  assert.deepEqual([next.gift.week, next.gift.phase, next.gift.signed_up], ["2026-11-09", "signup", false]);
});

test("the staff see every gift; members see only their own and what they were given", async () => {
  const { site, profiles, call, status } = await setup(["alice", "bob"]);
  await call("giftSignup", "m-alice", profiles.alice);
  await call("giftSignup", "m-bob", profiles.bob);
  await call("giftSave", "m-alice", profiles.alice, { content: "비밀 선물" });
  assert.equal(await refusal(site.query("events:admin", {}, as("m-bob"))), "not_moderator");
  const staff = await site.query("events:admin", {}, as("m-owner"));
  assert.equal(staff.entries.find((e) => e.giver.username === "alice").content, "비밀 선물");
  assert.equal((await status("m-bob", profiles.bob)).gift.content, null);
  // A draw on demand by the staff, before Saturday: two people give to each other.
  await site.mutate("events:giftDraw", {}, as("m-owner"));
  const drawn = await site.query("events:admin", {}, as("m-owner"));
  assert.deepEqual(drawn.entries.map((e) => [e.giver.username, e.recipient.username]).sort(), [["alice", "bob"], ["bob", "alice"]]);
});
