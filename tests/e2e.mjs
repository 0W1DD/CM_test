// The built site (dist/) on a local Naru: naru-dev runs the real edge Worker
// (the site's tables, queries, mutations, live queries and limits) and serves
// the real SDK; Chromium drives the real pages. Not part of `pnpm test`.
//
//   pnpm build
//   NARU_DEV=~/Git/naru-pub/naru-dev PLAYWRIGHT_MODULE=…/playwright/index.mjs \
//     node tests/e2e.mjs
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const { startNaru } = await import(
  process.env.NARU_DEV
    ? join(process.env.NARU_DEV, "dist/testing.mjs")
    : "@naru-pub/dev/testing"
);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const SITE = "commung";
const naru = await startNaru({
  site: fileURLToPath(new URL("../dist/", import.meta.url)),
  name: SITE,
  quiet: true,
});
const browser = await chromium.launch();
const errors = [];

/** Calls the site's code over HTTP as `headers`' caller. */
async function call(kind, name, args, headers = {}) {
  const response = await fetch(naru.url(`/api/data/v1/${SITE}/_${kind}/${name}`), {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ args }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${name}: ${JSON.stringify(body)}`);
  return body.result ?? body.data ?? body;
}

/** A browser of its own for `who`, signed in as that member. */
async function person(who) {
  const context = await browser.newContext();
  if (who) await naru.signIn(context, who);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${who}: ${error.message}`));
  return page;
}

