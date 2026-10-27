import assert from "node:assert/strict";
import test from "node:test";
import { addProfile, as, community, refusal, VISITOR } from "./helpers.mjs";

const alice = as("m-alice");
const bob = as("m-bob");
const carol = as("m-carol");

async function setup() {
  return community({ members: ["alice", "bob", "carol"] });
}

/** Registers an upload of `member`'s as an image; answers its ID. */
async function image(site, member) {
  site.upload({ member, name: "p.png", type: "image/png" });
  const [{ id }] = site.rows(
    "SELECT id FROM _naru_uploads ORDER BY rowid DESC LIMIT 1",
  );
  await site.mutate("images:register", { upload_id: id, width: 4, height: 3 }, as(member));
  return id;
}

async function dm(site, from, profileId, receiverId, content, extra = {}) {
  site.now += 1000;
  return site.mutate(
    "messages:send",
    { profile_id: profileId, receiver_id: receiverId, content, ...extra },
    from,
  );
}

test("a direct message reaches the receiver, with images and a push", async () => {
  const { site, profiles } = await setup();
  const upload = await image(site, "m-alice");
  site.notifications.length = 0;
  const sent = await dm(site, alice, profiles.alice, profiles.bob, "안녕", {
    image_ids: [upload],
  });
  assert.equal(sent.is_sender, true);
  assert.equal(sent.sender.username, "alice");
  assert.deepEqual(sent.images.map((i) => [i.id, i.width, i.height]), [[upload, 4, 3]]);
  assert.deepEqual(site.notifications, [
    { members: ["m-bob"], title: "ALICE", body: "안녕", path: "/messages/alice" },
  ]);

  // Only one's own registered uploads can be attached.
  const bobs = await image(site, "m-bob");
  assert.equal(
    await refusal(dm(site, alice, profiles.alice, profiles.bob, "", { image_ids: [bobs] })),
    "invalid_image",
  );
  assert.equal(await refusal(dm(site, alice, profiles.alice, profiles.bob, "  ")), "empty_message");
  assert.equal(await refusal(dm(site, alice, profiles.alice, profiles.alice, "나")), "self_message");

  // A photo alone is pushed as commung's line.
  site.notifications.length = 0;
  await dm(site, alice, profiles.alice, profiles.bob, "", { image_ids: [await image(site, "m-alice")] });
  assert.equal(site.notifications[0].body, "사진을 보냈습니다");

  const thread = await site.query(
    "messages:conversation",
    { profile_id: profiles.bob, username: "ALICE" },
    bob,
  );
  assert.equal(thread.other_profile.id, profiles.alice);
  assert.deepEqual(thread.messages.map((m) => m.content), ["안녕", ""]);
  assert.equal(thread.messages[0].images[0].url.length > 0, true);
  assert.equal(thread.messages[0].is_sender, false);
  assert.equal(thread.messages[0].receiver.id, profiles.bob);
  assert.deepEqual(thread.pagination, { next_cursor: null, has_more: false, total_count: 2 });
});

test("only a conversation's participants read or touch its messages", async () => {
  const { site, profiles } = await setup();
  const sent = await dm(site, alice, profiles.alice, profiles.bob, "비밀");
  // Carol can't act as Alice's profile, and sees nothing in her own.
  assert.equal(
    await refusal(site.query("messages:conversation", { profile_id: profiles.alice, other_profile_id: profiles.bob }, carol)),
    "not_found",
  );
  const own = await site.query(
    "messages:conversation",
    { profile_id: profiles.carol, other_profile_id: profiles.bob },
    carol,
  );
  assert.deepEqual(own.messages, []);
  assert.equal(
    await refusal(site.mutate("messages:addReaction", { profile_id: profiles.carol, message_id: sent.id, emoji: "👍" }, carol)),
    "not_participant",
  );
  assert.equal(
    await refusal(site.mutate("messages:remove", { profile_id: profiles.carol, message_id: sent.id, mode: "for_me" }, carol)),
    "not_participant",
  );
  // Visitors and non-members are refused.
  assert.equal(await refusal(site.query("messages:unreadCount", { profile_id: profiles.bob }, VISITOR)), "signed_out");
  assert.equal(
    await refusal(site.query("messages:unreadCount", { profile_id: profiles.bob }, as("m-stranger"))),
    "not_member",
  );
});

