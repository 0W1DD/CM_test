import assert from "node:assert/strict";
import test from "node:test";
import { addProfile, as, community, refusal, VISITOR } from "./helpers.mjs";

const write = (site, member, profile_id, content, extra = {}) =>
  site.mutate("posts:create", { profile_id, content, ...extra }, as(member));

test("browsing visitors and non-members can read threads but cannot participate", async () => {
  const { site, profiles } = await community();
  const post = await write(site, "m-alice", profiles.alice, "둘러보기 글");
  const reply = await write(site, "m-bob", profiles.bob, "답글", { in_reply_to_id: post.id });
  const args = { post_id: post.id, profile_id: profiles.bob, emoji: "👍" };
  await site.mutate("posts:react", args, as("m-bob"));
  await site.mutate("posts:bookmark", args, as("m-bob"));

  for (const [caller, reason] of [[VISITOR, "signed_out"], [as("m-stranger"), "not_member"]]) {
    const timeline = await site.query("posts:list", { profile_id: profiles.bob }, caller);
    assert.equal(timeline.data[0].id, post.id);
    assert.equal(timeline.data[0].is_bookmarked, false);
    const detail = await site.query("posts:get", args, caller);
    assert.equal(detail.content, "둘러보기 글");
    assert.equal(detail.reactions.length, 1);
    const replies = await site.query("posts:replies", { post_id: post.id }, caller);
    assert.equal(replies.data[0].id, reply.id);

    for (const name of ["react", "unreact", "bookmark", "unbookmark", "pin", "unpin", "remove", "update", "report"]) {
      assert.equal(await refusal(site.mutate(`posts:${name}`, { ...args, content: "변경", reason: "신고" }, caller)), reason, name);
    }
    assert.equal(await refusal(site.mutate("posts:create", { profile_id: profiles.bob, content: "답글 시도", in_reply_to_id: post.id }, caller)), reason);
    assert.equal(await refusal(site.query("posts:bookmarks", args, caller)), reason);
  }
  const unchanged = await site.query("posts:get", args, as("m-bob"));
  assert.equal(unchanged.content, "둘러보기 글");
  assert.equal(unchanged.reactions.length, 1);
  assert.equal(unchanged.is_bookmarked, true);
});

test("members write posts; visitors and non-members cannot", async () => {
  const { site, profiles } = await community();
  assert.equal(
    await refusal(write(site, "m-stranger", profiles.alice, "hi")),
    "not_member",
  );
  assert.equal(
    await refusal(site.mutate("posts:create", { profile_id: profiles.alice, content: "x" }, VISITOR)),
    "signed_out",
  );
  // bob cannot act as alice's profile
  assert.equal(await refusal(write(site, "m-bob", profiles.alice, "hi")), "not_found");
  assert.equal(await refusal(write(site, "m-alice", profiles.alice, "  ")), "empty_post");
  const post = await write(site, "m-alice", profiles.alice, "안녕하세요", {
    content_warning: "스포",
  });
  assert.equal(post.content, "안녕하세요");
  assert.equal(post.content_warning, "스포");
  assert.equal(post.author.username, "alice");
  assert.equal(post.depth, 0);
  assert.deepEqual(post.replies, []);
  assert.match(post.created_at, /^2026-10-16T03:00:00/);
});

test("a muted profile cannot post", async () => {
  const { site, profiles } = await community();
  site.run("UPDATE profiles SET muted_at = ? WHERE id = ?", site.now, profiles.alice);
  assert.equal(await refusal(write(site, "m-alice", profiles.alice, "hi")), "muted");
});

