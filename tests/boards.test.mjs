import assert from "node:assert/strict";
import test from "node:test";
import { as, community, refusal, VISITOR } from "./helpers.mjs";

async function withBoard(options) {
  const c = await community(options);
  const board = await c.site.mutate(
    "boards:adminCreate",
    { name: "자유게시판", slug: "free", description: "아무 이야기" },
    as("m-owner"),
  );
  return { ...c, board };
}

test("only the owner manages boards; staff list them; slugs are unique", async () => {
  const { site, board } = await withBoard();
  assert.equal(board.allow_comments, true);
  assert.equal(
    await refusal(site.mutate("boards:adminCreate", { name: "x", slug: "x" }, as("m-alice"))),
    "not_owner",
  );
  assert.equal(await refusal(site.query("boards:adminList", null, as("m-alice"))), "not_moderator");
  site.run("UPDATE members SET role = 'moderator' WHERE member = 'm-alice'");
  assert.equal((await site.query("boards:adminList", null, as("m-alice"))).length, 1);
  assert.equal(
    await refusal(site.mutate("boards:adminCreate", { name: "중복", slug: "free" }, as("m-owner"))),
    "duplicate_board_slug",
  );
  assert.equal(
    await refusal(site.mutate("boards:adminCreate", { name: "x", slug: "Bad Slug" }, as("m-owner"))),
    "invalid",
  );
  const updated = await site.mutate(
    "boards:adminUpdate",
    { board_id: board.id, name: "공지", slug: "notice", allow_comments: false },
    as("m-owner"),
  );
  assert.equal(updated.slug, "notice");
  assert.equal(updated.allow_comments, false);
  await site.mutate("boards:adminDelete", { board_id: board.id }, as("m-owner"));
  assert.deepEqual(await site.query("boards:list", null, as("m-alice")), []);
  // A deleted board's slug is free again.
  await site.mutate("boards:adminCreate", { name: "새", slug: "notice" }, as("m-owner"));
});

test("members read boards; visitors and non-members do not", async () => {
  const { site } = await withBoard();
  assert.equal(await refusal(site.query("boards:list", null, VISITOR)), "signed_out");
  assert.equal(await refusal(site.query("boards:list", null, as("m-stranger"))), "not_member");
  const boards = await site.query("boards:list", null, as("m-alice"));
  assert.deepEqual(boards.map((b) => b.slug), ["free"]);
  assert.equal((await site.query("boards:board", { slug: "free" }, as("m-bob"))).name, "자유게시판");
  assert.equal(await refusal(site.query("boards:board", { slug: "nope" }, as("m-bob"))), "board_not_found");
});

test("posts page newest first, and only their author edits or deletes them", async () => {
  const { site, profiles } = await withBoard();
  const ids = [];
  for (let i = 0; i < 3; i++) {
    site.now += 1;
    const post = await site.mutate(
      "boards:createPost",
      { slug: "free", profile_id: profiles.alice, title: `글 ${i}`, content: `내용 ${i}` },
      as("m-alice"),
    );
    ids.push(post.id);
    assert.equal(post.board.slug, "free");
    assert.equal(post.author.username, "alice");
  }
  assert.equal(
    await refusal(
      site.mutate("boards:createPost", { slug: "free", profile_id: profiles.alice, title: "", content: "x" }, as("m-alice")),
    ),
    "invalid",
  );
  // Another member's profile is not theirs to act as.
  assert.equal(
    await refusal(
      site.mutate("boards:createPost", { slug: "free", profile_id: profiles.alice, title: "x", content: "x" }, as("m-bob")),
    ),
    "not_found",
  );
  const first = await site.query("boards:posts", { slug: "free", profile_id: profiles.bob, limit: 2 }, as("m-bob"));
  assert.deepEqual(first.data.map((p) => p.title), ["글 2", "글 1"]);
  assert.equal(first.pagination.has_more, true);
  assert.equal(first.pagination.total_count, 3);
  const second = await site.query(
    "boards:posts",
    { slug: "free", profile_id: profiles.bob, limit: 2, cursor: first.pagination.next_cursor },
    as("m-bob"),
  );
  assert.deepEqual(second.data.map((p) => p.title), ["글 0"]);
  assert.equal(second.pagination.has_more, false);

  assert.equal(
    await refusal(
      site.mutate("boards:updatePost", { post_id: ids[0], profile_id: profiles.bob, title: "x", content: "y" }, as("m-bob")),
    ),
    "not_post_author",
  );
  const edited = await site.mutate(
    "boards:updatePost",
    { post_id: ids[0], profile_id: profiles.alice, title: "고친 글", content: "고친 내용" },
    as("m-alice"),
  );
  assert.equal(edited.title, "고친 글");
  assert.equal(
    await refusal(site.mutate("boards:deletePost", { post_id: ids[0], profile_id: profiles.bob }, as("m-bob"))),
    "not_post_author",
  );
  await site.mutate("boards:deletePost", { post_id: ids[0], profile_id: profiles.alice }, as("m-alice"));
  assert.equal(await refusal(site.query("boards:post", { post_id: ids[0] }, as("m-bob"))), "post_not_found");
});

