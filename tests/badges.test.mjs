import assert from "node:assert/strict";
import test from "node:test";
import { as, community, refusal } from "./helpers.mjs";

const FIRST_WEEK = "01900000-0000-7000-8000-000000000001";

test("the first badge is there; the staff give badges, and the first one is featured", async () => {
  const { site, profiles } = await community();
  const admin = await site.query("badges:admin", null, as("m-owner"));
  // The first badge, the achievements' titles (0023) and the 72 HTTP status
  // code badges (0026) are there.
  assert.equal(admin.badges.find((b) => b.id === FIRST_WEEK).emoji, "🎄");
  assert.equal(admin.badges.length, 81);
  const teapot = admin.badges.find((b) => b.emoji === "[418]");
  assert.equal(teapot.name, "I'm a teapot");
  assert.equal(teapot.description, "418호 방에 살고 있습니다.");
  assert.equal(await refusal(site.query("badges:admin", null, as("m-alice"))), "not_moderator");
  assert.equal(
    await refusal(site.mutate("badges:setHolders", { badge_id: FIRST_WEEK, profile_ids: [profiles.alice] }, as("m-alice"))),
    "not_moderator",
  );
  const { holders } = await site.mutate(
    "badges:setHolders",
    { badge_id: FIRST_WEEK, profile_ids: [profiles.alice, profiles.bob] },
    as("m-owner"),
  );
  assert.equal(holders, 2);
  const star = await site.mutate("badges:create", { name: "별", emoji: "⭐" }, as("m-owner"));
  await site.mutate("badges:setHolders", { badge_id: star.id, profile_ids: [profiles.alice] }, as("m-owner"));
  let featured = await site.query("badges:featured", null, as("m-bob"));
  assert.equal(featured[profiles.alice].name, "첫 주를 함께한");
  assert.equal(featured[profiles.bob].name, "첫 주를 함께한");

  // Alice features the star; Bob cannot pick it for her, nor one she lacks.
  assert.equal(
    await refusal(site.mutate("badges:feature", { profile_id: profiles.alice, badge_id: star.id }, as("m-bob"))),
    "not_found",
  );
  await site.mutate("badges:feature", { profile_id: profiles.alice, badge_id: star.id }, as("m-alice"));
  assert.equal(
    await refusal(site.mutate("badges:feature", { profile_id: profiles.bob, badge_id: star.id }, as("m-bob"))),
    "not_found",
  );
  featured = await site.query("badges:featured", null, as("m-bob"));
  assert.equal(featured[profiles.alice].emoji, "⭐");
  const mine = await site.query("badges:ofProfile", { profile_id: profiles.alice }, as("m-bob"));
  assert.deepEqual(mine.map((b) => [b.name, b.featured]), [["첫 주를 함께한", false], ["별", true]]);

  // Taken away, and removed: nothing is featured any more.
  await site.mutate("badges:setHolders", { badge_id: FIRST_WEEK, profile_ids: [profiles.alice] }, as("m-owner"));
  await site.mutate("badges:feature", { profile_id: profiles.alice, badge_id: null }, as("m-alice"));
  await site.mutate("badges:remove", { badge_id: star.id }, as("m-owner"));
  featured = await site.query("badges:featured", null, as("m-bob"));
  assert.deepEqual(Object.keys(featured), []);
  const after = await site.query("badges:admin", null, as("m-owner"));
  assert.equal(after.badges.find((b) => b.id === FIRST_WEEK).holders, 1);
});