test("a profile's shared admins act as it, and the push skips them", async () => {
  const { site, profiles } = await setup();
  site.run(
    "INSERT INTO profile_owners (profile_id, member, role, created_at, created_by) VALUES (?, 'm-carol', 'admin', ?, 'm-alice')",
    profiles.alice,
    site.now,
  );
  site.run(
    "INSERT INTO profile_owners (profile_id, member, role, created_at, created_by) VALUES (?, 'm-carol', 'admin', ?, 'm-bob')",
    profiles.bob,
    site.now,
  );
  site.notifications.length = 0;
  await dm(site, carol, profiles.alice, profiles.bob, "대신 보냄");
  // Bob gets it; Carol, who also holds Alice's profile, does not.
  assert.deepEqual(site.notifications[0].members, ["m-bob"]);
});

test("blocks stop direct messages both ways; muted profiles still message", async () => {
  const { site, profiles } = await setup();
  site.run("INSERT INTO member_blocks (blocker, blocked, created_at) VALUES ('m-bob', 'm-alice', ?)", site.now);
  assert.equal(await refusal(dm(site, alice, profiles.alice, profiles.bob, "hi")), "blocked");
  assert.equal(await refusal(dm(site, bob, profiles.bob, profiles.alice, "hi")), "blocked");
  assert.equal(
    await refusal(
      site.mutate(
        "groupChats:create",
        { name: "방", creator_profile_id: profiles.alice, member_profile_ids: [profiles.bob, profiles.carol] },
        alice,
      ),
    ),
    "blocked",
  );
  // commung lets muted profiles message; only posting is muted.
  site.run("UPDATE profiles SET muted_at = ? WHERE id = ?", site.now, profiles.carol);
  const sent = await dm(site, carol, profiles.carol, profiles.alice, "뮤트되어도");
  assert.equal(sent.content, "뮤트되어도");
});

test("conversations list the latest message per profile with unread counts", async () => {
  const { site, profiles } = await setup();
  await dm(site, alice, profiles.alice, profiles.bob, "1");
  await dm(site, carol, profiles.carol, profiles.bob, "2");
  await dm(site, alice, profiles.alice, profiles.bob, "3");
  await dm(site, bob, profiles.bob, profiles.carol, "4");
  const list = await site.query("messages:conversations", { profile_id: profiles.bob }, bob);
  assert.deepEqual(
    list.map((c) => [c.other_profile.username, c.last_message.content, c.last_message.is_sender, c.unread_count]),
    [
      ["carol", "4", true, "1"],
      ["alice", "3", false, "2"],
    ],
  );
  assert.deepEqual(await site.query("messages:unreadCount", { profile_id: profiles.bob }, bob), { count: 3 });

  const read = await site.mutate(
    "messages:markConversationRead",
    { profile_id: profiles.bob, other_profile_id: profiles.alice },
    bob,
  );
  assert.equal(read.is_read, true);
  assert.deepEqual(await site.query("messages:unreadCount", { profile_id: profiles.bob }, bob), { count: 1 });
  const thread = await site.query(
    "messages:conversation",
    { profile_id: profiles.alice, other_profile_id: profiles.bob },
    alice,
  );
  assert.ok(thread.messages.every((m) => m.read_at));

  await site.mutate("messages:markAllRead", { profile_id: profiles.bob }, bob);
  assert.deepEqual(await site.query("messages:unreadCount", { profile_id: profiles.bob }, bob), { count: 0 });
});

