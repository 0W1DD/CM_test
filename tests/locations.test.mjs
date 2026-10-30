import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { as, community, refusal } from "./helpers.mjs";

test("migration assigns existing posts and replies to the fireplace without changing content", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE posts (id TEXT, content TEXT, in_reply_to_id TEXT)");
    db.exec("INSERT INTO posts VALUES ('old', '기존 글', NULL), ('reply', '기존 답글', 'old')");
    db.exec(await readFile(new URL("../naru/migrations/0013_post_locations.sql", import.meta.url), "utf8"));
    const rows = db.prepare("SELECT * FROM posts ORDER BY id").all();
    assert.deepEqual(rows.map(r => [r.content, r.location]), [["기존 글", "fireplace"], ["기존 답글", "fireplace"]]);
    assert.equal(rows[1].in_reply_to_id, "old");
    assert.throws(() => db.exec("UPDATE posts SET location = 'invalid'"));
  } finally { db.close(); }
});

test("rooms persist in the unfiltered timeline and replies inherit or change rooms", async () => {
  const { site, profiles } = await community();
  const write = (content, extra = {}) => {
    site.now += 1000;
    return site.mutate("posts:create", { profile_id: profiles.alice, content, ...extra }, as("m-alice"));
  };
  const root = await write("기본 장소");
  assert.equal(root.location, "fireplace");
  const rooms = ["fireplace", "kitchen", "library", "yard", "attic"];
  for (const location of rooms) {
    site.now += 1000;
    const post = await write(location, { location });
    assert.equal(post.location, location);
    const reply = await write("따라가기", { in_reply_to_id: post.id });
    assert.equal(reply.location, location);
    const moved = await write("다른 방으로", { in_reply_to_id: reply.id, location: "yard" });
    assert.equal(moved.location, "yard");
    assert.equal((await site.query("posts:get", { post_id: post.id })).location, location);
    const thread = await site.query("posts:replies", { post_id: post.id });
    assert.deepEqual(thread.data.map(p => p.location), [location, "yard"]);
  }
  const timeline = await site.query("posts:list", { limit: 20 });
  assert.equal(timeline.data.length, 6);
  assert.deepEqual(new Set(timeline.data.map(p => p.location)), new Set(rooms));
  site.run("UPDATE settings SET bump_on_reply = 1");
  const flat = await site.query("posts:list", { limit: 20 });
  assert.equal(flat.data.length, 16);
  assert.equal(flat.data[0].location, "yard");
  assert.ok(flat.data[0].in_reply_to_id);
  assert.ok(flat.data[0].parent_summary);
  for (const location of ["unknown", "", null, 3]) {
    assert.equal(await refusal(write("잘못된 장소", { location })), "invalid_location");
  }
});

test("editing and scheduled publishing preserve a post's chosen room", async () => {
  const { site, profiles } = await community();
  const post = await site.mutate("posts:create", { profile_id: profiles.alice, content: "서재 글", location: "library" }, as("m-alice"));
  const edited = await site.mutate("posts:update", { post_id: post.id, profile_id: profiles.alice, content: "수정 내용", image_ids: [] }, as("m-alice"));
  assert.equal(edited.location, "library");
  const scheduled = await site.mutate("posts:create", { profile_id: profiles.owner, content: "예약 글", location: "attic", scheduled_at: new Date(site.now + 60000).toISOString() }, as("m-owner"));
  assert.equal(scheduled.location, "attic");
  assert.equal((await site.query("posts:list", {})).data.some(p => p.id === scheduled.id), false);
  site.now += 60001;
  assert.equal((await site.query("posts:get", { post_id: scheduled.id })).location, "attic");
});