test("the timeline shows root posts with threaded replies, and anyone may read it", async () => {
  const { site, profiles } = await community();
  const root = await write(site, "m-alice", profiles.alice, "root");
  const reply = await write(site, "m-bob", profiles.bob, "reply", { in_reply_to_id: root.id });
  assert.equal(reply.depth, 1);
  assert.equal(reply.root_post_id, root.id);
  site.now += 1000;
  const nested = await write(site, "m-alice", profiles.alice, "nested", { in_reply_to_id: reply.id });
  assert.equal(nested.depth, 2);
  assert.equal(nested.root_post_id, root.id);
  const timeline = await site.query("posts:list", { profile_id: profiles.alice }, VISITOR);
  assert.equal(timeline.data.length, 1);
  assert.equal(timeline.pagination.total_count, 1);
  const [first] = timeline.data;
  assert.equal(first.reply_count, 2);
  assert.equal(first.replies[0].id, reply.id);
  assert.equal(first.replies[0].replies[0].id, nested.id);
  // Detail: replies and parent thread.
  const detail = await site.query("posts:get", { post_id: nested.id });
  assert.deepEqual(detail.parent_thread.map((p) => p.id), [root.id, reply.id]);
  const replies = await site.query("posts:replies", { post_id: root.id, limit: 1 });
  assert.equal(replies.data[0].id, reply.id);
  assert.equal(replies.pagination.has_more, true);
  const next = await site.query("posts:replies", { post_id: root.id, cursor: replies.pagination.next_cursor });
  assert.deepEqual(next.data.map((p) => p.id), [nested.id]);
});

test("the timeline shows five replies unless show_all_replies, and pages by cursor", async () => {
  const { site, profiles } = await community();
  const root = await write(site, "m-alice", profiles.alice, "root");
  for (let i = 0; i < 7; i++) {
    site.now += 1;
    await write(site, "m-bob", profiles.bob, `r${i}`, { in_reply_to_id: root.id });
  }
  let [post] = (await site.query("posts:list", {})).data;
  assert.equal(post.replies.length, 5);
  assert.equal(post.reply_count, 7);
  assert.equal(post.has_more_replies, true);
  site.run("UPDATE settings SET show_all_replies = 1");
  [post] = (await site.query("posts:list", {})).data;
  assert.equal(post.replies.length, 7);
  assert.equal(post.has_more_replies, false);

  for (let i = 0; i < 3; i++) {
    site.now += 1;
    await write(site, "m-alice", profiles.alice, `p${i}`);
  }
  const first = await site.query("posts:list", { limit: 2 });
  assert.deepEqual(first.data.map((p) => p.content), ["p2", "p1"]);
  const second = await site.query("posts:list", { limit: 2, cursor: first.pagination.next_cursor });
  assert.deepEqual(second.data.map((p) => p.content), ["p0", "root"]);
  assert.equal(second.pagination.has_more, false);
});

test("bump_on_reply puts each reply on the timeline with what it answers", async () => {
  const { site, profiles } = await community();
  site.run("UPDATE settings SET bump_on_reply = 1");
  const old = await write(site, "m-alice", profiles.alice, "old");
  site.now += 1000;
  await write(site, "m-alice", profiles.alice, "new");
  site.now += 1000;
  await write(site, "m-bob", profiles.bob, "bump", { in_reply_to_id: old.id });
  // The reply itself comes first, not the old post it answers.
  const timeline = await site.query("posts:list", { limit: 2 });
  assert.deepEqual(timeline.data.map((p) => p.content), ["bump", "new"]);
  assert.equal(timeline.data[0].parent_summary.id, old.id);
  assert.equal(timeline.data[0].parent_summary.content_excerpt, "old");
  assert.equal(timeline.data[1].parent_summary, null);
  const rest = await site.query("posts:list", { limit: 2, cursor: timeline.pagination.next_cursor });
  assert.deepEqual(rest.data.map((p) => p.content), ["old"]);
  // Without the setting, replies stay under their post.
  site.run("UPDATE settings SET bump_on_reply = 0");
  const plain = await site.query("posts:list", { limit: 5 });
  assert.deepEqual(plain.data.map((p) => p.content), ["new", "old"]);
});