test("a conversation pages back by cursor", async () => {
  const { site, profiles } = await setup();
  for (let i = 1; i <= 5; i++)
    await dm(site, i % 2 ? alice : bob, i % 2 ? profiles.alice : profiles.bob, i % 2 ? profiles.bob : profiles.alice, `m${i}`);
  const first = await site.query(
    "messages:conversation",
    { profile_id: profiles.alice, other_profile_id: profiles.bob, limit: 2 },
    alice,
  );
  assert.deepEqual(first.messages.map((m) => m.content), ["m4", "m5"]);
  assert.equal(first.pagination.has_more, true);
  assert.equal(first.pagination.total_count, 5);
  const second = await site.query(
    "messages:conversation",
    { profile_id: profiles.alice, other_profile_id: profiles.bob, limit: 2, cursor: first.pagination.next_cursor },
    alice,
  );
  assert.deepEqual(second.messages.map((m) => m.content), ["m2", "m3"]);
  const last = await site.query(
    "messages:conversation",
    { profile_id: profiles.alice, other_profile_id: profiles.bob, limit: 2, cursor: second.pagination.next_cursor },
    alice,
  );
  assert.deepEqual(last.messages.map((m) => m.content), ["m1"]);
  assert.equal(last.pagination.has_more, false);
});

test("reactions group by emoji and can be taken back", async () => {
  const { site, profiles } = await setup();
  const sent = await dm(site, alice, profiles.alice, profiles.bob, "반응해줘");
  const react = (who, profileId, emoji) =>
    site.mutate("messages:addReaction", { profile_id: profileId, message_id: sent.id, emoji }, who);
  await react(bob, profiles.bob, "❤️");
  await react(alice, profiles.alice, "❤️");
  await react(bob, profiles.bob, "😂");
  assert.equal(await refusal(react(bob, profiles.bob, "❤️")), "already_reacted");
  let [message] = (
    await site.query("messages:conversation", { profile_id: profiles.alice, other_profile_id: profiles.bob }, alice)
  ).messages;
  assert.deepEqual(
    message.reactions.map((r) => [r.emoji, r.count, r.profiles.map((p) => p.username)]),
    [
      ["❤️", 2, ["bob", "alice"]],
      ["😂", 1, ["bob"]],
    ],
  );
  await site.mutate("messages:removeReaction", { profile_id: profiles.bob, message_id: sent.id, emoji: "😂" }, bob);
  assert.equal(
    await refusal(
      site.mutate("messages:removeReaction", { profile_id: profiles.bob, message_id: sent.id, emoji: "😂" }, bob),
    ),
    "not_found",
  );
  [message] = (
    await site.query("messages:conversation", { profile_id: profiles.alice, other_profile_id: profiles.bob }, alice)
  ).messages;
  assert.deepEqual(message.reactions.map((r) => r.emoji), ["❤️"]);
});

test("deleting for me hides a message from me alone; for all within two minutes", async () => {
  const { site, profiles } = await setup();
  const first = await dm(site, alice, profiles.alice, profiles.bob, "하나");
  const second = await dm(site, alice, profiles.alice, profiles.bob, "둘");
  const remove = (who, profileId, message, mode) =>
    site.mutate("messages:remove", { profile_id: profileId, message_id: message.id, mode }, who);
  const contents = async (who, profileId, otherId) =>
    (await site.query("messages:conversation", { profile_id: profileId, other_profile_id: otherId }, who)).messages.map(
      (m) => m.content,
    );

  await remove(bob, profiles.bob, first, "for_me");
  assert.deepEqual(await contents(bob, profiles.bob, profiles.alice), ["둘"]);
  assert.deepEqual(await contents(alice, profiles.alice, profiles.bob), ["하나", "둘"]);
  // Hidden messages are not unread, nor in the conversation list's count.
  assert.deepEqual(await site.query("messages:unreadCount", { profile_id: profiles.bob }, bob), { count: 1 });

  assert.equal(await refusal(remove(bob, profiles.bob, second, "for_all")), "not_sender");
  site.now += 3 * 60 * 1000;
  assert.equal(await refusal(remove(alice, profiles.alice, second, "for_all")), "delete_window_passed");
  const third = await dm(site, alice, profiles.alice, profiles.bob, "셋");
  await remove(alice, profiles.alice, third, "for_all");
  assert.deepEqual(await contents(bob, profiles.bob, profiles.alice), ["둘"]);
  assert.equal(await refusal(remove(alice, profiles.alice, third, "for_me")), "not_found");
});

