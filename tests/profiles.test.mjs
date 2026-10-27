import assert from "node:assert/strict";
import test from "node:test";
import { addProfile, as, community, refusal, uuid, VISITOR } from "./helpers.mjs";

/** An image `member` uploaded and registered; answers its ID. */
async function image(site, member) {
  site.upload({ member, name: "p.png", type: "image/png" });
  const [{ id }] = site.rows("SELECT id FROM _naru_uploads ORDER BY rowid DESC LIMIT 1");
  return (await site.mutate("images:register", { upload_id: id, width: 4, height: 4 }, as(member))).id;
}

test("profiles are listed for signed-in callers, grouped without member IDs", async () => {
  const { site, profiles } = await community();
  const extra = addProfile(site, "m-alice", "alice2", { primary: false });
  assert.equal(await refusal(site.query("profiles:list", null, VISITOR)), "signed_out");
  const list = await site.query("profiles:list", null, as("m-bob"));
  assert.equal(list.length, 4);
  const alice = list.filter((p) => p.username.startsWith("alice"));
  assert.equal(alice[0].user_group_key, alice[1].user_group_key);
  assert.notEqual(alice[0].user_group_key, list.find((p) => p.username === "bob").user_group_key);
  assert.equal(list.find((p) => p.username === "owner").user_role, "owner");
  assert.ok(list.some((p) => p.id === extra));
  assert.ok(!JSON.stringify(list).includes("m-alice"));
  assert.equal(list.find((p) => p.id === profiles.bob).is_primary, true);
});

test("a profile is read by username, by anyone, with its post count", async () => {
  const { site, profiles } = await community();
  site.run(
    "INSERT INTO posts (id, author_id, created_by, content, created_at, updated_at) VALUES (?, ?, 'm-alice', 'hi', ?, ?)",
    uuid(),
    profiles.alice,
    site.now,
    site.now,
  );
  const alice = await site.query("profiles:get", { username: "ALICE" }, VISITOR);
  assert.deepEqual(Object.keys(alice).sort(), [
    "bio", "created_at", "id", "name", "post_count", "profile_picture_url", "updated_at", "username",
  ]);
  assert.equal(alice.post_count, 1);
  assert.equal(await refusal(site.query("profiles:get", { username: "nobody" })), "not_found");
  assert.deepEqual(await site.query("username:get", { username: "Bob" }), { exists: true, username: "Bob" });
  assert.equal((await site.query("username:get", { username: "zed" })).exists, false);
  assert.equal(
    (await site.query("profiles:postCount", { profile_id: profiles.alice }, as("m-bob"))).post_count,
    1,
  );
});

test("only moderators and the owner create profiles, with unique usernames", async () => {
  const { site } = await community();
  const args = { name: "새", username: "New_One", is_primary: true };
  assert.equal(await refusal(site.mutate("profiles:create", args, as("m-stranger"))), "not_member");
  assert.equal(await refusal(site.mutate("profiles:create", args, as("m-alice"))), "not_moderator");
  assert.equal(
    await refusal(site.mutate("profiles:create", { ...args, username: "bad name" }, as("m-owner"))),
    "invalid",
  );
  assert.equal(
    await refusal(site.mutate("profiles:create", { ...args, username: "ALICE" }, as("m-owner"))),
    "username_taken",
  );
  const made = await site.mutate("profiles:create", args, as("m-owner"));
  assert.equal(made.username, "new_one");
  assert.equal(made.primary, true);
  const session = await site.query("me:session", null, as("m-owner"));
  assert.deepEqual(session.profiles.filter((p) => p.is_primary).map((p) => p.id), [made.id]);
});