test("replies and mentions notify, in rows and in the Naru app, but never yourself", async () => {
  const { site, profiles } = await community({ members: ["alice", "bob", "carol"] });
  const root = await write(site, "m-alice", profiles.alice, "hello @bob");
  assert.deepEqual(site.notifications, [
    {
      members: ["m-bob"],
      title: "ALICE님이 회원님을 언급했습니다",
      body: "hello @bob",
      path: `/@alice/${root.id}`,
    },
  ]);
  site.notifications.length = 0;
  // A reply mentioning the parent's author and carol: alice gets one reply
  // notification only; carol a mention; bob (the writer) nothing.
  const reply = await write(site, "m-bob", profiles.bob, "@alice @carol @bob 봐요", {
    in_reply_to_id: root.id,
  });
  const rows = site.rows(
    "SELECT type, recipient_id, title, message FROM notifications WHERE post_id = ? ORDER BY type",
    reply.id,
  );
  assert.deepEqual(
    rows.map((r) => [r.type, r.recipient_id]),
    [
      ["mention", profiles.carol],
      ["reply", profiles.alice],
    ],
  );
  assert.equal(rows[1].message, "BOB님이 답글을 작성했습니다");
  assert.deepEqual(
    site.notifications.map((n) => [n.title, n.members]),
    [
      ["새로운 답글", ["m-alice"]],
      ["BOB님이 회원님을 언급했습니다", ["m-carol"]],
    ],
  );
  assert.equal(site.rows("SELECT count(*) AS n FROM mentions WHERE post_id = ?", reply.id)[0].n, 2);
});

test("only staff schedule posts; scheduled posts stay hidden until due, then publish", async () => {
  const { site, profiles } = await community();
  const at = new Date(site.now + 3600000).toISOString();
  assert.equal(
    await refusal(write(site, "m-alice", profiles.alice, "later", { scheduled_at: at })),
    "not_moderator",
  );
  assert.equal(
    await refusal(write(site, "m-owner", profiles.owner, "past", { scheduled_at: new Date(site.now - 1).toISOString() })),
    "scheduled_in_past",
  );
  const post = await write(site, "m-owner", profiles.owner, "later @alice", { scheduled_at: at });
  assert.equal(site.notifications.length, 0);
  assert.equal((await site.query("posts:list", {})).data.length, 0);
  assert.equal(await refusal(site.query("posts:get", { post_id: post.id })), "not_found");
  const scheduled = await site.query("posts:scheduled", { profile_id: profiles.owner }, as("m-owner"));
  assert.equal(scheduled.data[0].id, post.id);
  assert.equal(scheduled.data[0].scheduled_at, at);
  assert.equal(await refusal(site.query("posts:scheduled", { profile_id: profiles.owner }, as("m-alice"))), "not_found");

  site.now += 3600000;
  // Due: visible to readers before any mutation marks it.
  assert.equal((await site.query("posts:list", {})).data[0].id, post.id);
  assert.equal((await site.query("posts:scheduled", { profile_id: profiles.owner }, as("m-owner"))).data.length, 0);
  // The next posts mutation publishes it and sends its mentions.
  await write(site, "m-bob", profiles.bob, "something");
  assert.equal(site.rows("SELECT published_at FROM posts WHERE id = ?", post.id)[0].published_at, site.now - 3600000 + 3600000);
  assert.deepEqual(site.notifications.map((n) => n.members), [["m-alice"]]);
});

test("only the owner writes announcements; they are listed", async () => {
  const { site, profiles } = await community();
  assert.equal(
    await refusal(write(site, "m-alice", profiles.alice, "공지", { announcement: true })),
    "not_owner",
  );
  const post = await write(site, "m-owner", profiles.owner, "공지", { announcement: true });
  assert.equal(post.announcement, true);
  const list = await site.query("posts:announcements", {}, VISITOR);
  assert.deepEqual(list.map((p) => p.id), [post.id]);
});

test("images are the writer's own uploads, in order", async () => {
  const { site, profiles } = await community();
  const register = async (member, name) => {
    site.upload({ member, name, type: "image/png" });
    const [{ id }] = site.rows("SELECT id FROM _naru_uploads ORDER BY rowid DESC LIMIT 1");
    return (await site.mutate("images:register", { upload_id: id, width: 4, height: 3 }, as(member))).id;
  };
  const a = await register("m-alice", "a.png");
  const b = await register("m-alice", "b.png");
  const theirs = await register("m-bob", "c.png");
  assert.equal(
    await refusal(write(site, "m-alice", profiles.alice, "", { image_ids: [theirs] })),
    "invalid_image",
  );
  const post = await write(site, "m-alice", profiles.alice, "", { image_ids: [b, a] });
  assert.deepEqual(post.images.map((i) => i.filename), ["b.png", "a.png"]);
});