try {
  const day = 86400000;
  const now = Date.now();
  const owner = await naru.signIn(null, "owner");
  await call("mutate", "owner:setup", {
    name: "커뮹!",
    description: "테스트 커뮤입니다",
    starts_at: new Date(now - day).toISOString(),
    ends_at: new Date(now + 30 * day).toISOString(),
    is_recruiting: true,
    recruiting_starts_at: new Date(now - day).toISOString(),
    recruiting_ends_at: new Date(now + 7 * day).toISOString(),
  }, owner.headers);
  const boss = await naru.signIn(null, "boss");
  const { profile_id: bossProfile } = await call("mutate", "owner:claim", {
    member: boss.memberId,
    profile_name: "운영자",
    profile_username: "boss",
  }, owner.headers);
  console.log("ok the owner opened the community and claimed it");

  const alice = await naru.signIn(null, "alice");
  const application = await call("mutate", "applications:apply", {
    profile_name: "앨리스",
    profile_username: "alice",
    message: "가입하고 싶어요",
  }, alice.headers);
  await call("mutate", "applications:review", {
    application_id: application.id,
    status: "approved",
  }, boss.headers);
  const session = await call("query", "me:session", null, alice.headers);
  assert.equal(session.is_member, true);
  const aliceProfile = session.profiles[0].id;
  console.log("ok alice applied and the owner approved her");

  await call("mutate", "posts:create", {
    profile_id: aliceProfile,
    content: "안녕하세요 @boss 첫 글입니다 #인사",
  }, alice.headers);
  console.log("ok alice posted over the API");

  const coin = await call("mutate", "posts:create", { profile_id: aliceProfile, content: "/coin" }, alice.headers);
  const replies = await call("query", "posts:replies", { post_id: coin.id, profile_id: aliceProfile }, alice.headers);
  assert.match(JSON.stringify(replies), /🪙 (앞면|뒷면)/);
  assert.match(JSON.stringify(replies), /"username":"bot"/);
  console.log("ok /coin is answered by the community's bot");
  const dice = await call("mutate", "posts:create", { profile_id: aliceProfile, content: "/roll 1000d6" }, alice.headers);
  const rolled = await call("query", "posts:replies", { post_id: dice.id, profile_id: aliceProfile }, alice.headers);
  assert.match(JSON.stringify(rolled), /🎲 1000d6/);
  console.log("ok a thousand dice fit in one call");

  // A bot program, subscribed with its token, hears a mention as it is
  // written, and answers it.
  const weather = await call("mutate", "bots:adminCreate", {
    name: "날씨", profile_name: "날씨봇", profile_username: "weather",
  }, boss.headers);
  const { token } = await call("mutate", "bots:adminCreateToken", { bot_id: weather.id }, boss.headers);
  const botPage = await person(null);
  await botPage.goto(naru.url("/"));
  await botPage.evaluate(async (token) => {
    const { createNaru } = await import("https://sdk.naru.pub/sdk/1.1.0/naru.js");
    const naru = createNaru();
    window.heard = [];
    await new Promise((ready) => {
      naru.subscribe("bot:mentions", { token }, async ({ data }) => {
        ready();
        for (const post of data) {
          if (window.heard.includes(post.id)) continue;
          window.heard.push(post.id);
          await naru.mutate("bot:createPost", { token, content: "맑음 ☀️", in_reply_to_id: post.id });
        }
      });
    });
  }, token);
  const asked = await call("mutate", "posts:create", { profile_id: aliceProfile, content: "@weather 서울은?" }, alice.headers);
  await botPage.waitForFunction((id) => window.heard.includes(id), asked.id, { timeout: 15000 });
  for (let tries = 0; ; tries++) {
    const answers = await call("query", "posts:replies", { post_id: asked.id, profile_id: aliceProfile }, alice.headers);
    if (JSON.stringify(answers).includes("맑음")) break;
    if (tries > 50) throw new Error("The bot did not answer.");
    await new Promise((done) => setTimeout(done, 200));
  }
  console.log("ok a subscribed bot hears a mention and answers it");

  // Pages: a visitor, alice and the owner each load theirs.
  const visitor = await person(null);
  await visitor.goto(naru.url("/"));
  await visitor.getByText("로그인하기").first().waitFor();
  console.log("ok a visitor is asked to sign in, as on commung");

  const alicePage = await person("alice");
  await alicePage.goto(naru.url("/"));
  await alicePage.getByText("첫 글입니다").first().waitFor({ timeout: 15000 });
  console.log("ok alice sees her post on the timeline");
  // Through the page's composer, as members post: no content warning, which
  // the composer sends as undefined.
  await alicePage.getByPlaceholder("무슨 일이 일어나고 있나요?").fill("화면에서 쓴 글");
  await alicePage.getByRole("button", { name: "게시", exact: true }).click();
  await alicePage.getByText("메시지가 성공적으로 게시되었습니다!").waitFor({ timeout: 15000 });
  await alicePage.getByText("화면에서 쓴 글").first().waitFor({ timeout: 15000 });
  console.log("ok alice posts from the composer");
  for (const path of ["/notifications", "/messages", "/boards", "/shop", "/profiles", "/search", "/settings/profile", "/@alice"]) {
    await alicePage.goto(naru.url(path));
    await alicePage.waitForLoadState("networkidle");
  }
  console.log("ok alice's pages load");

  const bossPage = await person("boss");
  await bossPage.goto(naru.url("/notifications"));
  await bossPage.getByText("앨리스").first().waitFor({ timeout: 15000 });
  console.log("ok the owner was notified of the mention");
  // Opening the tab marks them read.
  const unread = () =>
    call("query", "notifications:unreadCount", { profile_id: bossProfile }, boss.headers).then((r) => r.count);
  for (let tries = 0; (await unread()) !== 0; tries++) {
    if (tries > 50) throw new Error("Opening notifications did not mark them read.");
    await new Promise((done) => setTimeout(done, 200));
  }
  console.log("ok opening notifications marks them read");
  for (const path of ["/admin", "/admin/applications", "/admin/members", "/admin/settings", "/admin/analytics", "/admin/boards", "/admin/shop", "/admin/bots"]) {
    await bossPage.goto(naru.url(path));
    await bossPage.waitForLoadState("networkidle");
  }
  console.log("ok the owner's admin pages load");

  assert.deepEqual(errors, []);
  console.log("ok no page errors");
} finally {
  await browser.close();
  await naru.stop();
}
