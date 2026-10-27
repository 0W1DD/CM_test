// Writing posts, shared by the posts area's mutations and the bot API:
// commung's createPost with its checks, images, mentions, hashtags, search
// index and notifications (rows in `notifications`, and ctx.notify to the
// members behind the recipient profiles, standing in for commung's pushes).
//
// Scheduled posts without a scheduler: a post scheduled for later is written
// unpublished and seen by no one else until its time (reads treat it as
// published once scheduled_at <= ctx.now, `VISIBLE`); every posts mutation
// first runs publishDue, which marks the due ones published and sends what
// publishing sends (mention notifications, a command's reply).
import { membersOfProfiles } from "./access.js";
import { type CommandTrigger, commandReply } from "./commands.js";
import { settingsOf } from "./community.js";
import {
  denied,
  invalid,
  list,
  type MutationCtx,
  notFound,
  uuidv7,
} from "./core.js";
import { ownImages } from "./images.js";
import { type PostRow, VISIBLE } from "./post-data.js";

export interface NewPost {
  authorProfileId: string;
  /** The member writing (commung's created_by_user_id); a bot's creator. */
  actorMember: string;
  content: string;
  contentWarning?: string | null;
  inReplyToId?: string | null;
  imageIds?: string[];
  announcement?: boolean;
  scheduledAt?: number | null;
}