test("editing keeps history, only by the author; search follows the edit", async () => {
  const { site, profiles } = await community();
  const post = await write(site, "m-alice", profiles.alice, "첫번째 내용 #태그");
  assert.equal(
    await refusal(site.mutate("posts:update", { post_id: post.id, profile_id: profiles.bob, content: "x" }, as("m-bob"))),
    "not_author",
  );
  const search = (q) => site.query("posts:search", { q }, as("m-bob"));
  assert.equal((await search("첫번째")).data.length, 1);
  assert.equal((await search("#태그")).data.length, 1);
  site.now += 1000;
  const updated = await site.mutate(
    "posts:update",
    { post_id: post.id, profile_id: profiles.alice, content: "고친 내용" },
    as("m-alice"),
  );
  assert.equal(updated.content, "고친 내용");
  assert.equal((await search("첫번째")).data.length, 0);
  assert.equal((await search("고친 내")).data.length, 1);
  assert.equal((await search("고친")).data.length, 1); // two characters: LIKE
  assert.equal((await search("#태그")).data.length, 0);
  // One profile's posts, with or without words, and only replies or posts.
  assert.equal((await search("@alice 고친")).data.length, 1);
  assert.equal((await search("@bob 고친")).data.length, 0);
  assert.equal((await search("@alice")).data.length, 1);
  const kind = (k) => site.query("posts:search", { q: "고친", kind: k }, as("m-bob"));
  assert.equal((await kind("posts")).data.length, 1);
  assert.equal((await kind("replies")).data.length, 0);
  const history = await site.query("posts:history", { post_id: post.id });
  assert.equal(history.length, 1);
  assert.equal(history[0].content, "첫번째 내용 #태그");
  assert.equal(history[0].edited_by.username, "alice");
  assert.equal(await refusal(site.query("posts:search", { q: "고친" }, VISITOR)), "signed_out");
  assert.deepEqual(await site.query("search:hashtags", { q: "태" }), []);
});

test("hashtags are suggested by prefix and listed by use, from posts still up", async () => {
  const { site, profiles } = await community();
  await write(site, "m-alice", profiles.alice, "#바다 #바다탐사");
  await write(site, "m-bob", profiles.bob, "#바다 #등대");
  const gone = await write(site, "m-bob", profiles.bob, "#바닷물");
  await site.mutate("posts:remove", { post_id: gone.id, profile_id: profiles.bob }, as("m-bob"));
  const tags = async (name, args) => (await site.query(name, args)).map((t) => [t.tag, t.count]);
  assert.deepEqual(await tags("search:hashtags", { q: "#바" }), [["바다", 2], ["바다탐사", 1]]);
  assert.deepEqual(await tags("search:popularHashtags", {}), [["바다", 2], ["등대", 1], ["바다탐사", 1]]);
});

test("the owner clears the timeline before a day, threads whole, announcements kept", async () => {
  const { site, profiles } = await community();
  const old = await write(site, "m-alice", profiles.alice, "오래된 글 #정리");
  const notice = await write(site, "m-owner", profiles.owner, "오래된 공지", { announcement: true });
  site.now += 86400000;
  const cut = new Date(site.now).toISOString();
  site.now += 1000;
  const lateReply = await write(site, "m-bob", profiles.bob, "나중 답글", { in_reply_to_id: old.id });
  const fresh = await write(site, "m-bob", profiles.bob, "새 글");
  const count = (args) => site.query("posts:purgeCount", args, as("m-owner"));

  assert.equal(await refusal(site.query("posts:purgeCount", { before: cut }, as("m-alice"))), "not_owner");
  assert.equal(
    await refusal(site.mutate("posts:adminPurge", { before: cut, profile_id: profiles.alice }, as("m-alice"))),
    "not_owner",
  );
  // The old post and the reply under it, written later; the announcement stays unless asked.
  assert.deepEqual(await count({ before: cut }), { count: 2 });
  assert.deepEqual(await count({ before: cut, keep_announcements: false }), { count: 3 });
  const done = await site.mutate("posts:adminPurge", { before: cut, profile_id: profiles.owner }, as("m-owner"));
  assert.equal(done.deleted, 2);
  const left = await site.query("posts:list", {}, as("m-bob"));
  assert.deepEqual(left.data.map((p) => p.id).sort(), [fresh.id, notice.id].sort());
  assert.equal((await site.query("posts:search", { q: "#정리" }, as("m-bob"))).data.length, 0);
  assert.equal(site.rows("SELECT deleted_at FROM posts WHERE id = ?", lateReply.id)[0].deleted_at !== null, true);
  assert.deepEqual(await count({ before: cut }), { count: 0 });
});

