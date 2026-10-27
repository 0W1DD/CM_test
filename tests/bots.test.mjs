import assert from "node:assert/strict";
import test from "node:test";
import { addProfile, as, community, refusal, VISITOR } from "./helpers.mjs";

/** Posts as a member's profile and answers the reply a command left, or null. */
async function post(site, member, profile, content) {
  site.now += 1000;
  const written = await site.mutate("posts:create", { profile_id: profile, content }, as(member));
  const replies = site.rows(
    `SELECT po.content, p.username FROM posts po JOIN profiles p ON p.id = po.author_id
     WHERE po.in_reply_to_id = ?`,
    written.id,
  );
  return replies[0] ?? null;
}

test("the built-in commands are listed for members, and always on", async () => {
  const { site } = await community();
  assert.equal(await refusal(site.query("commands:list", null, VISITOR)), "signed_out");
  const names = (await site.query("commands:list", null, as("m-bob"))).map((c) => c.name);
  assert.deepEqual(names, [
    "roll",
    "coin",
    "choose",
    "help",
    "balance",
    "items",
    "buy",
    "inventory",
    "use",
    "grant",
  ]);
});

test("one bot profile replies to every command, made when first needed", async () => {
  const { site, profiles } = await community();
  // A member already has @bot: the commands' bot takes the next name.
  addProfile(site, "m-bob", "bot", { primary: false });
  assert.equal(site.rows("SELECT command_bot_profile_id FROM settings")[0].command_bot_profile_id, null);
  const first = await post(site, "m-alice", profiles.alice, "/coin");
  const second = await post(site, "m-alice", profiles.alice, "/roll 1d6");
  assert.equal(first.username, "bot_2");
  assert.equal(second.username, "bot_2");
  const [bot] = site.rows(
    "SELECT p.id, p.name FROM settings s JOIN profiles p ON p.id = s.command_bot_profile_id",
  );
  assert.equal(bot.name, "봇");
  // No member owns it, so no one can act as it.
  assert.deepEqual(site.rows("SELECT * FROM profile_owners WHERE profile_id = ?", bot.id), []);
});

