// Bots (commung's bot.service and bot API): a profile the owner's programs
// act as, with tokens. A token is "<token id>.<secret>", shown once when it
// is made; the site keeps only ctx.passwords.hash(secret) and checks it with
// ctx.passwords.verify under the key `bot-token:<token id>`, which Naru
// allows ten wrong secrets an hour.
import { BUILTIN_COMMANDS, parseSlashCommand } from "./commands.js";
import { settingsOf } from "./community.js";
import { hostWord } from "./random.js";
import {
  type Ctx,
  denied,
  invalid,
  iso,
  list,
  type MutationCtx,
  notFound,
  type SqlValue,
  uuidv7,
} from "./core.js";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

// ---------- Bots and tokens ----------

export interface BotRow {
  id: string;
  name: string;
  description: string | null;
  profile_id: string;
  created_by: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  profile_name?: string;
  profile_username?: string;
  [key: string]: SqlValue | undefined;
}

/** A bot as the console's API answered it (its row, camelCase). */
export const botJson = (row: BotRow) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  profileId: row.profile_id,
  ...(row.profile_name === undefined
    ? {}
    : { profileName: row.profile_name, profileUsername: row.profile_username }),
  createdById: row.created_by,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

export async function listBots(ctx: Ctx) {
  const { rows } = await ctx.sql<BotRow>`
    SELECT b.*, p.name AS profile_name, p.username AS profile_username
    FROM bots b JOIN profiles p ON p.id = b.profile_id
    WHERE b.deleted_at IS NULL ORDER BY b.created_at, b.id`;
  return rows.map(botJson);
}

export async function getBot(ctx: Ctx, botId: string) {
  const { rows } = await ctx.sql<BotRow>`
    SELECT b.*, p.name AS profile_name, p.username AS profile_username
    FROM bots b JOIN profiles p ON p.id = b.profile_id
    WHERE b.id = ${botId} AND b.deleted_at IS NULL`;
  return rows[0] ? botJson(rows[0]) : null;
}

export async function requireBot(ctx: Ctx, botId: string) {
  return (await getBot(ctx, botId)) ?? notFound(ctx, "봇을 찾을 수 없습니다");
}

export interface TokenRow {
  id: string;
  name: string | null;
  created_at: number;
  expires_at: number | null;
  revoked_at: number | null;
  last_used_at: number | null;
}

export async function listTokens(ctx: Ctx, botId: string) {
  const { rows } = await ctx.sql<TokenRow>`
    SELECT id, name, created_at, expires_at, revoked_at, last_used_at
    FROM bot_tokens WHERE bot_id = ${botId} ORDER BY created_at, id`;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
    revokedAt: iso(row.revoked_at),
    lastUsedAt: iso(row.last_used_at),
  }));
}

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * A token's secret: 40 letters and digits from 256 bits the host draws with
 * crypto.getRandomValues (8 of the call's operations).
 */
export function newSecret(): string {
  let n = 0n;
  for (let i = 0; i < 8; i++) n = (n << 32n) | BigInt(hostWord());
  const base = BigInt(ALPHABET.length);
  let out = "";
  for (let i = 0; i < 40; i++) {
    out += ALPHABET[Number(n % base)];
    n /= base;
  }
  return out;
}

// ---------- Bot profiles ----------

/**
 * Makes an active, non-primary profile owned by `member`, for a bot to post
 * as (commung's createBotProfile).
 */
export async function createBotProfile(
  ctx: MutationCtx,
  name: string,
  username: string,
  member: string,
) {
  const { rows: taken } = await ctx.sql<{ id: string }>`
    SELECT id FROM profiles
    WHERE lower(username) = ${username.toLowerCase()} AND deleted_at IS NULL`;
  if (taken[0])
    invalid(ctx, "이 커뮤에서 이미 사용 중인 사용자명입니다", "username_taken");
  const profileId = uuidv7(ctx.now);
  const { rows } = await ctx.sql<{
    id: string;
    name: string;
    username: string;
    bio: string | null;
    created_at: number;
    updated_at: number;
    activated_at: number;
  }>`
    INSERT INTO profiles (id, name, username, is_primary, activated_at, created_at, updated_at)
    VALUES (${profileId}, ${name}, ${username}, 0, ${ctx.now}, ${ctx.now}, ${ctx.now})
    RETURNING id, name, username, bio, created_at, updated_at, activated_at`;
  await ctx.sql`
    INSERT INTO profile_owners (profile_id, member, role, created_at, created_by)
    VALUES (${profileId}, ${member}, 'owner', ${ctx.now}, ${member})`;
  const profile = rows[0];
  return {
    id: profile.id,
    username: profile.username,
    name: profile.name,
    bio: profile.bio,
    created_at: iso(profile.created_at),
    updated_at: iso(profile.updated_at),
    activatedAt: iso(profile.activated_at),
  };
}

/** A bot profile's name and username, checked as the console's schemas did. */
export function botProfileFields(ctx: Ctx, a: Record<string, unknown>) {
  const name = a.profile_name;
  if (typeof name !== "string" || name.length < 1 || name.length > 100)
    invalid(ctx, "프로필 이름은 1~100자여야 합니다.");
  const username = a.profile_username;
  if (
    typeof username !== "string" ||
    username.length < 1 ||
    username.length > 50 ||
    !USERNAME_PATTERN.test(username)
  )
    invalid(ctx, "사용자명은 영문, 숫자, 밑줄(_)로 50자 이하여야 합니다.");
  return { name, username };
}

// ---------- The bot API's caller ----------

export interface BotCaller {
  tokenId: string;
  botId: string;
  botName: string;
  profileId: string;
  profileName: string;
  profileUsername: string;
  /** The member who made the bot; its posts are written as theirs. */
  createdBy: string;
}

function invalidToken(ctx: Ctx): never {
  return ctx.fail("AUTH_REQUIRED", "유효하지 않거나 만료된 봇 토큰입니다.", {
    reason: "invalid_token",
  });
}

const TOKEN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9]{1,256})$/;

