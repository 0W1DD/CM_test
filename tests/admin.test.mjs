import assert from "node:assert/strict";
import test from "node:test";
import { addProfile, as, community, OWNER_SITE, refusal, uuid, VISITOR } from "./helpers.mjs";
import { testSite } from "./sql-ctx.mjs";

test("the site owner sets up with every setting, sees the owner and claims with a profile", async () => {
  const site = await testSite();
  assert.equal(await refusal(site.query("community:ownerStatus", null, as("m-1"))), "not_site_owner");
  assert.deepEqual(await site.query("community:ownerStatus", null, OWNER_SITE), {
    is_set_up: false,
    owner_member: null,
  });
  assert.equal(
    await refusal(
      site.mutate(
        "owner:setup",
        { name: "커뮤", starts_at: new Date(site.now).toISOString(), ends_at: new Date(site.now - 1).toISOString() },
        OWNER_SITE,
      ),
    ),
    "invalid",
  );
  const settings = await site.mutate(
    "owner:setup",
    {
      name: "커뮤",
      ends_at: new Date(site.now + 1e9).toISOString(),
      is_recruiting: true,
      minimum_birth_year: 2005,
      auto_approve: true,
    },
    OWNER_SITE,
  );
  assert.equal(settings.is_recruiting, true);
  assert.equal(settings.minimum_birth_year, 2005);
  assert.equal(settings.auto_approve, true);
  const claimed = await site.mutate(
    "owner:claim",
    { member: "m-owner", profile_name: "운영자", profile_username: "Admin" },
    OWNER_SITE,
  );
  assert.ok(claimed.profile_id);
  const session = await site.query("me:session", null, as("m-owner"));
  assert.equal(session.role, "owner");
  assert.deepEqual(session.profiles.map((p) => p.username), ["admin"]);
  assert.equal((await site.query("community:ownerStatus", null, OWNER_SITE)).owner_member, "m-owner");
  // Claiming again keeps the profile.
  const again = await site.mutate(
    "owner:claim",
    { member: "m-owner", profile_name: "운영자", profile_username: "other" },
    OWNER_SITE,
  );
  assert.equal(again.profile_id, claimed.profile_id);
});

test("the owner updates settings; others cannot", async () => {
  const { site } = await community();
  assert.equal(await refusal(site.mutate("community:update", { name: "x" }, as("m-alice"))), "not_owner");
  assert.equal(await refusal(site.query("community:settings", null, as("m-alice"))), "not_owner");
  const updated = await site.mutate(
    "community:update",
    { name: "새 이름", description: "소개", show_all_replies: true, bump_on_reply: true },
    as("m-owner"),
  );
  assert.equal(updated.name, "새 이름");
  assert.equal(updated.show_all_replies, true);
  assert.equal((await site.query("me:instance", null, VISITOR)).description, "소개");
  for (const bad of [
    { recruiting_starts_at: new Date(site.now).toISOString() },
    {
      recruiting_starts_at: new Date(site.now).toISOString(),
      recruiting_ends_at: new Date(site.now - 1).toISOString(),
    },
    { minimum_birth_year: 1800 },
    { theme_key_color: "red" },
    { banner_image_id: "nope" },
  ])
    assert.ok(await refusal(site.mutate("community:update", bad, as("m-owner"))));

  site.upload({ member: "m-owner", name: "banner.png", type: "image/png" });
  const [{ id: uploadId }] = site.rows("SELECT id FROM _naru_uploads");
  const image = await site.mutate("images:register", { upload_id: uploadId, width: 1200, height: 400 }, as("m-owner"));
  const withBanner = await site.mutate("community:update", { banner_image_id: image.id }, as("m-owner"));
  assert.equal(withBanner.banner_image_url, image.url);
  const stats = await site.query("analytics:stats", null, as("m-owner"));
  assert.equal(stats.community.banner_image_width, 1200);

  assert.deepEqual(
    await site.mutate("community:setTheme", { theme_key_color: "#AABBCC" }, as("m-owner")),
    { theme_key_color: "#aabbcc" },
  );
  assert.equal((await site.query("me:instance", null, VISITOR)).theme_key_color, "#aabbcc");
  await site.mutate("community:setTheme", { theme_key_color: null }, as("m-owner"));
  assert.equal((await site.query("me:instance", null, VISITOR)).theme_key_color, null);
});