test("authors delete their posts; moderators delete others' and it is logged", async () => {
  const { site, profiles } = await community({ members: ["alice", "bob", "mod"] });
  site.run("UPDATE members SET role = 'moderator' WHERE member = 'm-mod'");
  const post = await write(site, "m-alice", profiles.alice, "삭제될 글");
  assert.equal(
    await refusal(site.mutate("posts:remove", { post_id: post.id, profile_id: profiles.bob }, as("m-bob"))),
    "not_allowed",
  );
  const removed = await site.mutate("posts:remove", { post_id: post.id, profile_id: profiles.mod }, as("m-mod"));
  assert.deepEqual(removed, { id: post.id, deleted: true });
  const [log] = site.rows("SELECT * FROM moderation_log");
  assert.equal(log.action, "delete_post");
  assert.equal(log.moderator, profiles.mod);
  assert.equal(log.target_post_id, post.id);
  assert.equal(log.description, '@alice의 게시물을 삭제했습니다: "삭제될 글"');
  assert.equal(site.rows("SELECT count(*) AS n FROM posts_search")[0].n, 0);
  const own = await write(site, "m-bob", profiles.bob, "mine");
  await site.mutate("posts:remove", { post_id: own.id, profile_id: profiles.bob }, as("m-bob"));
  assert.equal(site.rows("SELECT count(*) AS n FROM moderation_log")[0].n, 1);
});

test("reactions notify the author once; bookmarks list with the viewer", async () => {
  const { site, profiles } = await community();
  const post = await write(site, "m-alice", profiles.alice, "글");
  site.notifications.length = 0;
  const react = { post_id: post.id, profile_id: profiles.bob, emoji: "👍" };
  const result = await site.mutate("posts:react", react, as("m-bob"));
  assert.equal(result.emoji, "👍");
  assert.equal(await refusal(site.mutate("posts:react", react, as("m-bob"))), "already_reacted");
  assert.deepEqual(site.notifications, [
    {
      members: ["m-alice"],
      title: "새로운 반응",
      body: "BOB님이 게시물에 👍 반응을 남겼습니다",
      path: `/@alice/${post.id}`,
    },
  ]);
  let [shown] = (await site.query("posts:list", {})).data;
  assert.deepEqual(shown.reactions, [
    { emoji: "👍", user: { id: profiles.bob, username: "bob", name: "BOB" } },
  ]);
  await site.mutate("posts:unreact", react, as("m-bob"));
  assert.equal(await refusal(site.mutate("posts:unreact", react, as("m-bob"))), "not_found");

  const mark = { post_id: post.id, profile_id: profiles.bob };
  await site.mutate("posts:bookmark", mark, as("m-bob"));
  assert.equal(await refusal(site.mutate("posts:bookmark", mark, as("m-bob"))), "already_bookmarked");
  [shown] = (await site.query("posts:list", { profile_id: profiles.bob }, as("m-bob"))).data;
  assert.equal(shown.is_bookmarked, true);
  // Naming someone else's profile shows no bookmarks.
  [shown] = (await site.query("posts:list", { profile_id: profiles.bob }, as("m-alice"))).data;
  assert.equal(shown.is_bookmarked, false);
  const marks = await site.query("posts:bookmarks", { profile_id: profiles.bob }, as("m-bob"));
  assert.equal(marks.data[0].id, post.id);
  assert.equal(marks.data[0].is_bookmarked, true);
  await site.mutate("posts:unbookmark", mark, as("m-bob"));
  assert.equal((await site.query("posts:bookmarks", { profile_id: profiles.bob }, as("m-bob"))).data.length, 0);
});