/**
 * The bot a token belongs to: live, not revoked or expired, with a secret
 * that matches its hash; refuses anything else.
 */
export async function authenticateBot(
  ctx: Ctx,
  token: unknown,
): Promise<BotCaller> {
  const match = typeof token === "string" ? TOKEN.exec(token.trim()) : null;
  if (!match) invalidToken(ctx);
  const [, tokenId, secret] = match;
  const { rows } = await ctx.sql<{
    hash: string;
    bot_id: string;
    bot_name: string;
    profile_id: string;
    profile_name: string;
    profile_username: string;
    created_by: string;
  }>`
    SELECT t.hash, b.id AS bot_id, b.name AS bot_name, b.profile_id,
      p.name AS profile_name, p.username AS profile_username, b.created_by
    FROM bot_tokens t JOIN bots b ON b.id = t.bot_id
    JOIN profiles p ON p.id = b.profile_id
    WHERE t.id = ${tokenId} AND t.revoked_at IS NULL AND b.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND (t.expires_at IS NULL OR t.expires_at > ${ctx.now})`;
  const row = rows[0];
  if (!row) invalidToken(ctx);
  if (!(await ctx.passwords.verify(secret, row.hash, `bot-token:${tokenId}`)))
    invalidToken(ctx);
  return {
    tokenId,
    botId: row.bot_id,
    botName: row.bot_name,
    profileId: row.profile_id,
    profileName: row.profile_name,
    profileUsername: row.profile_username,
    createdBy: row.created_by,
  };
}

/** Records when a token was last used (mutations only). */
export async function touchToken(ctx: MutationCtx, caller: BotCaller) {
  await ctx.sql`UPDATE bot_tokens SET last_used_at = ${ctx.now} WHERE id = ${caller.tokenId}`;
}

/** Refuses outside the community's dates (commung's validateCommunityActive). */
export async function requireActiveCommunity(ctx: Ctx, action: string) {
  const settings = await settingsOf(ctx);
  if (!settings) notFound(ctx, "커뮤를 찾을 수 없습니다");
  if (ctx.now > settings.ends_at)
    denied(ctx, `커뮤가 종료되어 ${action}할 수 없습니다`, "community_ended");
  if (ctx.now < settings.starts_at)
    denied(ctx, "커뮤가 아직 시작되지 않았습니다", "community_not_started");
}

// ---------- Posts as the bot API answers them ----------

interface PostRow {
  id: string;
  content: string;
  content_warning: string | null;
  announcement: number;
  author_id: string;
  in_reply_to_id: string | null;
  root_post_id: string | null;
  depth: number;
  published_at: number | null;
  created_at: number;
  updated_at: number;
  shown_at: number;
  author_name: string;
  author_username: string;
  author_picture_url: string | null;
  reply_count: number;
  [key: string]: SqlValue;
}

/** A post anyone sees: not deleted, published or due (as the posts area's VISIBLE). */
const SHOWN =
  "po.deleted_at IS NULL AND (po.published_at IS NOT NULL OR po.scheduled_at <= ?)";

