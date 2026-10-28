import assert from "node:assert/strict";
import test from "node:test";
import { as, community, refusal, VISITOR } from "./helpers.mjs";

/** A community with a default currency 골드 and two items: 검 (unique) and 포션 (consumable). */
async function withShop(options) {
  const c = await community(options);
  const { site } = c;
  const gold = await site.mutate(
    "shop:adminCreateCurrency",
    { name: "골드", is_default: true },
    as("m-owner"),
  );
  const sword = await site.mutate(
    "shop:adminCreateItem",
    { name: "검", description: "번뜩이는 직검", price_amount: 100, currency_id: gold.id, is_unique: true },
    as("m-owner"),
  );
  const potion = await site.mutate(
    "shop:adminCreateItem",
    { name: "포션", price_amount: 10, currency_id: gold.id, consumable: true },
    as("m-owner"),
  );
  const grant = (profile, amount) =>
    site.mutate(
      "shop:adminGrant",
      { kind: "currency", profile_id: profile, currency_id: gold.id, amount },
      as("m-owner"),
    );
  const balance = (profile) =>
    site.rows("SELECT amount FROM shop_balances WHERE profile_id = ?", profile)[0]?.amount ?? 0;
  const qty = (profile, item) =>
    site.rows("SELECT qty FROM shop_inventory WHERE profile_id = ? AND item_id = ?", profile, item)[0]?.qty ?? 0;
  return { ...c, gold, sword, potion, grant, balance, qty };
}

test("the owner manages currencies and items; staff read them; members do not", async () => {
  const { site, gold } = await withShop();
  assert.equal(gold.isDefault, true);
  assert.equal(
    await refusal(site.mutate("shop:adminCreateCurrency", { name: "별" }, as("m-alice"))),
    "not_owner",
  );
  assert.equal(await refusal(site.query("shop:adminItems", null, as("m-alice"))), "not_moderator");
  site.run("UPDATE members SET role = 'moderator' WHERE member = 'm-alice'");
  assert.equal((await site.query("shop:adminItems", null, as("m-alice"))).length, 2);
  assert.equal(
    await refusal(site.mutate("shop:adminCreateItem", { name: "x", price_amount: 1, currency_id: gold.id }, as("m-alice"))),
    "not_owner",
  );
  // A new default takes over; names are unique.
  const star = await site.mutate("shop:adminCreateCurrency", { name: "별", is_default: true }, as("m-owner"));
  const currencies = await site.query("shop:adminCurrencies", null, as("m-owner"));
  assert.deepEqual(currencies.map((c) => [c.name, c.isDefault]), [["별", true], ["골드", false]]);
  assert.equal(
    await refusal(site.mutate("shop:adminCreateCurrency", { name: "별" }, as("m-owner"))),
    "duplicate_entry",
  );
  assert.equal(
    await refusal(site.mutate("shop:adminCreateItem", { name: "검", price_amount: 5, currency_id: star.id }, as("m-owner"))),
    "duplicate_entry",
  );
  assert.equal(
    await refusal(site.mutate("shop:adminCreateItem", { name: "x", price_amount: 0, currency_id: star.id }, as("m-owner"))),
    "invalid",
  );
  assert.equal(
    await refusal(site.mutate("shop:adminUpdateItem", { item_id: currencies[0].id }, as("m-owner"))),
    "invalid",
  );
  await site.mutate("shop:adminDeleteCurrency", { currency_id: star.id }, as("m-owner"));
  assert.equal((await site.query("shop:adminCurrencies", null, as("m-owner"))).length, 1);
});

