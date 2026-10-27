import assert from "node:assert/strict";
import test from "node:test";
import { as, community, refusal, VISITOR } from "./helpers.mjs";

const RECRUITING = { is_recruiting: true };

async function recruiting(options = {}) {
  const c = await community(options);
  await c.site.mutate("community:update", { ...RECRUITING, ...options.settings }, as("m-owner"));
  return c;
}

const form = (username, extra = {}) => ({
  profile_name: username.toUpperCase(),
  profile_username: username,
  message: "안녕하세요",
  ...extra,
});

test("applying needs a signed-in non-member while the community recruits", async () => {
  const { site } = await community();
  assert.equal(await refusal(site.mutate("applications:apply", form("carol"), VISITOR)), "signed_out");
  assert.equal(
    await refusal(site.mutate("applications:apply", form("carol"), as("m-carol"))),
    "not_recruiting",
  );
  await site.mutate(
    "community:update",
    {
      is_recruiting: true,
      recruiting_starts_at: new Date(site.now + 3600000).toISOString(),
      recruiting_ends_at: new Date(site.now + 7200000).toISOString(),
    },
    as("m-owner"),
  );
  assert.equal(
    await refusal(site.mutate("applications:apply", form("carol"), as("m-carol"))),
    "not_recruiting",
  );
  await site.mutate(
    "community:update",
    { recruiting_starts_at: null, recruiting_ends_at: null },
    as("m-owner"),
  );
  assert.equal(
    await refusal(site.mutate("applications:apply", form("alice2"), as("m-alice"))),
    "already_member",
  );
  const application = await site.mutate("applications:apply", form("Carol"), as("m-carol"));
  assert.equal(application.status, "pending");
  assert.equal(application.profile_username, "carol");
  assert.equal(
    await refusal(site.mutate("applications:apply", form("carol_2"), as("m-carol"))),
    "already_pending",
  );
  // The owner and moderators hear of it.
  assert.deepEqual(site.notifications.at(-1).members, ["m-owner"]);
  assert.equal(site.notifications.at(-1).title, "새로운 가입 신청");
});

test("usernames held by profiles or other pending applications are refused", async () => {
  const { site } = await recruiting();
  assert.equal(
    await refusal(site.mutate("applications:apply", form("ALICE"), as("m-carol"))),
    "username_taken",
  );
  await site.mutate("applications:apply", form("dave"), as("m-dave"));
  assert.equal(
    await refusal(site.mutate("applications:apply", form("dave"), as("m-carol"))),
    "username_pending",
  );
  assert.equal(
    await refusal(site.mutate("applications:apply", form("bad name"), as("m-carol"))),
    "invalid",
  );
});

test("the applicant and staff see applications; others do not", async () => {
  const { site } = await recruiting();
  site.upload({ member: "m-carol", name: "me.png", type: "image/png" });
  const [{ id: uploadId }] = site.rows("SELECT id FROM _naru_uploads");
  const image = await site.mutate(
    "images:register",
    { upload_id: uploadId, width: 4, height: 3 },
    as("m-carol"),
  );
  const { id } = await site.mutate(
    "applications:apply",
    form("carol", { attachment_ids: [image.id] }),
    as("m-carol"),
  );
  const [mine] = await site.query("applications:mine", null, as("m-carol"));
  assert.equal(mine.id, id);
  assert.equal(mine.attachments[0].image_url.url, image.url);

  assert.equal(await refusal(site.query("applications:list", null, as("m-alice"))), "not_moderator");
  const [listed] = await site.query("applications:list", null, as("m-owner"));
  assert.equal(listed.profile_username, "carol");
  assert.equal(listed.applicant.profile_id, null);
  assert.equal(listed.attachments.length, 1);

  assert.equal((await site.query("applications:get", { application_id: id }, as("m-carol"))).is_own, true);
  assert.equal(
    await refusal(site.query("applications:get", { application_id: id }, as("m-alice"))),
    "not_moderator",
  );
  const session = await site.query("me:session", null, as("m-carol"));
  assert.equal(session.application.status, "pending");
});

test("the applicant edits and withdraws a pending application", async () => {
  const { site } = await recruiting();
  const { id } = await site.mutate("applications:apply", form("carol"), as("m-carol"));
  assert.equal(
    await refusal(site.mutate("applications:update", { application_id: id, ...form("x") }, as("m-dave"))),
    "not_found",
  );
  const updated = await site.mutate(
    "applications:update",
    { application_id: id, ...form("caroline", { message: null }) },
    as("m-carol"),
  );
  assert.equal(updated.profile_username, "caroline");
  assert.equal(updated.message, null);
  await site.mutate("applications:withdraw", { application_id: id }, as("m-carol"));
  assert.deepEqual(await site.query("applications:mine", null, as("m-carol")), []);
});