test("slash commands reply as the bot, inside the posting mutation", async () => {
  const { site, profiles } = await community();
  assert.equal(await post(site, "m-alice", profiles.alice, "그냥 글"), null);
  assert.equal(await post(site, "m-alice", profiles.alice, "/unknown"), null);
  const roll = await post(site, "m-alice", profiles.alice, "/roll 2d6+3");
  assert.equal(roll.username, "bot");
  const [, a, b, total] = roll.content.match(/^🎲 2d6\+3: \[(\d), (\d)\] \+ 3 = (\d+)$/);
  assert.equal(Number(a) + Number(b) + 3, Number(total));
  assert.match((await post(site, "m-alice", profiles.alice, "/roll 4d6dl1")).content, /사용 \[/);
  assert.equal(
    (await post(site, "m-alice", profiles.alice, "/roll 0d6")).content,
    "주사위 개수는 1 이상이어야 합니다.",
  );
  assert.match((await post(site, "m-alice", profiles.alice, "/COIN")).content, /^🪙 (앞면|뒷면)$/);
  const help = await post(site, "m-alice", profiles.alice, "/help");
  assert.match(help.content, /^\*\*사용 가능한 명령어\*\*/);
  assert.match(help.content, /`\/roll`/);
  // A thousand dice fit in one call: Naru counts each Math.random() as an
  // operation, so dice come from a generator seeded once.
  const many = await post(site, "m-alice", profiles.alice, "/roll 1000d6");
  assert.match(many.content, /^🎲 1000d6: \[/);
  assert.ok(site.operations <= 100);
  // A command must be the whole post, on one line.
  assert.equal(await post(site, "m-alice", profiles.alice, "/coin\n둘째 줄"), null);
});

test("shop commands change balances in the same transaction, and refusals reply", async () => {
  const { site, profiles } = await community();
  const gold = await site.mutate("shop:adminCreateCurrency", { name: "골드", is_default: true }, as("m-owner"));
  const potion = await site.mutate(
    "shop:adminCreateItem",
    { name: "포션", description: "HP를 회복합니다.", price_amount: 10, currency_id: gold.id, consumable: true },
    as("m-owner"),
  );
  const balance = () =>
    site.rows("SELECT amount FROM shop_balances WHERE profile_id = ?", profiles.alice)[0]?.amount ?? 0;
  const say = (content, member = "m-alice", profile = profiles.alice) =>
    post(site, member, profile, content).then((reply) => reply?.content);

  assert.equal(await say("/balance"), "잔액이 없습니다.");
  assert.equal(await say("/buy 포션"), "잔액이 부족합니다");
  assert.equal(await say("/buy 없는거"), "상품을 찾을 수 없습니다: 없는거");
  // Only the owner grants.
  assert.equal(await say("/grant alice 25 골드"), "이 명령어를 사용할 권한이 없습니다.");
  assert.equal(balance(), 0);
  assert.equal(
    await say("/grant alice 25 골드 환영", "m-owner", profiles.owner),
    "🎁 **ALICE** 님에게 25 골드 지급되었습니다.",
  );
  assert.equal(balance(), 25);
  assert.equal(await say("/buy 포션"), "🛒 **포션** 구매 완료!");
  assert.equal(await say("/buy 포션"), "🛒 **포션** 구매 완료!");
  assert.equal(await say("/buy 포션"), "잔액이 부족합니다");
  assert.equal(balance(), 5);
  assert.equal(await say("/inventory"), "**보유 상품**\n\n- **포션** ×2 · 소모품");
  assert.equal(await say("/use 포션"), "🪄 **ALICE**님이 **포션**을(를) 사용했습니다.\n\nHP를 회복합니다.");
  assert.equal(
    site.rows("SELECT qty FROM shop_inventory WHERE profile_id = ? AND item_id = ?", profiles.alice, potion.id)[0].qty,
    1,
  );
  assert.equal(await say("/balance"), "**잔액**\n\n- **골드**: 5 (기본)");
  assert.equal(await say("/items"), "**상점**\n\n- **포션** (10 골드) — HP를 회복합니다. · 소모품");
  const kinds = site.rows("SELECT kind, actor_member FROM shop_transactions ORDER BY id");
  assert.deepEqual(kinds.map((k) => k.kind), [
    "currency_grant",
    "item_purchase",
    "item_purchase",
    "item_consume",
  ]);
  assert.equal(kinds[1].actor_member, "m-alice");
});

test("the owner makes bots and tokens; a token is shown once and kept as a hash", async () => {
  const { site } = await community();
  const make = (member) =>
    site.mutate(
      "bots:adminCreate",
      { name: "알림봇", description: "알려줘요", profile_name: "알림", profile_username: "notifier" },
      as(member),
    );
  assert.equal(await refusal(make("m-alice")), "not_owner");
  const bot = await make("m-owner");
  assert.equal(bot.profile.username, "notifier");
  assert.equal(await refusal(site.query("bots:adminList", null, as("m-alice"))), "not_moderator");
  assert.equal((await site.query("bots:adminList", null, as("m-owner")))[0].profileUsername, "notifier");

  const token = await site.mutate("bots:adminCreateToken", { bot_id: bot.id, name: "서버" }, as("m-owner"));
  assert.match(token.token, new RegExp(`^${token.id}\\.[A-Za-z0-9]{40}$`));
  const [stored] = site.rows("SELECT hash FROM bot_tokens WHERE id = ?", token.id);
  assert.notEqual(stored.hash, token.token);
  assert.ok(!stored.hash.includes(token.token));
  const detail = await site.query("bots:adminGet", { bot_id: bot.id }, as("m-owner"));
  assert.deepEqual(Object.keys(detail.tokens[0]).sort(), [
    "createdAt",
    "expiresAt",
    "id",
    "lastUsedAt",
    "name",
    "revokedAt",
  ]);

  const updated = await site.mutate("bots:adminUpdate", { bot_id: bot.id, name: "새 이름" }, as("m-owner"));
  assert.equal(updated.name, "새 이름");
  await site.mutate("bots:adminDelete", { bot_id: bot.id }, as("m-owner"));
  assert.deepEqual(await site.query("bots:adminList", null, as("m-owner")), []);
  assert.equal(
    await refusal(site.query("bot:posts", { token: token.token }, VISITOR)),
    "invalid_token",
  );
});

test("the bot API: a token acts as the bot's profile", async () => {
  const { site, profiles } = await community();
  const bot = await site.mutate(
    "bots:adminCreate",
    { name: "봇", profile_name: "봇", profile_username: "bot" },
    as("m-owner"),
  );
  const { token, id: tokenId } = await site.mutate("bots:adminCreateToken", { bot_id: bot.id }, as("m-owner"));
  const wrong = `${tokenId}.${"x".repeat(40)}`;
  assert.equal(await refusal(site.query("bot:posts", { token: wrong }, VISITOR)), "invalid_token");
  assert.equal(await refusal(site.query("bot:posts", { token: "nonsense" }, VISITOR)), "invalid_token");

  site.now += 1000;
  const created = await site.mutate("bot:createPost", { token, content: "안녕하세요" }, VISITOR);
  assert.equal(created.author.username, "bot");
  assert.equal(created.content, "안녕하세요");
  assert.equal(
    site.rows("SELECT last_used_at FROM bot_tokens WHERE id = ?", tokenId)[0].last_used_at,
    site.now,
  );
  // A command in a bot's post runs too.
  site.now += 1000;
  const coin = await site.mutate("bot:createPost", { token, content: "/coin" }, VISITOR);
  const [reply] = site.rows("SELECT content FROM posts WHERE in_reply_to_id = ?", coin.id);
  assert.match(reply.content, /^🪙/);

  site.now += 1000;
  const alicePost = await site.mutate("posts:create", { profile_id: profiles.alice, content: "앨리스 글" }, as("m-alice"));
  const timeline = await site.query("bot:posts", { token, limit: 2 }, VISITOR);
  assert.equal(timeline.data[0].id, alicePost.id);
  assert.equal(timeline.pagination.has_more, true);
  assert.equal((await site.query("bot:post", { token, post_id: coin.id }, VISITOR)).replies.length, 1);

  await site.mutate("bot:addReaction", { token, post_id: alicePost.id, emoji: "👍" }, VISITOR);
  assert.equal(
    await refusal(site.mutate("bot:addReaction", { token, post_id: alicePost.id, emoji: "👍" }, VISITOR)),
    "already_reacted",
  );
  const [notification] = site.rows("SELECT type, recipient_id FROM notifications WHERE type = 'reaction'");
  assert.equal(notification.recipient_id, profiles.alice);
  await site.mutate("bot:removeReaction", { token, post_id: alicePost.id, emoji: "👍" }, VISITOR);

  assert.equal(
    await refusal(site.mutate("bot:updatePost", { token, post_id: alicePost.id, content: "x" }, VISITOR)),
    "not_post_author",
  );
  assert.equal(
    await refusal(site.mutate("bot:deletePost", { token, post_id: alicePost.id }, VISITOR)),
    "not_post_author",
  );
  const edited = await site.mutate("bot:updatePost", { token, post_id: created.id, content: "고침" }, VISITOR);
  assert.equal(edited.content, "고침");
  assert.equal(site.rows("SELECT content FROM post_history WHERE post_id = ?", created.id)[0].content, "안녕하세요");
  await site.mutate("bot:deletePost", { token, post_id: created.id }, VISITOR);
  assert.equal(await refusal(site.query("bot:post", { token, post_id: created.id }, VISITOR)), "not_found");

  // Revoked or expired tokens stop working.
  await site.mutate("bots:adminRevokeToken", { bot_id: bot.id, token_id: tokenId }, as("m-owner"));
  assert.equal(await refusal(site.query("bot:posts", { token }, VISITOR)), "invalid_token");
  const expiring = await site.mutate(
    "bots:adminCreateToken",
    { bot_id: bot.id, expires_at: new Date(site.now + 1000).toISOString() },
    as("m-owner"),
  );
  assert.equal((await site.query("bot:posts", { token: expiring.token }, VISITOR)).data.length > 0, true);
  site.now += 2000;
  assert.equal(await refusal(site.query("bot:posts", { token: expiring.token }, VISITOR)), "invalid_token");
});

test("bot:mentions: posts that mention the bot, reply to it, or hold a command for it", async () => {
  const { site, profiles } = await community();
  const bot = await site.mutate(
    "bots:adminCreate",
    { name: "날씨", profile_name: "날씨봇", profile_username: "weather" },
    as("m-owner"),
  );
  const { token } = await site.mutate("bots:adminCreateToken", { bot_id: bot.id }, as("m-owner"));
  const write = (content, extra = {}) => {
    site.now += 1000;
    return site.mutate("posts:create", { profile_id: profiles.alice, content, ...extra }, as("m-alice"));
  };
  assert.deepEqual(await site.query("bot:mentions", { token }, VISITOR), { data: [] });
  assert.equal(await refusal(site.query("bot:mentions", { token: "nope" }, VISITOR)), "invalid_token");

  const start = site.now;
  const mention = await write("@weather 서울 날씨 알려줘");
  await write("그냥 글");
  await write("/roll 1d6"); // built in: answered by @bot, not this bot
  const command = await write("/weather 부산");
  site.now += 1000;
  const own = await site.mutate("bot:createPost", { token, content: "맑음" }, VISITOR);
  const reply = await write("고마워", { in_reply_to_id: own.id });

  const { data } = await site.query("bot:mentions", { token }, VISITOR);
  assert.deepEqual(
    data.map((post) => [post.content, post.reasons, post.command]),
    [
      ["고마워", ["reply"], null],
      ["/weather 부산", ["command"], { name: "weather", args: "부산" }],
      ["@weather 서울 날씨 알려줘", ["mention"], null],
    ],
  );
  assert.equal(data[2].id, mention.id);
  assert.equal(data[1].author.username, "alice");
  assert.ok(site.operations <= 100);

  // since leaves out what appeared before it; limit keeps the newest.
  const later = await site.query("bot:mentions", { token, since: start + 3500 }, VISITOR);
  assert.deepEqual(later.data.map((post) => post.id), [reply.id, command.id]);
  const one = await site.query("bot:mentions", { token, limit: 1 }, VISITOR);
  assert.deepEqual(one.data.map((post) => post.id), [reply.id]);

  // A deleted post is no longer asked.
  await site.mutate("posts:remove", { post_id: reply.id, profile_id: profiles.alice }, as("m-alice"));
  assert.deepEqual(
    (await site.query("bot:mentions", { token }, VISITOR)).data.map((post) => post.id),
    [command.id, mention.id],
  );
});