test("a post's image must be the author's own upload", async () => {
  const { site, profiles } = await withBoard();
  site.upload({ member: "m-alice", name: "a.png", type: "image/png" });
  const [{ id: imageId }] = site.rows("SELECT id FROM _naru_uploads");
  await site.mutate("images:register", { upload_id: imageId, width: 10, height: 10 }, as("m-alice"));
  const args = { slug: "free", title: "그림", content: "그림 글", image_id: imageId };
  assert.equal(
    await refusal(site.mutate("boards:createPost", { ...args, profile_id: profiles.bob }, as("m-bob"))),
    "invalid_image",
  );
  const post = await site.mutate("boards:createPost", { ...args, profile_id: profiles.alice }, as("m-alice"));
  assert.equal(post.image.id, imageId);
  assert.equal(post.image.filename, "a.png");
});

test("replies nest by depth, notify the post's and the reply's authors, and delete with their replies", async () => {
  const { site, profiles } = await withBoard();
  const post = await site.mutate(
    "boards:createPost",
    { slug: "free", profile_id: profiles.alice, title: "질문", content: "있나요?" },
    as("m-alice"),
  );
  const reply = (profile, member, content, inReplyTo) =>
    site.mutate(
      "boards:createReply",
      { post_id: post.id, profile_id: profile, content, in_reply_to_id: inReplyTo },
      as(member),
    );
  site.now += 1;
  const top = await reply(profiles.bob, "m-bob", "댓글");
  assert.equal(top.depth, 0);
  site.now += 1;
  const child = await reply(profiles.alice, "m-alice", "답글", top.id);
  assert.equal(child.depth, 1);
  site.now += 1;
  const grandchild = await reply(profiles.bob, "m-bob", "답답글", child.id);
  assert.equal(grandchild.depth, 2);
  // Alice's own reply on her post told nobody but Bob (of her reply to him).
  const notified = site.rows("SELECT recipient, title FROM board_notifications ORDER BY id");
  assert.deepEqual(notified, [
    { recipient: "m-alice", title: "새로운 댓글" },
    { recipient: "m-bob", title: "새로운 답글" },
    { recipient: "m-alice", title: "새로운 답글" },
  ]);
  assert.equal(site.notifications[0].path, `/boards/free/${post.id}`);
  const feed = await site.query("boards:notifications", null, as("m-alice"));
  assert.equal(feed.total_unread, 2);
  assert.equal(feed.data[0].link, `/boards/free/${post.id}`);
  await site.mutate("boards:markNotificationRead", {}, as("m-alice"));
  assert.equal((await site.query("boards:notifications", null, as("m-alice"))).total_unread, 0);

  const tree = await site.query("boards:replies", { post_id: post.id, profile_id: profiles.bob }, as("m-bob"));
  assert.equal(tree.pagination.total_count, 1);
  assert.equal(tree.data[0].replies[0].replies[0].content, "답답글");

  assert.equal(
    await refusal(site.mutate("boards:deleteReply", { reply_id: child.id, profile_id: profiles.bob }, as("m-bob"))),
    "not_reply_author",
  );
  await site.mutate("boards:deleteReply", { reply_id: child.id, profile_id: profiles.alice }, as("m-alice"));
  const after = await site.query("boards:replies", { post_id: post.id }, as("m-bob"));
  assert.deepEqual(after.data[0].replies, []);
  assert.equal(site.rows("SELECT count(*) AS n FROM board_replies WHERE deleted_at IS NULL")[0].n, 1);

  // A reply to another post's reply is refused.
  const other = await site.mutate(
    "boards:createPost",
    { slug: "free", profile_id: profiles.bob, title: "다른 글", content: "다른" },
    as("m-bob"),
  );
  assert.equal(
    await refusal(
      site.mutate(
        "boards:createReply",
        { post_id: other.id, profile_id: profiles.bob, content: "x", in_reply_to_id: top.id },
        as("m-bob"),
      ),
    ),
    "invalid",
  );
});

test("a board without comments refuses replies", async () => {
  const { site, profiles, board } = await withBoard();
  await site.mutate(
    "boards:adminUpdate",
    { board_id: board.id, name: board.name, slug: board.slug, allow_comments: false },
    as("m-owner"),
  );
  const post = await site.mutate(
    "boards:createPost",
    { slug: "free", profile_id: profiles.alice, title: "t", content: "c" },
    as("m-alice"),
  );
  assert.equal(
    await refusal(site.mutate("boards:createReply", { post_id: post.id, profile_id: profiles.bob, content: "x" }, as("m-bob"))),
    "comments_disabled",
  );
  assert.equal(await refusal(site.query("boards:replies", { post_id: post.id }, as("m-bob"))), "comments_disabled");
});