test("buying charges the balance and adds the item, or neither", async () => {
  const { site, profiles, sword, potion, grant, balance, qty } = await withShop();
  const buy = (item, member = "m-alice", profile = profiles.alice) =>
    site.mutate("shop:buy", { profile_id: profile, item_id: item.id }, as(member));
  assert.equal(await refusal(buy(sword)), "insufficient_balance");
  assert.equal(qty(profiles.alice, sword.id), 0);
  assert.equal(site.rows("SELECT count(*) AS n FROM shop_transactions WHERE kind = 'item_purchase'")[0].n, 0);

  await grant(profiles.alice, 150);
  assert.equal((await buy(sword)).item.name, "검");
  assert.equal(balance(profiles.alice), 50);
  assert.equal(qty(profiles.alice, sword.id), 1);
  // A unique item is held once, and the refusal costs nothing.
  assert.equal(await refusal(buy(sword)), "already_owned");
  assert.equal(balance(profiles.alice), 50);
  for (let i = 0; i < 5; i++) await buy(potion);
  assert.equal(balance(profiles.alice), 0);
  assert.equal(await refusal(buy(potion)), "insufficient_balance");
  assert.equal(qty(profiles.alice, potion.id), 5);

  // Only for one's own profile, and only for members.
  assert.equal(await refusal(buy(potion, "m-bob")), "not_found");
  assert.equal(await refusal(buy(potion, "m-stranger")), "not_member");

  const summary = await site.query("shop:summary", { profile_id: profiles.alice }, as("m-alice"));
  assert.equal(summary.default_currency.name, "골드");
  assert.equal(summary.has_items, true);
  assert.deepEqual(summary.balances.map((b) => b.amount), [0]);
  assert.deepEqual(summary.inventory.map((i) => [i.itemName, i.qty]), [["검", 1], ["포션", 5]]);

  const inventory = await site.query("shop:inventory", { username: "ALICE" }, as("m-bob"));
  assert.equal(inventory.profile_id, profiles.alice);
  assert.equal(inventory.items.length, 2);
  assert.equal(await refusal(site.query("shop:inventory", { username: "alice" }, VISITOR)), "signed_out");
});

test("grants: items respect uniqueness; the log pages newest first", async () => {
  const { site, profiles, sword, potion, grant } = await withShop();
  await grant(profiles.bob, 5);
  site.now += 1;
  await site.mutate(
    "shop:adminGrant",
    { kind: "item", profile_id: profiles.bob, item_id: sword.id, reason: "이벤트" },
    as("m-owner"),
  );
  assert.equal(
    await refusal(
      site.mutate("shop:adminGrant", { kind: "item", profile_id: profiles.bob, item_id: sword.id }, as("m-owner")),
    ),
    "already_owned",
  );
  site.now += 1;
  await site.mutate(
    "shop:adminGrant",
    { kind: "item", profile_id: profiles.bob, item_id: potion.id, qty: 3 },
    as("m-owner"),
  );
  assert.equal(
    await refusal(site.mutate("shop:adminGrant", { kind: "currency", profile_id: profiles.bob, currency_id: sword.id, amount: 1 }, as("m-owner"))),
    "not_found",
  );
  const first = await site.query("shop:adminTransactions", { limit: 2 }, as("m-owner"));
  assert.deepEqual(first.data.map((t) => t.itemQtyDelta), [3, 1]);
  assert.equal(first.data[1].reason, "이벤트");
  assert.equal(first.pagination.has_more, true);
  const rest = await site.query(
    "shop:adminTransactions",
    { limit: 2, cursor: first.pagination.next_cursor, profile_id: profiles.bob },
    as("m-owner"),
  );
  assert.deepEqual(rest.data.map((t) => [t.kind, t.currencyDelta]), [["currency_grant", 5]]);
  assert.equal(rest.data[0].actorUserId, "m-owner");
  const found = await site.query("shop:adminProfiles", { q: "bo" }, as("m-owner"));
  assert.deepEqual(found.map((p) => p.username), ["bob"]);
});

test("balances and quantities never go below zero in the database", async () => {
  const { site, profiles, gold } = await withShop();
  assert.throws(() =>
    site.run(
      "INSERT INTO shop_balances (id, profile_id, currency_id, amount, updated_at) VALUES ('x', ?, ?, -1, 0)",
      profiles.alice,
      gold.id,
    ),
  );
});