test("reactions are refused once the community has ended", async () => {
  const { site, profiles } = await community();
  const post = await write(site, "m-alice", profiles.alice, "글");
  site.now += 40 * 86400000;
  assert.equal(
    await refusal(site.mutate("posts:react", { post_id: post.id, profile_id: profiles.bob, emoji: "👍" }, as("m-bob"))),
    "community_ended",
  );
  assert.equal(await refusal(write(site, "m-alice", profiles.alice, "늦음")), "community_ended");
});

test("a profile's page lists pinned posts first, at most three pinned", async () => {
  const { site, profiles } = await community();
  const posts = [];
  for (let i = 0; i < 5; i++) {
    site.now += 1;
    posts.push(await write(site, "m-alice", profiles.alice, `p${i}`));
  }
  const pin = (post, member = "m-alice", profile_id = profiles.alice) =>
    site.mutate("posts:pin", { post_id: post.id, profile_id }, as(member));
  assert.equal(await refusal(pin(posts[0], "m-bob", profiles.bob)), "not_author");
  await pin(posts[0]);
  await pin(posts[1]);
  await pin(posts[2]);
  assert.equal(await refusal(pin(posts[3])), "too_many_pinned");
  assert.equal(await refusal(pin(posts[0])), "already_pinned");
  await site.mutate("posts:unpin", { post_id: posts[2].id, profile_id: profiles.alice }, as("m-alice"));

  // A millisecond later: posts in one millisecond are ordered by their random ID bits.
  site.now += 1;
  const reply = await write(site, "m-alice", profiles.alice, "a reply", { in_reply_to_id: posts[4].id });
  const pages = [];
  let cursor;
  do {
    const page = await site.query("posts:byProfile", { username: "@alice", limit: 2, cursor });
    pages.push(...page.data);
    cursor = page.pagination.next_cursor;
    if (!page.pagination.has_more) break;
  } while (cursor);
  assert.deepEqual(
    pages.map((p) => p.content),
    ["p1", "p0", "a reply", "p4", "p3", "p2"],
  );
  const replyShown = pages.find((p) => p.id === reply.id);
  assert.equal(replyShown.parent_summary.content_excerpt, "p4");
  const only = async (kind) =>
    (await site.query("posts:byProfile", { username: "alice", kind })).data.map((p) => p.content);
  assert.deepEqual(await only("posts"), ["p1", "p0", "p4", "p3", "p2"]);
  assert.deepEqual(await only("replies"), ["a reply"]);
  assert.equal(await refusal(site.query("posts:byProfile", { username: "nobody" })), "not_found");
});

test("reports are kept and sent to the staff", async () => {
  const { site, profiles } = await community();
  const post = await write(site, "m-alice", profiles.alice, "신고할 글");
  site.notifications.length = 0;
  const result = await site.mutate(
    "posts:report",
    { post_id: post.id, profile_id: profiles.bob, reason: "스팸" },
    as("m-bob"),
  );
  assert.deepEqual(result, { success: true });
  assert.equal(site.rows("SELECT reason FROM post_reports")[0].reason, "스팸");
  assert.deepEqual(site.notifications.map((n) => n.members), [["m-owner"]]);
});

test("a shared profile's other owner hears of replies to it", async () => {
  const { site, profiles } = await community();
  site.run(
    "INSERT INTO profile_owners (profile_id, member, role, created_at, created_by) VALUES (?, 'm-bob', 'admin', ?, 'm-alice')",
    profiles.alice,
    site.now,
  );
  addProfile(site, "m-bob", "bobby", { primary: false });
  const post = await write(site, "m-alice", profiles.alice, "shared");
  site.notifications.length = 0;
  await write(site, "m-bob", profiles.bob, "reply", { in_reply_to_id: post.id });
  // bob wrote it, so only alice is notified though bob also owns the profile.
  assert.deepEqual(site.notifications.map((n) => n.members), [["m-alice"]]);
});