const ellipsis = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max)}...` : text;

/** The page of a post, opened from a notification. */
export const postPath = (username: string, postId: string) =>
  `/@${username}/${postId}`;

/**
 * Writes notifications to `recipients` (profiles) from `sender` about
 * `postId`, and notifies their members in the Naru app, but `actorMember`.
 */
export async function notifyProfiles(
  ctx: MutationCtx,
  {
    type,
    title,
    message,
    sender,
    postId,
    recipients,
    path,
    actorMember,
  }: {
    type: "reply" | "mention" | "reaction";
    title: string;
    message: string;
    sender: string;
    postId: string | null;
    recipients: readonly string[];
    path: string;
    actorMember: string | null;
  },
) {
  const unique = [...new Set(recipients)];
  if (!unique.length) return;
  const rows = unique.map((recipient) => [uuidv7(ctx.now), recipient]);
  await ctx.sql`
    INSERT INTO notifications (id, type, title, message, recipient_id, profile_id, post_id, created_at)
    SELECT json_extract(value, '$[0]'), ${type}, ${title}, ${message},
      json_extract(value, '$[1]'), ${sender}, ${postId}, ${ctx.now}
    FROM json_each(${JSON.stringify(rows)})`;
  const members = (await membersOfProfiles(ctx, unique)).filter(
    (member) => member !== actorMember,
  );
  if (members.length)
    await ctx.notify(members, {
      title: title.slice(0, 100),
      body: message.slice(0, 500),
      path,
    });
}

/** `#tags` in a post: letters, digits and underscores after a `#` that starts a word. */
export function hashtagsIn(content: string): string[] {
  const tags = new Set<string>();
  for (const match of content.matchAll(/(^|\s)#([\p{L}\p{N}_]+)/gu)) {
    const tag = (match[2] ?? "").toLowerCase();
    if (tag.length <= 100) tags.add(tag);
  }
  return [...tags].slice(0, 30);
}

/** Replaces a post's hashtags and its search entry with its current text. */
export async function indexPost(
  ctx: MutationCtx,
  post: { id: string; content: string; content_warning: string | null },
  { fresh = false } = {},
) {
  const tags = hashtagsIn(post.content);
  if (!fresh) {
    await ctx.sql`DELETE FROM post_hashtags WHERE post_id = ${post.id}`;
    await ctx.sql`DELETE FROM posts_search WHERE post_id = ${post.id}`;
  }
  if (tags.length) {
    await ctx.sql`
      INSERT OR IGNORE INTO hashtags (tag, created_at)
      SELECT value, ${ctx.now} FROM json_each(${list(tags)})`;
    await ctx.sql`
      INSERT OR IGNORE INTO post_hashtags (post_id, tag)
      SELECT ${post.id}, value FROM json_each(${list(tags)})`;
  }
  await ctx.sql`
    INSERT INTO posts_search (post_id, content, content_warning)
    VALUES (${post.id}, ${post.content}, ${post.content_warning})`;
}

/** Takes a deleted post out of search. */
export async function unindexPost(ctx: MutationCtx, postId: string) {
  await ctx.sql`DELETE FROM posts_search WHERE post_id = ${postId}`;
}

interface Published {
  id: string;
  content: string;
  author_id: string;
  created_by: string;
  in_reply_to_id: string | null;
}

/**
 * What publishing a post sends: a reply notification to the parent's author
 * and mentions (rows in `mentions`, and notifications to everyone mentioned
 * but the author and the one already told of the reply).
 */
async function announce(ctx: MutationCtx, post: Published) {
  const { rows: authors } = await ctx.sql<{ name: string; username: string }>`
    SELECT name, username FROM profiles WHERE id = ${post.author_id}`;
  const author = authors[0];
  if (!author) return;
  const path = postPath(author.username, post.id);
  let replied: string | null = null;
  if (post.in_reply_to_id) {
    const { rows } = await ctx.sql<{ author_id: string }>`
      SELECT author_id FROM posts WHERE id = ${post.in_reply_to_id}`;
    const parentAuthor = rows[0]?.author_id;
    if (parentAuthor && parentAuthor !== post.author_id) {
      replied = parentAuthor;
      await notifyProfiles(ctx, {
        type: "reply",
        title: "새로운 답글",
        message: `${author.name}님이 답글을 작성했습니다`,
        sender: post.author_id,
        postId: post.id,
        recipients: [parentAuthor],
        path,
        actorMember: post.created_by,
      });
    }
  }
  const usernames = [
    ...new Set(
      [...post.content.matchAll(/@([a-zA-Z0-9_]+)/g)].map((m) =>
        (m[1] ?? "").toLowerCase(),
      ),
    ),
  ].slice(0, 100);
  if (!usernames.length) return;
  const { rows: mentioned } = await ctx.sql<{ id: string }>`
    SELECT id FROM profiles
    WHERE lower(username) IN (SELECT value FROM json_each(${list(usernames)}))
      AND activated_at IS NOT NULL AND deleted_at IS NULL
      AND id != ${post.author_id}`;
  if (!mentioned.length) return;
  const ids = mentioned.map((row) => row.id);
  await ctx.sql`
    INSERT OR IGNORE INTO mentions (profile_id, post_id, created_at)
    SELECT value, ${post.id}, ${ctx.now} FROM json_each(${list(ids)})`;
  await notifyProfiles(ctx, {
    type: "mention",
    title: `${author.name}님이 회원님을 언급했습니다`,
    message: ellipsis(post.content, 100),
    sender: post.author_id,
    postId: post.id,
    recipients: ids.filter((id) => id !== replied),
    path,
    actorMember: post.created_by,
  });
}

/**
 * The reply a command in a just-published post answers with, written as a
 * reply to it (commung's maybeDispatchCommand), authored by the profile the
 * command answers as. Command replies are not themselves dispatched.
 */
export async function answerCommand(
  ctx: MutationCtx,
  trigger: CommandTrigger,
): Promise<string | null> {
  const reply = await commandReply(ctx, trigger);
  if (!reply) return null;
  let actor = trigger.actorMember;
  if (!actor) {
    const { rows } = await ctx.sql<{ member: string }>`
      SELECT member FROM profile_owners
      WHERE profile_id = ${trigger.authorProfileId} AND role = 'owner'`;
    actor = rows[0]?.member ?? null;
  }
  if (!actor) return null;
  return writePost(
    ctx,
    {
      authorProfileId: reply.authorProfileId,
      actorMember: actor,
      content: reply.content,
      inReplyToId: trigger.id,
    },
    { system: true },
  );
}

/**
 * Publishes scheduled posts whose time has come (a few a call; reads already
 * show them), sending their mentions and command replies. Every posts
 * mutation runs it first.
 */
export async function publishDue(ctx: MutationCtx) {
  const { rows } = await ctx.sql<Published & { root_post_id: string | null }>`
    UPDATE posts SET published_at = scheduled_at,
      bumped_at = COALESCE(bumped_at, scheduled_at)
    WHERE id IN (
      SELECT id FROM posts
      WHERE published_at IS NULL AND scheduled_at IS NOT NULL
        AND scheduled_at <= ${ctx.now} AND deleted_at IS NULL
      ORDER BY scheduled_at LIMIT 3)
    RETURNING id, content, author_id, created_by, in_reply_to_id, root_post_id`;
  for (const post of rows) {
    await announce(ctx, post);
    await answerCommand(ctx, {
      id: post.id,
      content: post.content,
      authorProfileId: post.author_id,
      actorMember: post.created_by,
      rootPostId: post.root_post_id,
    });
  }
}

/** Writes a post with its images, mentions, hashtags and notifications; answers its ID. */
export async function createPost(
  ctx: MutationCtx,
  post: NewPost,
): Promise<string> {
  return writePost(ctx, post);
}

/**
 * createPost; a `system` post (a command's reply) skips the checks on its
 * writer (mute, the community's dates and the writer's role).
 */
async function writePost(
  ctx: MutationCtx,
  post: NewPost,
  { system = false } = {},
): Promise<string> {
  const settings = await settingsOf(ctx);
  if (!settings) notFound(ctx, "커뮤를 찾을 수 없습니다");
  const content = typeof post.content === "string" ? post.content : "";
  const contentWarning = post.contentWarning?.trim() || null;
  const imageIds = post.imageIds ?? [];
  const scheduledAt = post.scheduledAt ?? null;
  const inReplyToId = post.inReplyToId ?? null;

  let parent: PostRow | null = null;
  if (inReplyToId) {
    const { rows } = await ctx.sql<PostRow>(
      `SELECT p.* FROM posts p WHERE p.id = ? AND ${VISIBLE}`,
      [inReplyToId, ctx.now],
    );
    parent = rows[0] ?? null;
    if (!parent) notFound(ctx, "상위 게시물을 찾을 수 없습니다");
  }

  const { rows: profiles } = await ctx.sql<{ muted_at: number | null }>`
    SELECT muted_at FROM profiles
    WHERE id = ${post.authorProfileId}
      AND activated_at IS NOT NULL AND deleted_at IS NULL`;
  const profile = profiles[0];
  if (!profile) notFound(ctx, "프로필을 찾을 수 없습니다");
  if (profile.muted_at !== null && !system)
    denied(ctx, "이 프로필은 음소거되어 게시할 수 없습니다", "muted");

  if (!content.trim() && !imageIds.length)
    invalid(ctx, "게시물 내용 또는 이미지를 제공해야 합니다", "empty_post");
  if (content.length > 10000)
    invalid(ctx, "게시물은 10000자 이하여야 합니다", "content_too_long");
  if (contentWarning && contentWarning.length > 500)
    invalid(
      ctx,
      "내용 경고는 500자 이하여야 합니다",
      "content_warning_too_long",
    );

  if (imageIds.length) {
    if (ctx.member?.id === post.actorMember) await ownImages(ctx, imageIds);
    else {
      const { rows } = await ctx.sql<{ n: number }>`
        SELECT count(*) AS n FROM images
        WHERE id IN (SELECT value FROM json_each(${list(imageIds)}))
          AND deleted_at IS NULL AND member = ${post.actorMember}`;
      if (rows[0]?.n !== new Set(imageIds).size)
        invalid(ctx, "일부 이미지가 유효하지 않습니다", "invalid_image");
    }
  }

  if (!system) {
    if (ctx.now > settings.ends_at)
      denied(ctx, "커뮤가 종료되어 게시할 수 없습니다", "community_ended");
    const { rows: roles } = await ctx.sql<{ role: string }>`
      SELECT role FROM members WHERE member = ${post.actorMember}`;
    const role = roles[0]?.role;
    const staff = role === "owner" || role === "moderator";
    if (ctx.now < settings.starts_at && !staff)
      denied(ctx, "커뮤가 아직 시작되지 않았습니다", "community_not_started");
    if (scheduledAt !== null) {
      if (!staff)
        denied(ctx, "게시물 예약은 관리자만 가능합니다", "not_moderator");
      if (inReplyToId)
        invalid(ctx, "답글은 예약할 수 없습니다", "scheduled_reply");
      if (scheduledAt <= ctx.now)
        invalid(
          ctx,
          "예약 시간은 현재 시간 이후여야 합니다",
          "scheduled_in_past",
        );
      if (scheduledAt > settings.ends_at)
        invalid(
          ctx,
          "커뮤 종료 시간 이전으로 예약해야 합니다",
          "scheduled_after_end",
        );
    }
    if (post.announcement) {
      if (role !== "owner")
        denied(ctx, "공지사항은 소유자만 작성할 수 있습니다", "not_owner");
      if (inReplyToId)
        invalid(
          ctx,
          "답글은 공지사항으로 작성할 수 없습니다",
          "announcement_reply",
        );
    }
  }

  const id = uuidv7(ctx.now);
  const rootPostId = parent ? (parent.root_post_id ?? parent.id) : null;
  const depth = parent ? parent.depth + 1 : 0;
  const scheduled = scheduledAt !== null;
  // A scheduled root post is bumped at its time, so bump_on_reply's order
  // needs nothing from publishDue.
  await ctx.sql`
    INSERT INTO posts (id, content, content_warning, announcement, author_id,
      created_by, in_reply_to_id, root_post_id, depth, scheduled_at,
      published_at, bumped_at, created_at, updated_at)
    VALUES (${id}, ${content}, ${contentWarning}, ${post.announcement === true},
      ${post.authorProfileId}, ${post.actorMember}, ${inReplyToId},
      ${rootPostId}, ${depth}, ${scheduledAt},
      ${scheduled ? null : ctx.now},
      ${parent ? null : scheduled ? scheduledAt : ctx.now},
      ${ctx.now}, ${ctx.now})`;
  if (imageIds.length)
    await ctx.sql`
      INSERT INTO post_images (post_id, image_id, position)
      SELECT ${id}, value, key FROM json_each(${list(imageIds)})`;
  if (rootPostId)
    await ctx.sql`UPDATE posts SET bumped_at = ${ctx.now} WHERE id = ${rootPostId}`;
  await indexPost(
    ctx,
    { id, content, content_warning: contentWarning },
    { fresh: true },
  );
  if (!scheduled)
    await announce(ctx, {
      id,
      content,
      author_id: post.authorProfileId,
      created_by: post.actorMember,
      in_reply_to_id: inReplyToId,
    });
  return id;
}
