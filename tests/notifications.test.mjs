import assert from "node:assert/strict";
import test from "node:test";
import { as, community, refusal, VISITOR } from "./helpers.mjs";

async function setup() {
  const { site, profiles } = await community();
  const post = await site.mutate(
    "posts:create",
    { profile_id: profiles.alice, content: "글" },
    as("m-alice"),
  );
  site.now += 1000;
  const reply = await site.mutate(
    "posts:create",
    { profile_id: profiles.bob, content: "답글", in_reply_to_id: post.id },
    as("m-bob"),
  );
  site.now += 1000;
  await site.mutate(
    "posts:react",
    { post_id: post.id, profile_id: profiles.bob, emoji: "❤️" },
    as("m-bob"),
  );
  return { site, profiles, post, reply };
}

test("a profile's notifications: newest first, with sender and post, only for its owners", async () => {
  const { site, profiles, post, reply } = await setup();
  const args = { profile_id: profiles.alice };
  assert.equal(await refusal(site.query("notifications:list", args, VISITOR)), "signed_out");
  assert.equal(
    await refusal(site.query("notifications:list", args, as("m-bob"))),
    "not_profile_owner",
  );
  const result = await site.query("notifications:list", args, as("m-alice"));
  assert.equal(result.pagination.total_count, 2);
  const [reaction, replied] = result.data;
  assert.equal(reaction.type, "reaction");
  assert.equal(reaction.content, "BOB님이 게시물에 ❤️ 반응을 남겼습니다");
  assert.equal(reaction.read_at, null);
  assert.deepEqual(reaction.sender, {
    id: profiles.bob,
    name: "BOB",
    username: "bob",
    profile_picture_url: null,
  });
  assert.equal(reaction.related_post.id, post.id);
  assert.equal(reaction.related_post.author.username, "alice");
  assert.equal(replied.type, "reply");
  assert.equal(replied.related_post.id, reply.id);

  const first = await site.query("notifications:list", { ...args, limit: 1 }, as("m-alice"));
  assert.equal(first.pagination.has_more, true);
  const second = await site.query(
    "notifications:list",
    { ...args, limit: 1, cursor: first.pagination.next_cursor },
    as("m-alice"),
  );
  assert.equal(second.data[0].type, "reply");
});

test("notifications about deleted posts are left out", async () => {
  const { site, profiles, reply } = await setup();
  await site.mutate("posts:remove", { post_id: reply.id, profile_id: profiles.bob }, as("m-bob"));
  const result = await site.query("notifications:list", { profile_id: profiles.alice }, as("m-alice"));
  assert.deepEqual(result.data.map((n) => n.type), ["reaction"]);
});

test("unread count, mark read, unread, all read and delete", async () => {
  const { site, profiles } = await setup();
  const args = { profile_id: profiles.alice };
  const count = () => site.query("notifications:unreadCount", args, as("m-alice"));
  assert.deepEqual(await count(), { count: 2 });
  assert.equal(
    await refusal(site.query("notifications:unreadCount", args, as("m-bob"))),
    "not_profile_owner",
  );
  const [{ id }] = (await site.query("notifications:list", args, as("m-alice"))).data;
  const read = await site.mutate("notifications:markRead", { ...args, notification_id: id }, as("m-alice"));
  assert.equal(read.is_read, true);
  assert.deepEqual(await count(), { count: 1 });
  assert.equal(
    await refusal(site.mutate("notifications:markRead", { profile_id: profiles.bob, notification_id: id }, as("m-bob"))),
    "not_found",
  );
  await site.mutate("notifications:markUnread", { ...args, notification_id: id }, as("m-alice"));
  assert.deepEqual(await count(), { count: 2 });
  const all = await site.mutate("notifications:markAllRead", args, as("m-alice"));
  assert.equal(all.all_read, true);
  assert.deepEqual(await count(), { count: 0 });
  await site.mutate("notifications:remove", { ...args, notification_id: id }, as("m-alice"));
  const left = await site.query("notifications:list", args, as("m-alice"));
  assert.equal(left.data.length, 1);
});