test("a moderator approves: a member with a primary profile", async () => {
  const { site } = await recruiting();
  site.run("UPDATE members SET role = 'moderator' WHERE member = 'm-alice'");
  const { id } = await site.mutate("applications:apply", form("carol"), as("m-carol"));
  assert.equal(
    await refusal(site.mutate("applications:review", { application_id: id, status: "approved" }, as("m-bob"))),
    "not_moderator",
  );
  const approved = await site.mutate(
    "applications:review",
    { application_id: id, status: "approved" },
    as("m-alice"),
  );
  assert.equal(approved.status, "approved");
  assert.equal(approved.membership_id, "m-carol");
  const session = await site.query("me:session", null, as("m-carol"));
  assert.equal(session.role, "member");
  assert.deepEqual(
    session.profiles.map((p) => [p.id, p.username, p.is_primary, p.muted_at]),
    [[approved.profile_id, "carol", true, null]],
  );
  assert.deepEqual(site.notifications.at(-1).members, ["m-carol"]);
  assert.equal(
    await refusal(site.mutate("applications:review", { application_id: id, status: "approved" }, as("m-alice"))),
    "not_pending",
  );
  const [listed] = await site.query("applications:list", null, as("m-owner"));
  assert.equal(listed.applicant.profile_id, approved.profile_id);
});

test("new members are muted when the community says so, and logged", async () => {
  const { site, profiles } = await recruiting({ settings: { mute_new_members: true } });
  const { id } = await site.mutate("applications:apply", form("carol"), as("m-carol"));
  const { profile_id } = await site.mutate(
    "applications:review",
    { application_id: id, status: "approved" },
    as("m-owner"),
  );
  const [profile] = site.rows("SELECT muted_at, muted_by_id FROM profiles WHERE id = ?", profile_id);
  assert.equal(profile.muted_at, site.now);
  assert.equal(profile.muted_by_id, profiles.owner);
  const [entry] = site.rows("SELECT action, description, moderator, target_profile_id FROM moderation_log");
  assert.deepEqual(entry, {
    action: "mute_profile",
    description: "신규 가입 시 자동 음소거 (커뮤 설정)",
    moderator: profiles.owner,
    target_profile_id: profile_id,
  });
});

test("a rejected applicant sees why and applies again", async () => {
  const { site } = await recruiting();
  const { id } = await site.mutate("applications:apply", form("carol"), as("m-carol"));
  await site.mutate(
    "applications:review",
    { application_id: id, status: "rejected", rejection_reason: "정원 초과" },
    as("m-owner"),
  );
  const session = await site.query("me:session", null, as("m-carol"));
  assert.equal(session.application.status, "rejected");
  assert.equal(session.application.rejection_reason, "정원 초과");
  const again = await site.mutate("applications:apply", form("carol"), as("m-carol"));
  assert.equal(again.status, "pending");
  assert.equal((await site.query("applications:mine", null, as("m-carol"))).length, 2);
});

test("auto-approval approves at once and tells the staff", async () => {
  const { site } = await recruiting({ settings: { auto_approve: true } });
  const application = await site.mutate("applications:apply", form("carol"), as("m-carol"));
  assert.equal(application.status, "approved");
  assert.equal((await site.query("me:session", null, as("m-carol"))).is_member, true);
  assert.equal(site.notifications.at(-1).title, "새 회원이 자동 승인되었습니다");
  const [row] = site.rows("SELECT reviewed_by FROM applications");
  assert.equal(row.reviewed_by, "m-owner");
});

test("the owner revokes a review; approving again brings the profile back", async () => {
  const { site } = await recruiting();
  const { id } = await site.mutate("applications:apply", form("carol"), as("m-carol"));
  const { profile_id } = await site.mutate(
    "applications:review",
    { application_id: id, status: "approved" },
    as("m-owner"),
  );
  site.run("UPDATE members SET role = 'moderator' WHERE member = 'm-alice'");
  assert.equal(
    await refusal(site.mutate("applications:revoke", { application_id: id }, as("m-alice"))),
    "not_owner",
  );
  await site.mutate("applications:revoke", { application_id: id }, as("m-owner"));
  assert.equal((await site.query("me:session", null, as("m-carol"))).is_member, false);
  assert.equal(
    site.rows("SELECT activated_at FROM profiles WHERE id = ?", profile_id)[0].activated_at,
    null,
  );
  assert.equal(
    await refusal(site.mutate("applications:revoke", { application_id: id }, as("m-owner"))),
    "pending",
  );
  const again = await site.mutate(
    "applications:review",
    { application_id: id, status: "approved" },
    as("m-owner"),
  );
  assert.equal(again.profile_id, profile_id);
  assert.equal((await site.query("me:session", null, as("m-carol"))).profiles[0].id, profile_id);
});