test("owners update their profile and picture; admins cannot update", async () => {
  const { site, profiles } = await community();
  const picture = await image(site, "m-alice");
  assert.equal(
    await refusal(site.mutate("profiles:update", { profile_id: profiles.alice, name: "x", username: "x" }, as("m-bob"))),
    "not_found",
  );
  assert.equal(
    await refusal(site.mutate("profiles:update", { profile_id: profiles.alice, name: "A", username: "bob" }, as("m-alice"))),
    "username_taken",
  );
  const updated = await site.mutate(
    "profiles:update",
    { profile_id: profiles.alice, name: "앨리스", username: "Alice_B", bio: "안녕", profile_picture_id: picture },
    as("m-alice"),
  );
  assert.equal(updated.username, "alice_b");
  assert.equal(updated.bio, "안녕");
  assert.match(updated.profile_picture_url, /p\.png/);
  const kept = await site.mutate(
    "profiles:update",
    { profile_id: profiles.alice, name: "앨리스", username: "alice_b" },
    as("m-alice"),
  );
  assert.equal(kept.bio, "안녕");
  // Someone else's image is refused.
  const bobs = await image(site, "m-bob");
  assert.equal(
    await refusal(site.mutate("profiles:setPicture", { profile_id: profiles.alice, image_id: bobs }, as("m-alice"))),
    "invalid_image",
  );
  const set = await site.mutate("profiles:setPicture", { profile_id: profiles.alice, image_id: picture }, as("m-alice"));
  assert.equal(set.image_id, picture);
});

test("primary and only profiles are kept; others are deleted", async () => {
  const { site, profiles } = await community();
  const second = addProfile(site, "m-alice", "alice2", { primary: false });
  assert.equal(
    await refusal(site.mutate("profiles:delete", { profile_id: profiles.alice }, as("m-alice"))),
    "primary_profile",
  );
  assert.equal(
    await refusal(site.mutate("profiles:delete", { profile_id: second }, as("m-bob"))),
    "not_found",
  );
  await site.mutate("profiles:setPrimary", { profile_id: second }, as("m-alice"));
  assert.deepEqual(
    site.rows("SELECT username FROM profiles WHERE is_primary = 1 AND username LIKE 'alice%'"),
    [{ username: "alice2" }],
  );
  assert.deepEqual(
    await site.mutate("profiles:delete", { profile_id: profiles.alice }, as("m-alice")),
    { id: profiles.alice, deleted: true },
  );
  assert.equal(
    await refusal(site.mutate("profiles:delete", { profile_id: second }, as("m-alice"))),
    "primary_profile",
  );
  site.run("UPDATE profiles SET is_primary = 0 WHERE id = ?", second);
  assert.equal(
    await refusal(site.mutate("profiles:delete", { profile_id: second }, as("m-alice"))),
    "only_profile",
  );
  // The deleted profile's username is free again.
  assert.equal((await site.query("username:get", { username: "alice" })).exists, false);
});

test("the community owner shares a profile they own, and stops sharing it", async () => {
  const { site, profiles } = await community();
  const side = addProfile(site, "m-owner", "side", { primary: false });
  const add = { profile_id: side, username: "alice", role: "admin" };
  assert.equal(await refusal(site.mutate("profiles:addUser", add, as("m-alice"))), "not_owner");
  assert.equal(
    await refusal(site.mutate("profiles:addUser", { ...add, profile_id: profiles.owner }, as("m-owner"))),
    "primary_profile",
  );
  assert.equal(
    await refusal(site.mutate("profiles:addUser", { ...add, username: "nobody" }, as("m-owner"))),
    "not_found",
  );
  const added = await site.mutate("profiles:addUser", add, as("m-owner"));
  assert.deepEqual(added.user, { primary_profile_id: profiles.alice, role: "admin" });
  assert.equal(await refusal(site.mutate("profiles:addUser", add, as("m-owner"))), "already_shared");

  const { users } = await site.query("profiles:users", { profile_id: side }, as("m-owner"));
  assert.deepEqual(users.map((u) => u.role), ["owner", "admin"]);
  assert.equal(users[1].primary_profile_id, profiles.alice);
  assert.ok(!JSON.stringify(users).includes("m-alice"));

  // Alice acts as it now, and it is in her session as an admin.
  const session = await site.query("me:session", null, as("m-alice"));
  assert.equal(session.profiles.find((p) => p.id === side).role, "admin");
  await site.mutate("profiles:heartbeat", { profile_id: side }, as("m-alice"));
  // ...but cannot manage it.
  assert.equal(
    await refusal(site.mutate("profiles:setPrimary", { profile_id: side }, as("m-alice"))),
    "not_profile_owner",
  );

  assert.equal(
    await refusal(
      site.mutate("profiles:removeUser", { profile_id: side, shared_profile_id: profiles.owner }, as("m-owner")),
    ),
    "only_owner",
  );
  await site.mutate("profiles:removeUser", { profile_id: side, shared_profile_id: profiles.alice }, as("m-owner"));
  assert.equal(
    (await site.query("me:session", null, as("m-alice"))).profiles.some((p) => p.id === side),
    false,
  );
});

