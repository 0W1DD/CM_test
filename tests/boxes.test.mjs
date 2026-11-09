import assert from "node:assert/strict";
import test from "node:test";
import { as, community, refusal } from "./helpers.mjs";

const DAY = 24 * 3_600_000;
// Monday 2 November 2026, 10:00 in Korea.
const MONDAY_10 = Date.parse("2026-11-02T01:00:00Z");

async function withBox() {
  const c = await community({ now: MONDAY_10 });
  const { site, profiles } = c;
  const gold = await site.mutate("shop:adminCreateCurrency", { name: "골드", is_default: true }, as("m-owner"));
  const box = await site.mutate(
    "shop:adminCreateItem",
    { name: "크리스마스 랜덤박스", price_amount: 5, currency_id: gold.id, random_box: true },
    as("m-owner"),
  );
  for (const p of [profiles.alice, profiles.bob])
    await site.mutate("shop:adminGrant", { kind: "currency", profile_id: p, currency_id: gold.id, amount: 100 }, as("m-owner"));
  const buy = (member, profile) => site.mutate("shop:buy", { profile_id: profile, item_id: box.id }, as(member));
  const open = (member, profile) => site.mutate("boxes:open", { profile_id: profile, item_id: box.id }, as(member));
  return { ...c, box, buy, open };
}

test("a random box is bought once a day, and can be given away", async () => {
  const { site, profiles, box, buy } = await withBox();
  assert.equal(box.randomBox, true);
  await buy("m-alice", profiles.alice);
  assert.equal(await refusal(buy("m-alice", profiles.alice)), "box_bought_today");
  // Bob's own day is his; a box given to Alice is not a purchase.
  await buy("m-bob", profiles.bob);
  await site.mutate("uses:transfer", { profile_id: profiles.bob, item_id: box.id, to_username: "alice", qty: 1 }, as("m-bob"));
  site.now += DAY;
  await buy("m-alice", profiles.alice);
  const inv = await site.query("shop:inventory", { username: "alice" }, as("m-alice"));
  const held = inv.items.find((e) => e.itemId === box.id);
  assert.equal(held.qty, 3);
  assert.equal(held.randomBox, true);
});

test("opening a box gives something new to the collection, never twice while any is left", async () => {
  const { site, profiles, box, buy, open } = await withBox();
  assert.equal(await refusal(open("m-alice", profiles.alice)), "no_box");
  await site.mutate("shop:adminGrant", { kind: "item", profile_id: profiles.alice, item_id: box.id, qty: 20 }, as("m-owner"));
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    const got = await open("m-alice", profiles.alice);
    assert.equal(got.is_new, true);
    assert.equal(seen.has(got.entry), false);
    seen.add(got.entry);
  }
  assert.equal(await refusal(open("m-alice", profiles.alice)), "no_box");
  assert.equal(await refusal(open("m-bob", profiles.alice)), "not_found");
  const book = await site.query("boxes:collection", { profile_id: profiles.alice }, as("m-bob"));
  assert.equal(book.collected, 20);
  assert.equal(book.total > 800, true);
  assert.equal(book.recent.length, 20);
  const counted = book.categories.flatMap((c) => c.entries).filter((e) => e.count > 0).length;
  assert.equal(counted, 20);
  // An ordinary item cannot be opened.
  const gold = (await site.query("shop:adminCurrencies", null, as("m-owner")))[0];
  const cup = await site.mutate("shop:adminCreateItem", { name: "컵", price_amount: 1, currency_id: gold.id }, as("m-owner"));
  await site.mutate("shop:adminGrant", { kind: "item", profile_id: profiles.alice, item_id: cup.id }, as("m-owner"));
  assert.equal(await refusal(site.mutate("boxes:open", { profile_id: profiles.alice, item_id: cup.id }, as("m-alice"))), "not_random_box");
  void buy;
});