const POST_SELECT = `SELECT po.id, po.content, po.content_warning, po.announcement,
  po.author_id, po.in_reply_to_id, po.root_post_id, po.depth, po.published_at,
  po.created_at, po.updated_at,
  COALESCE(po.published_at, po.scheduled_at, po.created_at) AS shown_at,
  p.name AS author_name,
  p.username AS author_username, pic.url AS author_picture_url,
  (SELECT count(*) FROM posts r WHERE r.in_reply_to_id = po.id
     AND r.deleted_at IS NULL AND (r.published_at IS NOT NULL OR r.scheduled_at <= ?)) AS reply_count
  FROM posts po JOIN profiles p ON p.id = po.author_id
  LEFT JOIN images pic ON pic.id = p.picture_id`;

/** Posts in the bot API's shape (author, images, reactions, reply counts). */
async function botPosts(
  ctx: Ctx,
  rows: readonly PostRow[],
  botProfileId: string,
) {
  if (!rows.length) return [];
  const ids = list(rows.map((row) => row.id));
  const { rows: images } = await ctx.sql<{
    post_id: string;
    id: string;
    url: string;
    width: number;
    height: number;
    filename: string;
  }>`
    SELECT pi.post_id, i.id, i.url, i.width, i.height, i.filename
    FROM post_images pi JOIN images i ON i.id = pi.image_id
    WHERE pi.post_id IN (SELECT value FROM json_each(${ids}))
    ORDER BY pi.position`;
  const { rows: reactions } = await ctx.sql<{
    post_id: string;
    emoji: string;
    id: string;
    username: string;
    name: string;
  }>`
    SELECT r.post_id, r.emoji, p.id, p.username, p.name
    FROM post_reactions r JOIN profiles p ON p.id = r.profile_id
    WHERE r.post_id IN (SELECT value FROM json_each(${ids}))
    ORDER BY r.created_at LIMIT 1000`;
  const { rows: bookmarks } = await ctx.sql<{ post_id: string }>`
    SELECT post_id FROM post_bookmarks
    WHERE profile_id = ${botProfileId} AND post_id IN (SELECT value FROM json_each(${ids}))`;
  const bookmarked = new Set(bookmarks.map((b) => b.post_id));
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    author: {
      id: row.author_id,
      name: row.author_name,
      username: row.author_username,
      profile_picture_url: row.author_picture_url,
    },
    images: images
      .filter((image) => image.post_id === row.id)
      .map(({ post_id: _, ...image }) => image),
    reactions: reactions
      .filter((reaction) => reaction.post_id === row.id)
      .map((reaction) => ({
        emoji: reaction.emoji,
        user: {
          id: reaction.id,
          username: reaction.username,
          name: reaction.name,
        },
      })),
    reply_count: row.reply_count,
    depth: row.depth,
    in_reply_to_id: row.in_reply_to_id,
    root_post_id: row.root_post_id,
    announcement: row.announcement === 1,
    content_warning: row.content_warning,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    is_bookmarked: bookmarked.has(row.id),
  }));
}

/** The timeline's top-level posts, newest first, by cursor. */
export async function botTimeline(
  ctx: Ctx,
  caller: BotCaller,
  limit: number,
  cursor: string | null,
) {
  const { rows } = await ctx.sql<PostRow>(
    `${POST_SELECT}
     WHERE ${SHOWN} AND po.depth = 0 AND (? IS NULL OR po.id < ?)
     ORDER BY po.id DESC LIMIT ?`,
    [ctx.now, ctx.now, cursor, cursor, limit + 1],
  );
  const { rows: counts } = await ctx.sql<{ n: number }>`
    SELECT count(*) AS n FROM posts
    WHERE deleted_at IS NULL AND depth = 0
      AND (published_at IS NOT NULL OR scheduled_at <= ${ctx.now})`;
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    data: (await botPosts(ctx, page, caller.profileId)).map((post) => ({
      ...post,
      replies: [],
      has_more_replies: post.reply_count > 0,
    })),
    pagination: {
      next_cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      has_more: hasMore,
      total_count: counts[0]?.n ?? 0,
    },
  };
}

/** One published post with its direct replies and the posts above it. */
export async function botPost(ctx: Ctx, caller: BotCaller, postId: string) {
  const { rows } = await ctx.sql<PostRow>(
    `${POST_SELECT} WHERE po.id = ? AND ${SHOWN}`,
    [ctx.now, postId, ctx.now],
  );
  if (!rows[0]) notFound(ctx, "게시물을 찾을 수 없습니다");
  const { rows: replies } = await ctx.sql<PostRow>(
    `${POST_SELECT} WHERE po.in_reply_to_id = ? AND ${SHOWN}
     ORDER BY po.id LIMIT 100`,
    [ctx.now, postId, ctx.now],
  );
  const parents: PostRow[] = [];
  let parentId = rows[0].in_reply_to_id;
  while (parentId && parents.length < 20) {
    const { rows: found } = await ctx.sql<PostRow>(
      `${POST_SELECT} WHERE po.id = ? AND po.deleted_at IS NULL`,
      [ctx.now, parentId],
    );
    if (!found[0]) break;
    parents.unshift(found[0]);
    parentId = found[0].in_reply_to_id;
  }
  const [post] = await botPosts(ctx, rows, caller.profileId);
  return {
    ...post,
    replies: await botPosts(ctx, replies, caller.profileId),
    parent_thread: await botPosts(ctx, parents, caller.profileId),
  };
}

