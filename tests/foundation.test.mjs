import assert from "node:assert/strict";
import test from "node:test";
import { as, community, OWNER_SITE, refusal, VISITOR } from "./helpers.mjs";
import { testSite } from "./sql-ctx.mjs";

test("the owner opens the community once, and only the owner", async () => {
  const site = await testSite();
  const args = { name: "커뮤", ends_at: new Date(site.now + 1e9).toISOString() };
  assert.equal(await refusal(site.mutate("owner:setup", args, as("m-1"))), "not_site_owner");
  assert.equal((await site.query("me:instance", null, VISITOR)).is_set_up, false);
  await site.mutate("owner:setup", args, OWNER_SITE);
  assert.equal(await refusal(site.mutate("owner:setup", args, OWNER_SITE)), "already_set_up");
  assert.equal((await site.query("me:instance", null, VISITOR)).name, "커뮤");
});

test("a member's session has their role and active profiles", async () => {
  const { site, profiles } = await community();
  assert.equal(await site.query("me:session", null, VISITOR), null);
  const owner = await site.query("me:session", null, as("m-owner"));
  assert.equal(owner.role, "owner");
  assert.deepEqual(owner.profiles.map((p) => p.id), [profiles.owner]);
  const stranger = await site.query("me:session", null, as("m-stranger"));
  assert.equal(stranger.is_member, false);
  assert.deepEqual(stranger.profiles, []);
});

test("claiming moves the owner role", async () => {
  const { site } = await community();
  await site.mutate("owner:claim", { member: "m-alice" }, OWNER_SITE);
  assert.equal((await site.query("me:session", null, as("m-alice"))).role, "owner");
  assert.equal((await site.query("me:session", null, as("m-owner"))).role, "member");
});

test("an image is registered from the member's own upload", async () => {
  const { site } = await community();
  site.upload({ member: "m-alice", name: "a.png", type: "image/png" });
  const [{ id }] = site.rows("SELECT id FROM _naru_uploads");
  assert.equal(
    await refusal(site.mutate("images:register", { upload_id: id, width: 10, height: 10 }, as("m-bob"))),
    "invalid_upload",
  );
  const image = await site.mutate("images:register", { upload_id: id, width: 10, height: 20 }, as("m-alice"));
  assert.equal(image.height, 20);
  assert.equal(image.filename, "a.png");
});