test("online status follows heartbeats, at most one a minute, unless hidden", async () => {
  const { site, profiles } = await community();
  const ids = [profiles.alice, profiles.bob];
  assert.equal(await refusal(site.query("profiles:onlineStatus", { profile_ids: ids }, VISITOR)), "signed_out");
  assert.equal(
    await refusal(site.mutate("profiles:heartbeat", { profile_id: profiles.alice }, as("m-bob"))),
    "not_found",
  );
  await site.mutate("profiles:heartbeat", { profile_id: profiles.alice }, as("m-alice"));
  const start = site.now;
  site.now += 30_000;
  await site.mutate("profiles:heartbeat", { profile_id: profiles.alice }, as("m-alice"));
  assert.deepEqual(site.rows("SELECT last_active_at FROM profile_activity"), [{ last_active_at: start }]);

  const status = await site.query("profiles:onlineStatus", { profile_ids: ids }, as("m-bob"));
  assert.deepEqual(
    status.map(({ profile_id, is_online }) => ({ profile_id, is_online })).sort((a, b) => a.profile_id.localeCompare(b.profile_id)),
    [
      { profile_id: profiles.alice, is_online: true },
      { profile_id: profiles.bob, is_online: false },
    ].sort((a, b) => a.profile_id.localeCompare(b.profile_id)),
  );
  assert.equal(status.find((s) => s.profile_id === profiles.alice).online_until, new Date(start + 300_000).toISOString());

  await site.mutate("profiles:updateOnlineStatusSettings", { profile_id: profiles.alice, visible: false }, as("m-alice"));
  const hidden = await site.query("profiles:onlineStatus", { profile_ids: [profiles.alice] }, as("m-bob"));
  assert.equal(hidden[0].is_online, false);

  await site.mutate("profiles:updateOnlineStatusSettings", { profile_id: profiles.alice, visible: true }, as("m-alice"));
  site.now = start + 301_000;
  const later = await site.query("profiles:onlineStatus", { profile_ids: [profiles.alice] }, as("m-bob"));
  assert.equal(later[0].is_online, false);
});

test("members block and unblock each other by profile", async () => {
  const { site, profiles } = await community();
  assert.equal(
    await refusal(site.mutate("blocks:create", { profile_id: profiles.alice }, as("m-alice"))),
    "cannot_block_self",
  );
  assert.equal(await refusal(site.mutate("blocks:create", { profile_id: uuid() }, as("m-alice"))), "not_found");
  await site.mutate("blocks:create", { profile_id: profiles.bob }, as("m-alice"));
  const bob2 = addProfile(site, "m-bob", "bob2", { primary: false });
  assert.equal(
    await refusal(site.mutate("blocks:create", { profile_id: bob2 }, as("m-alice"))),
    "already_blocked",
  );
  const list = await site.query("blocks:list", null, as("m-alice"));
  assert.deepEqual(
    list.map(({ id, login_name }) => ({ id, login_name })),
    [{ id: profiles.bob, login_name: "bob" }],
  );
  assert.deepEqual(await site.query("blocks:list", null, as("m-bob")), []);
  assert.equal(await refusal(site.mutate("blocks:delete", { id: profiles.bob }, as("m-bob"))), "not_blocked");
  await site.mutate("blocks:delete", { id: profiles.bob }, as("m-alice"));
  assert.deepEqual(await site.query("blocks:list", null, as("m-alice")), []);
});