async function groupOf(site, profiles) {
  return site.mutate(
    "groupChats:create",
    { name: "우리 방", creator_profile_id: profiles.alice, member_profile_ids: [profiles.bob, profiles.carol] },
    alice,
  );
}

test("a group chat is made of three or more and only its members read it", async () => {
  const { site, profiles } = await setup();
  assert.equal(
    await refusal(
      site.mutate("groupChats:create", { name: "둘", creator_profile_id: profiles.alice, member_profile_ids: [profiles.bob] }, alice),
    ),
    "too_few_members",
  );
  const chat = await groupOf(site, profiles);
  assert.equal(chat.member_count, 3);
  assert.equal(chat.unread_count, 0);

  const dave = addProfile(site, "m-owner", "dave", { primary: false });
  const owner = as("m-owner");
  const args = { group_chat_id: chat.id, profile_id: dave };
  assert.equal(await refusal(site.query("groupChats:get", args, owner)), "not_group_member");
  assert.equal(await refusal(site.query("groupChats:messages", args, owner)), "not_group_member");
  assert.equal(await refusal(site.mutate("groupChats:send", { ...args, content: "끼어들기" }, owner)), "not_group_member");

  const details = await site.query("groupChats:get", { group_chat_id: chat.id, profile_id: profiles.bob }, bob);
  assert.equal(details.created_by_id, profiles.alice);
  assert.deepEqual(details.members.map((m) => m.username).sort(), ["alice", "bob", "carol"]);

  const renamed = await site.mutate("groupChats:update", { group_chat_id: chat.id, profile_id: profiles.carol, name: "새 이름" }, carol);
  assert.deepEqual(renamed, { id: chat.id, name: "새 이름" });
});