test("the owner keeps the links anyone reads", async () => {
  const { site } = await community();
  assert.equal(
    await refusal(site.mutate("community:createLink", { title: "a", url: "https://a.example" }, as("m-alice"))),
    "not_owner",
  );
  assert.equal(
    await refusal(site.mutate("community:createLink", { title: "a", url: "javascript:alert(1)" }, as("m-owner"))),
    "invalid_url",
  );
  const link = await site.mutate("community:createLink", { title: "위키", url: "https://wiki.example" }, as("m-owner"));
  await site.mutate(
    "community:updateLink",
    { link_id: link.id, title: "위키2", url: "https://wiki.example/2" },
    as("m-owner"),
  );
  assert.deepEqual(
    (await site.query("community:links", null, VISITOR)).map((l) => [l.title, l.url]),
    [["위키2", "https://wiki.example/2"]],
  );
  await site.mutate("community:deleteLink", { link_id: link.id }, as("m-owner"));
  assert.deepEqual(await site.query("community:links", null, VISITOR), []);
  assert.equal(await refusal(site.mutate("community:deleteLink", { link_id: link.id }, as("m-owner"))), "not_found");
});

test("staff list members with their profiles", async () => {
  const { site, profiles } = await community({ members: ["alice", "bob", "carol"] });
  addProfile(site, "m-alice", "alice_alt", { primary: false });
  assert.equal(await refusal(site.query("members:list", null, as("m-alice"))), "not_moderator");
  const all = await site.query("members:list", null, as("m-owner"));
  assert.equal(all.length, 4);
  const alice = all.find((m) => m.id === "m-alice");
  assert.deepEqual(alice.profiles.map((p) => [p.username, p.primary]), [
    ["alice", true],
    ["alice_alt", false],
  ]);
  assert.equal(alice.user_group, "m-alice");
  assert.equal(all.find((m) => m.id === "m-owner").is_current_user, true);
  assert.deepEqual(
    (await site.query("members:list", { q: "CAR" }, as("m-owner"))).map((m) => m.id),
    ["m-carol"],
  );
  assert.deepEqual(
    (await site.query("members:list", { role: "owner" }, as("m-owner"))).map((m) => m.profiles[0].id),
    [profiles.owner],
  );
  assert.equal((await site.query("members:list", { limit: 2 }, as("m-owner"))).length, 2);
  assert.deepEqual(await site.query("members:stats", null, as("m-owner")), {
    owner: 1,
    moderator: 0,
    member: 3,
  });
});

test("the owner changes roles; a demoted moderator loses shared profiles", async () => {
  const { site, profiles } = await community();
  assert.equal(
    await refusal(site.mutate("members:setRole", { membership_id: "m-bob", role: "moderator" }, as("m-alice"))),
    "not_owner",
  );
  await site.mutate("members:setRole", { membership_id: "m-alice", role: "moderator" }, as("m-owner"));
  assert.equal((await site.query("me:session", null, as("m-alice"))).role, "moderator");
  site.run(
    "INSERT INTO profile_owners (profile_id, member, role, created_at, created_by) VALUES (?, 'm-alice', 'admin', 0, 'm-owner')",
    profiles.owner,
  );
  await site.mutate("members:setRole", { membership_id: "m-alice", role: "member" }, as("m-owner"));
  assert.deepEqual(site.rows("SELECT profile_id FROM profile_owners WHERE member = 'm-alice' AND role = 'admin'"), []);
  assert.equal(
    await refusal(site.mutate("members:setRole", { membership_id: "m-owner", role: "member" }, as("m-owner"))),
    "target_owner",
  );
  assert.equal(
    await refusal(site.mutate("members:setRole", { membership_id: "m-nobody", role: "member" }, as("m-owner"))),
    "not_found",
  );
  const transfer = await site.mutate("members:setRole", { membership_id: "m-bob", role: "owner" }, as("m-owner"));
  assert.equal(transfer.ownership_transferred, true);
  assert.equal((await site.query("me:session", null, as("m-owner"))).role, "moderator");
  assert.equal((await site.query("me:session", null, as("m-bob"))).role, "owner");
});

