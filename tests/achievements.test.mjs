import assert from "node:assert/strict";
import test from "node:test";
import { as, community, refusal } from "./helpers.mjs";

const NOW = Date.parse("2026-11-02T01:00:00Z");

async function withCoin() {
  const c = await community({ now: NOW });
  const coin = await c.site.mutate("shop:adminCreateCurrency", { name: "코인", is_default: true }, as("m-owner"));
  return { ...c, coin };
}


test("tiers are reached from what is recorded, once, with coins and the third tier's title", async () => {
  const { site, profiles, coin } = await withCoin();
  // Thirty days in a row of check-ins, already there.
  for (let i = 0; i < 30; i++)
    site.run(
      "INSERT INTO attendance (profile_id, day, created_at) VALUES (?, ?, ?)",
      profiles.alice,
      new Date(NOW - (30 - i) * 86_400_000 + 9 * 3_600_000).toISOString().slice(0, 10),
      NOW,
    );
  await site.mutate("shop:adminGrant", { kind: "currency", profile_id: profiles.alice, currency_id: coin.id, amount: 50 }, as("m-owner"));
  const check = () => site.mutate("achievements:check", { profile_id: profiles.alice }, as("m-alice"));
  const { reached } = await check();
  assert.deepEqual(
    reached.map((r) => [r.key, r.tier, r.coins]).sort(),
    [["check_ins", 1, 2], ["coins_earned", 1, 2], ["streak", 1, 2], ["streak", 2, 5], ["streak", 3, 10]],
  );
  assert.equal(reached.find((r) => r.tier === 3).badge.name, "개근상");
  assert.equal((await check()).reached.length, 0);

  // The rewards (21) are not counted toward collecting coins.
  const list = await site.query("achievements:list", { profile_id: profiles.alice }, as("m-bob"));
  const earned = list.find((a) => a.key === "coins_earned");
  assert.equal(earned.progress, 50);
  assert.ok(earned.tiers[0].reached_at);
  assert.equal(earned.tiers[1].reached_at, null);
  assert.equal(list.find((a) => a.key === "streak").progress, 30);

  // The title is hers and shows by her name.
  const featured = await site.query("badges:featured", null, as("m-bob"));
  assert.equal(featured[profiles.alice].name, "개근상");

  // Bob cannot check for her.
  assert.equal(await refusal(site.mutate("achievements:check", { profile_id: profiles.alice }, as("m-bob"))), "not_found");
});

test("a nickname colour pass colours the name for a week, used at once", async () => {
  const { site, profiles, coin } = await withCoin();
  const pass = await site.mutate(
    "shop:adminCreateItem",
    { name: "닉네임 색 변경권", price_amount: 10, currency_id: coin.id, consumable: true, name_color: true },
    as("m-owner"),
  );
  assert.equal(pass.nameColor, true);
  const apply = (color) =>
    site.mutate("nameColors:apply", { profile_id: profiles.alice, item_id: pass.id, color }, as("m-alice"));
  assert.equal(await refusal(apply("red")), "insufficient_quantity");
  await site.mutate("shop:adminGrant", { kind: "item", profile_id: profiles.alice, item_id: pass.id, qty: 1 }, as("m-owner"));
  assert.equal(await refusal(apply("rainbow")), "bad_color");
  await apply("gold");
  let colors = await site.query("nameColors:all", null, as("m-bob"));
  assert.equal(colors[profiles.alice].color, "gold");
  site.now += 7 * 86_400_000;
  colors = await site.query("nameColors:all", null, as("m-bob"));
  assert.equal(colors[profiles.alice], undefined);
});