test("the owner grants to everyone or to chosen profiles at once, and takes back", async () => {
  const { site, profiles, gold, sword, potion, balance, qty } = await withShop();
  const members = Object.values(profiles);
  // Everyone: every live member profile, each with its own log row.
  const all = await site.mutate(
    "shop:adminGrantMany",
    { all: true, kind: "currency", currency_id: gold.id, amount: 30, reason: "기본 지급" },
    as("m-owner"),
  );
  assert.equal(all.count, members.length);
  for (const profile of members) assert.equal(balance(profile), 30);
  assert.equal(
    site.rows("SELECT count(*) AS n FROM shop_transactions WHERE reason = '기본 지급'")[0].n,
    members.length,
  );
  // Chosen profiles; a unique item skips whoever already has it.
  await site.mutate(
    "shop:adminGrant",
    { kind: "item", profile_id: profiles.bob, item_id: sword.id },
    as("m-owner"),
  );
  site.now += 1;
  const chosen = await site.mutate(
    "shop:adminGrantMany",
    { profile_ids: [profiles.alice, profiles.bob], kind: "item", item_id: sword.id },
    as("m-owner"),
  );
  assert.equal(chosen.count, 1);
  assert.equal(qty(profiles.alice, sword.id), 1);
  assert.equal(qty(profiles.bob, sword.id), 1);
  // Taking back: refused when short, otherwise logged as negative.
  assert.equal(
    await refusal(
      site.mutate(
        "shop:adminRevoke",
        { kind: "currency", profile_id: profiles.alice, currency_id: gold.id, amount: 31 },
        as("m-owner"),
      ),
    ),
    "insufficient_balance",
  );
  await site.mutate(
    "shop:adminRevoke",
    { kind: "currency", profile_id: profiles.alice, currency_id: gold.id, amount: 10, reason: "룰렛" },
    as("m-owner"),
  );
  assert.equal(balance(profiles.alice), 20);
  await site.mutate(
    "shop:adminGrant",
    { kind: "item", profile_id: profiles.alice, item_id: potion.id, qty: 2 },
    as("m-owner"),
  );
  await site.mutate(
    "shop:adminRevoke",
    { kind: "item", profile_id: profiles.alice, item_id: potion.id, qty: 2 },
    as("m-owner"),
  );
  assert.equal(qty(profiles.alice, potion.id), 0);
  assert.equal(
    await refusal(
      site.mutate(
        "shop:adminGrantMany",
        { all: true, kind: "currency", currency_id: gold.id, amount: 1 },
        as("m-alice"),
      ),
    ),
    "not_owner",
  );
});

test("the use log: members use items off the timeline, secrets stay hidden, staff confirm", async () => {
  const { site, profiles, potion, sword, qty } = await withShop();
  const give = (item, profile, n = 1) =>
    site.mutate("shop:adminGrant", { kind: "item", profile_id: profile, item_id: item.id, qty: n }, as("m-owner"));
  await give(potion, profiles.alice, 2);
  const use = (args, member = "m-alice") =>
    site.mutate("uses:use", { profile_id: profiles.alice, ...args }, as(member));

  // A consumable is spent; a use of something not held is refused and spends nothing.
  site.now += 1;
  const open = await use({ item_id: potion.id, note: "상처에 바른다" });
  assert.equal(open.item_name, "포션");
  assert.equal(open.status, "pending");
  assert.equal(qty(profiles.alice, potion.id), 1);
  assert.equal(await refusal(use({ item_id: sword.id })), "not_owned");
  assert.equal(await refusal(use({ item_id: potion.id }, "m-bob")), "not_found");
  site.now += 1;
  const secret = await use({ item_id: potion.id, note: "몰래", secret: true });
  assert.equal(secret.item_name, "포션"); // its owner sees it
  assert.equal(qty(profiles.alice, potion.id), 0);
  assert.equal(await refusal(use({ item_id: potion.id })), "insufficient_quantity");

  // Others see the secret only as a secret; the staff see it all.
  const seen = async (member) => (await site.query("uses:list", null, as(member))).data;
  const bob = await seen("m-bob");
  assert.deepEqual(bob.map((u) => [u.item_name, u.note, u.hidden]), [[null, null, true], ["포션", "상처에 바른다", false]]);
  const owner = await site.query("uses:list", null, as("m-owner"));
  assert.equal(owner.data[0].note, "몰래");
  assert.equal(owner.pending_count, 2);
  assert.equal((await site.query("uses:list", null, as("m-bob"))).pending_count, null);

  // Only the staff confirm; the pending filter follows.
  assert.equal(await refusal(site.mutate("uses:approve", { use_id: open.id }, as("m-bob"))), "not_moderator");
  const approved = await site.mutate("uses:approve", { use_id: open.id }, as("m-owner"));
  assert.equal(approved.status, "approved");
  const pending = await site.query("uses:list", { pending: true }, as("m-owner"));
  assert.deepEqual(pending.data.map((u) => u.id), [secret.id]);
  assert.equal(pending.pending_count, 1);
  assert.equal(await refusal(site.query("uses:list", null, VISITOR)), "signed_out");
});