test("a removed or leaving member's profiles are deactivated", async () => {
  const { site, profiles } = await community();
  assert.equal(
    await refusal(site.mutate("members:remove", { membership_id: "m-owner" }, as("m-owner"))),
    "target_owner",
  );
  await site.mutate("members:remove", { membership_id: "m-alice" }, as("m-owner"));
  const session = await site.query("me:session", null, as("m-alice"));
  assert.equal(session.is_member, false);
  assert.equal(site.rows("SELECT activated_at FROM profiles WHERE id = ?", profiles.alice)[0].activated_at, null);
  assert.equal(await refusal(site.query("members:stats", null, as("m-alice"))), "not_member");

  assert.equal(await refusal(site.mutate("members:leave", null, as("m-owner"))), "owner_cannot_leave");
  await site.mutate("members:leave", null, as("m-bob"));
  assert.equal((await site.query("me:session", null, as("m-bob"))).is_member, false);
});

test("staff mute and unmute profiles, logged", async () => {
  const { site, profiles } = await community();
  assert.equal(
    await refusal(site.mutate("moderation:mute", { profile_id: profiles.bob }, as("m-alice"))),
    "not_moderator",
  );
  site.run("UPDATE members SET role = 'moderator' WHERE member = 'm-alice'");
  assert.equal(
    await refusal(site.mutate("moderation:mute", { profile_id: profiles.alice }, as("m-alice"))),
    "self",
  );
  await site.mutate("moderation:mute", { profile_id: profiles.bob }, as("m-alice"));
  assert.equal(
    await refusal(site.mutate("moderation:mute", { profile_id: profiles.bob }, as("m-owner"))),
    "already_muted",
  );
  const [bob] = (await site.query("members:list", null, as("m-owner"))).find((m) => m.id === "m-bob").profiles;
  assert.ok(bob.muted_at);
  await site.mutate("moderation:unmute", { profile_id: profiles.bob }, as("m-owner"));
  assert.equal(
    await refusal(site.mutate("moderation:unmute", { profile_id: profiles.bob }, as("m-owner"))),
    "not_muted",
  );
  const log = await site.query("moderation:log", null, as("m-alice"));
  assert.deepEqual(
    log.map((e) => [e.action, e.moderator.username, e.target_profile.username]),
    [
      ["unmute_profile", "owner", "bob"],
      ["mute_profile", "alice", "bob"],
    ],
  );
  assert.equal(log[1].description, "@bob의 프로필을 음소거했습니다");
});

