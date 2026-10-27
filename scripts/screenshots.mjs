// Screenshots of the built site (dist/) for the landing page: a local Naru
// (naru-dev) with a made-up community, written through the site's own
// mutations, and Chromium photographing its pages into landing/screenshots/
// (each light and, as name-dark.jpg, dark),
// and the 커뮹! template's preview on Naru's board into docs/ (1280×960, the
// size of Naru's own previews), which the workflow publishes with the
// template.
//
//   pnpm build
//   NARU_DEV=~/Git/naru-pub/naru-dev PLAYWRIGHT_MODULE=…/playwright/index.mjs \
//     node scripts/screenshots.mjs
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const { startNaru } = await import(
  process.env.NARU_DEV
    ? join(process.env.NARU_DEV, "dist/testing.mjs")
    : "@naru-pub/dev/testing"
);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = fileURLToPath(new URL("../", import.meta.url));
const out = join(root, "landing/screenshots");
await mkdir(out, { recursive: true });

const SITE = "commung";
const naru = await startNaru({ site: join(root, "dist/"), name: SITE, quiet: true });
const browser = await chromium.launch();

async function call(kind, name, args, who) {
  const response = await fetch(naru.url(`/api/data/v1/${SITE}/_${kind}/${name}`), {
    method: "POST",
    headers: { ...who.headers, "content-type": "application/json" },
    body: JSON.stringify({ args }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${name}: ${JSON.stringify(body)}`);
  return body.result ?? body.data ?? body;
}
const mutate = (name, args, who) => call("mutate", name, args, who);

/** Uploads `bytes` to Naru Media as `who` and registers it as an image. */
async function image(who, name, bytes, width, height) {
  const files = naru.url(`/api/data/v1/${SITE}/_files`);
  const headers = { ...who.headers, "content-type": "application/json" };
  const started = await fetch(files, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, contentType: "image/png", size: bytes.length }),
  }).then((r) => r.json());
  const upload = started.result ?? started;
  await fetch(upload.uploadUrl, { method: "PUT", headers: upload.headers, body: bytes });
  await fetch(`${files}/${upload.id}`, { method: "PUT", headers, body: "{}" });
  return mutate("images:register", { upload_id: upload.id, width, height }, who);
}

// Avatars: a soft gradient and the character's first letter, drawn by Chromium.
const painter = await browser.newPage();
async function avatar(letter, from, to) {
  const data = await painter.evaluate(
    ([letter, from, to]) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const g = canvas.getContext("2d");
      const fill = g.createLinearGradient(0, 0, 256, 256);
      fill.addColorStop(0, from);
      fill.addColorStop(1, to);
      g.fillStyle = fill;
      g.fillRect(0, 0, 256, 256);
      g.fillStyle = "rgba(255,255,255,0.92)";
      g.font = "bold 120px 'Apple SD Gothic Neo', sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(letter, 128, 140);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    [letter, from, to],
  );
  return Buffer.from(data, "base64");
}

try {
  const day = 86400000;
  const now = Date.now();
  const owner = await naru.signIn(null, "owner");
  await mutate("owner:setup", {
    name: "별빛 마법학교",
    description: "달이 뜨는 밤에만 열리는 마법학교 커뮤. 입학을 환영해요!",
    starts_at: new Date(now - 3 * day).toISOString(),
    ends_at: new Date(now + 45 * day).toISOString(),
    is_recruiting: true,
    recruiting_starts_at: new Date(now - 3 * day).toISOString(),
    recruiting_ends_at: new Date(now + 10 * day).toISOString(),
  }, owner);

  const boss = await naru.signIn(null, "boss");
  const { profile_id: headmaster } = await mutate("owner:claim", {
    member: boss.memberId,
    profile_name: "교장 엘리너",
    profile_username: "eleanor",
  }, owner);
  const banner = join(root, "design/banner.png");
  if (existsSync(banner)) {
    const { id } = await image(boss, "banner.png", await readFile(banner), 1500, 500);
    await mutate("community:update", { banner_image_id: id }, boss);
  }
  const head = join(root, "design/beaming-head.png");
  const picture = existsSync(head)
    ? await image(boss, "eleanor.png", await readFile(head), 700, 570)
    : await image(boss, "eleanor.png", await avatar("엘", "#b83a34", "#f2a65a"), 256, 256);
  await mutate("profiles:setPicture", { profile_id: headmaster, image_id: picture.id }, boss);

  // Members apply and the headmaster lets them in.
  const cast = [
    ["luna", "루나", "#7b6cf6", "#c6b8ff", "별자리 점성술반. 밤하늘 관측이 취미예요 🌙"],
    ["kai", "카이", "#2f8f83", "#9ee2c8", "비행술반 주장. 빗자루는 늘 반짝반짝."],
    ["sion", "시온", "#d0577b", "#ffc1cf", "약초학반. 온실 열쇠는 제가 갖고 있어요."],
    ["haru", "하루", "#e08a1e", "#ffe08a", "신입생! 잘 부탁드려요 ✨"],
  ];
  const people = {};
  for (const [username, name, from, to, bio] of cast) {
    const who = await naru.signIn(null, username);
    const application = await mutate("applications:apply", {
      profile_name: name,
      profile_username: username,
      message: "입학하고 싶어요!",
    }, who);
    if (username !== "haru")
      await mutate("applications:review", { application_id: application.id, status: "approved" }, boss);
    else {
      people.haru = { who };
      continue;
    }
    const session = await call("query", "me:session", null, who);
    const profile = session.profiles[0].id;
    const { id } = await image(who, `${username}.png`, await avatar(name[0], from, to), 256, 256);
    await mutate("profiles:setPicture", { profile_id: profile, image_id: id }, who);
    await mutate("profiles:update", { profile_id: profile, name, username, bio }, who);
    people[username] = { who, profile };
  }
  const { luna, kai, sion } = people;
  const post = (person, content, extra = {}) =>
    mutate("posts:create", { profile_id: person.profile, content, ...extra }, person.who);
  const react = (person, target, emoji) =>
    mutate("posts:react", { profile_id: person.profile, post_id: target.id, emoji }, person.who);

  const notice = await mutate("posts:create", {
    profile_id: headmaster,
    content: "📜 이번 주 금요일 밤, 대강당에서 별빛 무도회가 열려요. 드레스 코드는 #별빛 입니다. 모두 와 주세요!",
    announcement: true,
  }, boss);
  const roll = await post(kai, "/roll 2d6");
  const garden = await post(sion, "온실에 월광초가 피었어요 🌿 오늘 밤에만 피니까 구경 오세요! #약초학");
  const stars = await post(luna, "오늘 밤 별자리 관측 같이 하실 분? 천문탑 꼭대기에서 기다릴게요 🔭 #점성술 @kai");
  await mutate("posts:create", { profile_id: kai.profile, content: "갈게요! 빗자루 타고 바로 날아갈게요 🧹", in_reply_to_id: stars.id }, kai.who);
  await mutate("posts:create", { profile_id: sion.profile, content: "저도요! 따뜻한 허브차 챙겨 갈게요 🍵", in_reply_to_id: stars.id }, sion.who);
  await react(kai, stars, "❤️");
  await react(sion, stars, "✨");
  await react(luna, garden, "🌿");
  await react(kai, garden, "❤️");
  await react(luna, notice, "🎉");
  await react(sion, notice, "🎉");
  await react(kai, notice, "💃");
  await react(luna, roll, "😂");
  await mutate("posts:bookmark", { profile_id: luna.profile, post_id: garden.id }, luna.who);

  // Boards.
  for (const [slug, name, description] of [
    ["notice", "공지사항", "학교 운영 소식"],
    ["club", "동아리 모집", "함께할 동아리원을 찾아요"],
  ])
    await mutate("boards:adminCreate", { slug, name, description, allow_comments: true }, boss);
  await mutate("boards:createPost", { profile_id: headmaster, slug: "notice", title: "1학기 시간표 안내", content: "월요일 1교시는 변신술, 수요일 밤에는 천문학 실습이 있어요." }, boss);
  await mutate("boards:createPost", { profile_id: headmaster, slug: "notice", title: "기숙사 통금 시간 변경", content: "이번 달부터 통금은 자정까지예요. 달빛 산책은 정원까지만!" }, boss);
  const club = await mutate("boards:createPost", { profile_id: kai.profile, slug: "club", title: "퀴디치 동아리 신입 부원 모집 🧹", content: "빗자루를 처음 타 보는 분도 환영해요. 매주 토요일 오후, 운동장에서 만나요!" }, kai.who);
  await mutate("boards:createPost", { profile_id: luna.profile, slug: "club", title: "천문 관측 동아리 「밤하늘」", content: "망원경은 동아리방에 있어요. 맑은 밤마다 천문탑에서 모여요 🔭" }, luna.who);
  await mutate("boards:createReply", { profile_id: sion.profile, post_id: club.id, content: "저 빗자루 무서운데 괜찮을까요…?" }, sion.who);
  await mutate("boards:createReply", { profile_id: kai.profile, post_id: club.id, content: "물론이죠! 처음엔 낮게만 날아요 😄" }, kai.who);

  // Messages: a direct conversation and a group chat.
  await mutate("messages:send", { profile_id: luna.profile, receiver_id: kai.profile, content: "오늘 관측 끝나고 야식 먹으러 갈래?" }, luna.who);
  await mutate("messages:send", { profile_id: kai.profile, receiver_id: luna.profile, content: "좋아! 식당 할머니가 남겨 둔 호박 파이 있대 🥧" }, kai.who);
  const chat = await mutate("groupChats:create", { creator_profile_id: luna.profile, member_profile_ids: [kai.profile, sion.profile], name: "천문탑 야간반 🌙" }, luna.who);
  const say = (person, content) =>
    mutate("groupChats:send", { profile_id: person.profile, group_chat_id: chat.id, content }, person.who);
  await say(luna, "다들 오늘 밤 10시 천문탑 꼭대기 맞지?");
  await say(kai, "응! 나 망원경 들고 갈게");
  await say(sion, "허브차랑 쿠키 챙겼어 🍪");
  await say(luna, "최고야 ✨ 오늘 유성우 온대!");

  // The shop.
  const currency = await mutate("shop:adminCreateCurrency", { name: "별조각", description: "수업과 이벤트로 모으는 화폐", is_default: true }, boss);
  for (const [name, price, description] of [
    ["반짝이는 빗자루", 120, "비행 시험 필수품. 바람을 가르는 속도!"],
    ["월광초 씨앗", 30, "달빛을 받으면 은빛으로 피어나요."],
    ["별자리 지도", 45, "계절마다 바뀌는 밤하늘 안내서"],
    ["호박 파이", 10, "식당 할머니의 특제 간식"],
  ])
    await mutate("shop:adminCreateItem", { name, price_amount: price, currency_id: currency.id, description, consumable: true }, boss);
  for (const person of [luna, kai, sion])
    await mutate("shop:adminGrant", { kind: "currency", profile_id: person.profile, currency_id: currency.id, amount: 200, reason: "입학 축하" }, boss);

  // Photographs.
  async function shoot(who, path, file, { mobile = false, preview = false, dark = false, wait, full = false } = {}) {
    const context = await browser.newContext({
      ...(mobile
        ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
        : preview
          ? { viewport: { width: 1280, height: 960 } }
          : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 }),
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
      colorScheme: dark ? "dark" : "light",
    });
    if (who) await naru.signIn(context, who);
    const page = await context.newPage();
    await page.goto(naru.url(path));
    await page.waitForLoadState("networkidle");
    if (wait) await page.getByText(wait).first().waitFor({ timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    // Desktop shots keep the app's column, without the page's empty sides.
    const clip = mobile || preview ? undefined : { x: 150, y: 0, width: 980, height: 800 };
    await page.screenshot({
      path: preview
        ? join(root, "docs", file)
        : join(out, dark ? file.replace(/\.jpg$/, "-dark.jpg") : file),
      fullPage: full,
      clip,
      type: "jpeg",
      quality: preview ? 90 : 85,
    });
    console.log("shot", file);
    await context.close();
  }
  for (const dark of [false, true]) {
    await shoot("luna", "/", "timeline.jpg", { wait: "별자리 관측", dark });
    await shoot("luna", `/group-chats/${chat.id}`, "chat.jpg", { wait: "유성우", dark });
    await shoot("luna", "/boards/club", "boards.jpg", { wait: "퀴디치", dark });
    await shoot("luna", "/shop", "shop.jpg", { wait: "빗자루", dark });
    await shoot("boss", "/admin/applications", "admin.jpg", { wait: "하루", dark });
    await shoot("luna", "/", "timeline-mobile.jpg", { mobile: true, wait: "별자리 관측", dark });
    await shoot("luna", `/group-chats/${chat.id}`, "chat-mobile.jpg", { mobile: true, wait: "유성우", dark });
  }
  await shoot("luna", "/", "template-preview.jpg", { preview: true, wait: "별자리 관측" });
} finally {
  await browser.close();
  await naru.stop();
}
