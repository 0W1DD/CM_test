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

test("an opened box gives an item to hold; any holder may register it in the shared book", async () => {
  const { site, profiles, box, open } = await withBox();
  assert.equal(await refusal(open("m-alice", profiles.alice)), "no_box");
  await site.mutate("shop:adminGrant", { kind: "item", profile_id: profiles.alice, item_id: box.id, qty: 3 }, as("m-owner"));
  const got = await open("m-alice", profiles.alice);
  assert.equal(got.registered, false);
  const inv = async (u) => (await site.query("shop:inventory", { username: u }, as("m-alice"))).items;
  const held = (await inv("alice")).find((e) => e.itemId === got.item_id);
  assert.deepEqual([held.itemName, held.qty, held.boxEntry, held.registered, held.consumable], [got.entry, 1, true, false, true]);
  // Not sold in the shop.
  const shop = await site.query("shop:summary", { profile_id: profiles.alice }, as("m-alice"));
  assert.equal(shop.items.some((i) => i.id === got.item_id), false);

  // Alice gives it to Bob; Bob registers it; it stays with him, and the book is everyone's.
  await site.mutate("uses:transfer", { profile_id: profiles.alice, item_id: got.item_id, to_username: "bob", qty: 1 }, as("m-alice"));
  assert.equal(await refusal(site.mutate("boxes:register", { profile_id: profiles.alice, item_id: got.item_id }, as("m-alice"))), "not_found");
  const coins = (p) => site.rows("SELECT amount FROM shop_balances WHERE profile_id = ?", p)[0]?.amount ?? 0;
  const before = coins(profiles.bob);
  const reg = await site.mutate("boxes:register", { profile_id: profiles.bob, item_id: got.item_id }, as("m-bob"));
  assert.deepEqual([reg.coins, coins(profiles.bob) - before], [2, 2]);
  assert.equal(await refusal(site.mutate("boxes:register", { profile_id: profiles.bob, item_id: got.item_id }, as("m-bob"))), "already_registered");
  assert.equal((await inv("bob")).find((e) => e.itemId === got.item_id).registered, true);
  const book = await site.query("boxes:collection", null, as("m-alice"));
  assert.equal(book.registered, 1);
  assert.equal(book.total > 800, true);
  const entry = book.categories.flatMap((c) => c.entries).find((e) => e.entry === got.entry);
  assert.equal(entry.by.username, "bob");

  // The draw favours what the book lacks: the next two are not the registered one.
  for (let i = 0; i < 2; i++) assert.notEqual((await open("m-alice", profiles.alice)).entry, got.entry);

  // An ordinary item cannot be opened or registered.
  const gold = (await site.query("shop:adminCurrencies", null, as("m-owner")))[0];
  const cup = await site.mutate("shop:adminCreateItem", { name: "컵", price_amount: 1, currency_id: gold.id }, as("m-owner"));
  await site.mutate("shop:adminGrant", { kind: "item", profile_id: profiles.alice, item_id: cup.id }, as("m-owner"));
  assert.equal(await refusal(site.mutate("boxes:open", { profile_id: profiles.alice, item_id: cup.id }, as("m-alice"))), "not_random_box");
  assert.equal(await refusal(site.mutate("boxes:register", { profile_id: profiles.alice, item_id: cup.id }, as("m-alice"))), "not_in_book");

  // Only the staff reset the book.
  assert.equal(await refusal(site.mutate("boxes:reset", null, as("m-bob"))), "not_moderator");
  assert.equal((await site.mutate("boxes:reset", null, as("m-owner"))).removed, 1);
  assert.equal((await site.query("boxes:collection", null, as("m-bob"))).registered, 0);
});