test("analytics count applications, members and activity", async () => {
  const { site, profiles } = await community();
  const post = (author, at) =>
    site.run(
      "INSERT INTO posts (id, content, author_id, created_by, created_at, updated_at) VALUES (?, 'x', ?, 'm', ?, ?)",
      uuid(),
      author,
      at,
      at,
    );
  post(profiles.alice, site.now - 3600000);
  post(profiles.alice, site.now - 2 * 86400000);
  post(profiles.bob, site.now - 40 * 86400000);
  site.run(
    "INSERT INTO direct_messages (id, content, sender_id, receiver_id, created_by, created_at, updated_at) VALUES (?, 'hi', ?, ?, 'm-bob', ?, ?)",
    uuid(),
    profiles.bob,
    profiles.alice,
    site.now - 60000,
    site.now - 60000,
  );
  assert.equal(await refusal(site.query("analytics:activity", null, as("m-alice"))), "not_moderator");
  const activity = await site.query("analytics:activity", { days: 30 }, as("m-owner"));
  assert.deepEqual(activity.totals, { posts: 2, directMessages: 1, groupMessages: 0 });
  assert.equal(activity.timeline.posts.reduce((n, d) => n + d.count, 0), 2);
  assert.match(activity.timeline.posts[0].date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(activity.hourlyTimeline.directMessages.length, 1);
  assert.deepEqual(
    activity.mostActiveProfiles.map((p) => [p.profile_username, p.posts_count, p.dms_count]),
    [
      ["alice", 2, 0],
      ["bob", 0, 1],
    ],
  );
  // 2026-10-16T02:00Z is 11:00 on a Friday in Korea.
  assert.deepEqual(
    activity.heatmap.posts.find((h) => h.count === 1 && h.hour === 11),
    { hour: 11, dayOfWeek: 5, count: 1 },
  );
  const stats = await site.query("analytics:stats", null, as("m-owner"));
  assert.deepEqual(stats.members, { total: 3 });
  assert.equal(stats.applications.total, 0);
});

test("staff read post reports with the post's author", async () => {
  const { site, profiles } = await community();
  const postId = uuid();
  site.run(
    "INSERT INTO posts (id, content, author_id, created_by, created_at, updated_at) VALUES (?, '나쁜 글', ?, 'm-bob', ?, ?)",
    postId,
    profiles.bob,
    site.now,
    site.now,
  );
  site.run(
    "INSERT INTO post_reports (id, post_id, reporter_profile_id, reporter_member, reason, created_at) VALUES (?, ?, ?, 'm-alice', '스팸', ?)",
    uuid(),
    postId,
    profiles.alice,
    site.now,
  );
  assert.equal(await refusal(site.query("moderation:reports", null, as("m-alice"))), "not_moderator");
  const [report] = await site.query("moderation:reports", null, as("m-owner"));
  assert.equal(report.reason, "스팸");
  assert.equal(report.reporter.username, "alice");
  assert.equal(report.post.author.username, "bob");
  assert.equal(report.post.content, "나쁜 글");
});

test("the site owner's look: 사용자 CSS and the _owner/ switch, in every page's head", async () => {
  // Before the community is set up, a page is index.html as it is.
  const empty = await testSite();
  assert.deepEqual(await empty.route("/"), { file: "index.html" });

  const { site } = await community();
  assert.equal(
    await refusal(site.mutate("community:setLook", { custom_css: "a {}" }, as("m-alice"))),
    "not_owner",
  );
  for (const bad of [{ custom_css: 1 }, { owner_files: "yes" }, { custom_css: "a".repeat(50001) }])
    assert.ok(await refusal(site.mutate("community:setLook", bad, as("m-owner"))));

  const css = "a { color: red; } /* </style><script>x()</script> */";
  assert.deepEqual(
    await site.mutate("community:setLook", { custom_css: css, owner_files: true }, as("m-owner")),
    { custom_css: css, owner_files: true },
  );
  await site.mutate("community:setTheme", { theme_key_color: "#6b7fb8" }, as("m-owner"));
  const instance = await site.query("me:instance", null, VISITOR);
  assert.equal(instance.custom_css, css);
  assert.equal(instance.owner_files, true);
  // The settings form leaves the look as it is.
  await site.mutate("community:update", { name: "새 이름" }, as("m-owner"));
  assert.equal((await site.query("me:instance", null, VISITOR)).custom_css, css);

  const { buildThemeCss } = await import("../dist/_naru/modules/theme.js");
  for (const path of ["/", "/home", "/@someone"]) {
    const { file, head } = await site.route(path);
    assert.equal(file, "index.html");
    // The theme as the page makes it, then the owner's file, then 사용자 CSS,
    // whose "</" cannot end its element.
    assert.equal(
      head,
      [
        `<style id="community-theme">${buildThemeCss("#6b7fb8").replace(/<\//g, "<\\/")}</style>`,
        '<link rel="stylesheet" id="owner-file" href="/_owner/style.css" />',
        `<style id="community-owner-css">${css.replace(/<\//g, "<\\/")}</style>`,
      ].join("\n"),
    );
    assert.doesNotMatch(head, /<\/style><script>/);
  }

  // The files themselves are the site's, not the app's page.
  for (const path of ["/_owner/style.css", "/_owner/script.js"])
    assert.equal(await site.route(path), null, path);

  // Cleared: the theme alone. Left out, a field keeps its value.
  await site.mutate("community:setLook", { custom_css: "" }, as("m-owner"));
  assert.match((await site.route("/")).head, /owner-file/);
  await site.mutate("community:setLook", { owner_files: false }, as("m-owner"));
  assert.equal(
    (await site.route("/")).head,
    `<style id="community-theme">${buildThemeCss("#6b7fb8")}</style>`,
  );
});

test("0009 keeps a community's settings, and checks a colour without GLOB", async () => {
  // A community's row as it was before 0009, written as 0001 to 0008 made
  // the table (today's code writes the columns that come after).
  const site = await testSite({ pending: "0009" });
  site.run(
    `INSERT INTO settings (id, name, description, starts_at, ends_at, is_recruiting,
       theme_key_color, banner_image_id, created_at, updated_at)
     VALUES (1, '커뮤', '소개', 1, 2, 1, '#aabbcc', 'b-1', 3, 4)`,
  );
  const [before] = site.rows("SELECT * FROM settings");
  site.migrate();
  const [after] = site.rows("SELECT * FROM settings");
  assert.deepEqual(after, {
    ...before,
    custom_css: null,
    owner_files: 0,
    gate_html: null,
    gate_image_id: null,
  });
  // The same colours as 0001's pattern, without one (Naru's SQLite refuses
  // a GLOB pattern that long).
  for (const ok of ["#AABBCC", "#012def", null])
    site.run("UPDATE settings SET theme_key_color = ? WHERE id = 1", ok);
  for (const bad of ["#12345g", "aabbcc", "#abc", "#aabbccd", "#aabbc "])
    assert.throws(() => site.run("UPDATE settings SET theme_key_color = ? WHERE id = 1", bad), bad);
});

test("the front gate: the owner's HTML and picture, for visitors who are not members yet", async () => {
  const { site } = await community();
  site.upload({ member: "m-owner", name: "gate.png", type: "image/png" });
  const [{ id: uploadId }] = site.rows("SELECT id FROM _naru_uploads");
  const image = await site.mutate("images:register", { upload_id: uploadId, width: 800, height: 600 }, as("m-owner"));
  const html = '<h2>어서 오세요</h2><p style="color: red">소개</p><img src=x onerror="alert(1)">';
  assert.equal(
    await refusal(site.mutate("community:update", { gate_html: html }, as("m-alice"))),
    "not_owner",
  );
  for (const bad of [{ gate_html: "a".repeat(20001) }, { gate_image_id: "nope" }, { gate_html: 1 }])
    assert.ok(await refusal(site.mutate("community:update", bad, as("m-owner"))));

  const saved = await site.mutate(
    "community:update",
    { gate_html: html, gate_image_id: image.id },
    as("m-owner"),
  );
  assert.equal(saved.gate_html, html);
  assert.equal(saved.gate_image_id, image.id);
  assert.equal(saved.gate_image_url, image.url);
  // A visitor reads it as stored: the page sanitizes it as it shows it
  // (app/components/front-gate.tsx).
  const instance = await site.query("me:instance", null, VISITOR);
  assert.equal(instance.gate_html, html);
  assert.equal(instance.gate_image_url, image.url);
  // Another save leaves it unless it names it; empty clears it.
  await site.mutate("community:update", { name: "새 이름" }, as("m-owner"));
  assert.equal((await site.query("me:instance", null, VISITOR)).gate_html, html);
  await site.mutate("community:update", { gate_html: "", gate_image_id: null }, as("m-owner"));
  const cleared = await site.query("me:instance", null, VISITOR);
  assert.equal(cleared.gate_html, null);
  assert.equal(cleared.gate_image_url, null);
});