test("group messages: images, pushes, reactions, deletion, read state", async () => {
  const { site, profiles } = await setup();
  const chat = await groupOf(site, profiles);
  const send = (who, profileId, content, extra = {}) => {
    site.now += 1000;
    return site.mutate("groupChats:send", { group_chat_id: chat.id, profile_id: profileId, content, ...extra }, who);
  };
  const upload = await image(site, "m-bob");
  site.notifications.length = 0;
  const hello = await send(bob, profiles.bob, "", { image_ids: [upload] });
  assert.deepEqual(hello.images.map((i) => i.id), [upload]);
  assert.deepEqual(site.notifications, [
    {
      members: ["m-alice", "m-carol"],
      title: "BOB - 우리 방",
      body: "사진을 보냈습니다",
      path: `/group-chats/${chat.id}`,
    },
  ]);
  await send(carol, profiles.carol, "안녕");
  await send(alice, profiles.alice, "반가워");

  const listFor = async (who, profileId) => site.query("groupChats:list", { profile_id: profileId }, who);
  let [entry] = await listFor(alice, profiles.alice);
  assert.equal(entry.unread_count, 2);
  assert.equal(entry.last_message.content, "반가워");
  assert.equal(entry.last_message.is_sender, true);
  assert.equal(entry.member_count, 3);

  await site.mutate("groupChats:markRead", { group_chat_id: chat.id, profile_id: profiles.alice }, alice);
  [entry] = await listFor(alice, profiles.alice);
  assert.equal(entry.unread_count, 0);
  [entry] = await listFor(bob, profiles.bob);
  assert.equal(entry.unread_count, 2);

  // Reactions.
  const reactArgs = { group_chat_id: chat.id, message_id: hello.id, profile_id: profiles.alice, emoji: "👍" };
  await site.mutate("groupChats:addReaction", reactArgs, alice);
  assert.equal(await refusal(site.mutate("groupChats:addReaction", reactArgs, alice)), "already_reacted");
  let page = await site.query("groupChats:messages", { group_chat_id: chat.id, profile_id: profiles.carol }, carol);
  assert.deepEqual(page.messages.map((m) => m.content), ["", "안녕", "반가워"]);
  assert.deepEqual(page.messages[0].reactions, [
    {
      emoji: "👍",
      count: 1,
      profiles: [{ id: profiles.alice, name: "ALICE", username: "alice", profile_picture_url: null }],
    },
  ]);
  await site.mutate("groupChats:removeReaction", reactArgs, alice);

  // Deleting for me, and for all.
  await site.mutate(
    "groupChats:remove",
    { group_chat_id: chat.id, message_id: hello.id, profile_id: profiles.carol, mode: "for_me" },
    carol,
  );
  page = await site.query("groupChats:messages", { group_chat_id: chat.id, profile_id: profiles.carol }, carol);
  assert.deepEqual(page.messages.map((m) => m.content), ["안녕", "반가워"]);
  page = await site.query("groupChats:messages", { group_chat_id: chat.id, profile_id: profiles.bob, limit: 2 }, bob);
  assert.deepEqual(page.messages.map((m) => m.content), ["안녕", "반가워"]);
  assert.equal(page.pagination.has_more, true);
  const older = await site.query(
    "groupChats:messages",
    { group_chat_id: chat.id, profile_id: profiles.bob, limit: 2, cursor: page.pagination.next_cursor },
    bob,
  );
  assert.deepEqual(older.messages.map((m) => m.content), [""]);

  const last = await send(alice, profiles.alice, "실수");
  assert.equal(
    await refusal(
      site.mutate("groupChats:remove", { group_chat_id: chat.id, message_id: last.id, profile_id: profiles.bob, mode: "for_all" }, bob),
    ),
    "not_sender",
  );
  await site.mutate(
    "groupChats:remove",
    { group_chat_id: chat.id, message_id: last.id, profile_id: profiles.alice, mode: "for_all" },
    alice,
  );
  [entry] = await listFor(bob, profiles.bob);
  assert.equal(entry.last_message.content, "반가워");
});

test("group members are added, removed by the creator, and leave", async () => {
  const { site, profiles } = await setup();
  const chat = await groupOf(site, profiles);
  const dave = addProfile(site, "m-owner", "dave", { primary: false });
  const owner = as("m-owner");

  const added = await site.mutate(
    "groupChats:addMembers",
    { group_chat_id: chat.id, profile_id: profiles.bob, member_profile_ids: [dave] },
    bob,
  );
  assert.equal(added.member_count, 4);
  assert.equal((await site.query("groupChats:list", { profile_id: dave }, owner)).length, 1);

  assert.equal(
    await refusal(
      site.mutate("groupChats:removeMember", { group_chat_id: chat.id, profile_id: profiles.bob, member_profile_id: dave }, bob),
    ),
    "not_group_creator",
  );
  const removed = await site.mutate(
    "groupChats:removeMember",
    { group_chat_id: chat.id, profile_id: profiles.alice, member_profile_id: dave },
    alice,
  );
  assert.equal(removed.member_count, 3);
  assert.equal(await refusal(site.query("groupChats:get", { group_chat_id: chat.id, profile_id: dave }, owner)), "not_group_member");

  await site.mutate("groupChats:leave", { group_chat_id: chat.id, profile_id: profiles.carol }, carol);
  assert.deepEqual(await site.query("groupChats:list", { profile_id: profiles.carol }, carol), []);
  await site.mutate("groupChats:leave", { group_chat_id: chat.id, profile_id: profiles.bob }, bob);
  await site.mutate("groupChats:leave", { group_chat_id: chat.id, profile_id: profiles.alice }, alice);
  assert.equal(site.rows("SELECT deleted_at FROM group_chats WHERE id = ?", chat.id)[0].deleted_at, site.now);
});