/** A live, published post for a bot to change or react to. */
export async function livePost(ctx: Ctx, postId: string, message: string) {
  const { rows } = await ctx.sql<{
    id: string;
    author_id: string;
    author_username: string;
    content: string;
    content_warning: string | null;
    published_at: number | null;
    scheduled_at: number | null;
  }>`
    SELECT po.id, po.author_id, p.username AS author_username, po.content,
      po.content_warning, po.published_at, po.scheduled_at
    FROM posts po JOIN profiles p ON p.id = po.author_id
    WHERE po.id = ${postId} AND po.deleted_at IS NULL`;
  return rows[0] ?? notFound(ctx, message);
}

// ---------- What the bot is asked ----------

/** How many candidates each source offers, newest first, before filtering. */
const CANDIDATES = 200;

/**
 * Posts for the bot to answer, newest first by when they appeared, at most
 * `limit`: those that mention it, reply to its posts, or are a slash command
 * no built-in command answers (`/weather 서울`). Each says why (`reasons`)
 * and, for a command, its name and arguments. A scheduled post appears when
 * it is published, with an ID older than posts before it, so a bot keeps
 * the IDs it has answered rather than a cursor; `since` (milliseconds or an
 * ISO time) leaves out posts that appeared before it.
 */
export async function botMentions(
  ctx: Ctx,
  caller: BotCaller,
  limit: number,
  since: number | null,
) {
  const bot = caller.profileId;
  const { rows: mentioned } = await ctx.sql<{ id: string }>`
    SELECT post_id AS id FROM mentions WHERE profile_id = ${bot}
    ORDER BY post_id DESC LIMIT ${CANDIDATES}`;
  const { rows: replied } = await ctx.sql<{ id: string }>`
    SELECT r.id FROM posts b JOIN posts r ON r.in_reply_to_id = b.id
    WHERE b.author_id = ${bot} ORDER BY r.id DESC LIMIT ${CANDIDATES}`;
  const { rows: slashed } = await ctx.sql<{ id: string }>`
    SELECT id FROM posts WHERE substr(content, 1, 1) = '/'
    ORDER BY id DESC LIMIT ${CANDIDATES}`;
  const reasons = new Map<string, Set<string>>();
  const add = (rows: readonly { id: string }[], reason: string) => {
    for (const { id } of rows) {
      if (!reasons.has(id)) reasons.set(id, new Set());
      reasons.get(id)?.add(reason);
    }
  };
  add(mentioned, "mention");
  add(replied, "reply");
  add(slashed, "command");
  if (!reasons.size) return { data: [] };

  const { rows } = await ctx.sql<PostRow>(
    `${POST_SELECT}
     WHERE po.id IN (SELECT value FROM json_each(?)) AND ${SHOWN}
       AND po.author_id <> ? AND (? IS NULL OR shown_at >= ?)
     ORDER BY shown_at DESC, po.id DESC`,
    [ctx.now, list([...reasons.keys()]), ctx.now, bot, since, since],
  );
  const builtin = new Set(BUILTIN_COMMANDS.map((command) => command.name));
  const wanted: {
    row: PostRow;
    reasons: string[];
    command: { name: string; args: string } | null;
  }[] = [];
  for (const row of rows) {
    const why = reasons.get(row.id) ?? new Set<string>();
    let command: { name: string; args: string } | null = null;
    if (why.has("command")) {
      const parsed = parseSlashCommand(row.content);
      if (parsed && !builtin.has(parsed.name)) command = parsed;
      else why.delete("command");
    }
    if (!why.size) continue;
    wanted.push({ row, reasons: [...why], command });
    if (wanted.length >= limit) break;
  }
  const posts = await botPosts(
    ctx,
    wanted.map((w) => w.row),
    bot,
  );
  return {
    data: posts.map((post, i) => ({
      ...post,
      shown_at: iso(wanted[i].row.shown_at),
      reasons: wanted[i].reasons,
      command: wanted[i].command,
    })),
  };
}
