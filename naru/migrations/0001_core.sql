-- The community: its settings, members, applications, profiles, images,
-- posts and notifications. IDs are UUIDv7 strings made in site code
-- (modules/ids.ts); times are INTEGER milliseconds; flags INTEGER 0/1.
-- Commung's `user` is a Naru member (`ctx.member.id`), which Naru signs in;
-- a `community_id` column is gone, since the site is one community.

-- The community's one row of settings (commung's `community`).
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL CHECK (length(name) > 0),
  description TEXT CHECK (description IS NULL OR length(description) <= 10000),
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  is_recruiting INTEGER NOT NULL DEFAULT 0 CHECK (is_recruiting IN (0, 1)),
  recruiting_starts_at INTEGER,
  recruiting_ends_at INTEGER,
  minimum_birth_year INTEGER CHECK (minimum_birth_year IS NULL OR minimum_birth_year >= 1900),
  mute_new_members INTEGER NOT NULL DEFAULT 0 CHECK (mute_new_members IN (0, 1)),
  show_all_replies INTEGER NOT NULL DEFAULT 0 CHECK (show_all_replies IN (0, 1)),
  bump_on_reply INTEGER NOT NULL DEFAULT 0 CHECK (bump_on_reply IN (0, 1)),
  auto_approve INTEGER NOT NULL DEFAULT 0 CHECK (auto_approve IN (0, 1)),
  theme_key_color TEXT CHECK (theme_key_color IS NULL OR theme_key_color GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
  banner_image_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (ends_at > starts_at)
);

CREATE TABLE community_links (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

-- Images: an upload to Naru Media (`id` is its upload ID) with the size the
-- page measured, since Naru does not record dimensions.
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  filename TEXT NOT NULL CHECK (length(filename) > 0),
  member TEXT,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);

-- Approved community members (commung's `membership`); one row each. The
-- site's owner claims the `owner` row by signing in as both owner and member.
CREATE TABLE members (
  member TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('owner', 'moderator', 'member')),
  application_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  activated_at INTEGER
);
CREATE INDEX members_role ON members (role);

CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  member TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  profile_name TEXT NOT NULL,
  profile_username TEXT NOT NULL,
  rejection_reason TEXT,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX applications_member ON applications (member, created_at);
CREATE INDEX applications_status ON applications (status, created_at);

CREATE TABLE application_attachments (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications (id),
  image_id TEXT NOT NULL REFERENCES images (id),
  created_at INTEGER NOT NULL
);
CREATE INDEX application_attachments_application ON application_attachments (application_id);

-- Blocks between members (commung's `user_block`).
CREATE TABLE member_blocks (
  blocker TEXT NOT NULL,
  blocked TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker, blocked)
);
CREATE INDEX member_blocks_blocked ON member_blocks (blocked);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) > 0 AND length(name) <= 100),
  username TEXT NOT NULL CHECK (length(username) > 0 AND length(username) <= 50 AND username NOT GLOB '*[^a-zA-Z0-9_]*'),
  bio TEXT,
  picture_id TEXT REFERENCES images (id),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  muted_at INTEGER,
  muted_by_id TEXT,
  online_status_visible INTEGER NOT NULL DEFAULT 1 CHECK (online_status_visible IN (0, 1)),
  activated_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
-- Usernames are unique among live profiles, case-insensitively as lookups are.
CREATE UNIQUE INDEX profiles_username ON profiles (lower(username)) WHERE deleted_at IS NULL;
CREATE INDEX profiles_created ON profiles (created_at);

-- Who may act as a profile: its owner, and admins the owner shares it with.
CREATE TABLE profile_owners (
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  member TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin')),
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  PRIMARY KEY (profile_id, member)
);
CREATE INDEX profile_owners_member ON profile_owners (member);

-- Last activity, apart from profiles so the heartbeat that writes it does not
-- run again every live query that reads profiles.
CREATE TABLE profile_activity (
  profile_id TEXT PRIMARY KEY REFERENCES profiles (id),
  last_active_at INTEGER NOT NULL
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '' CHECK (length(content) <= 10000),
  content_warning TEXT CHECK (content_warning IS NULL OR length(content_warning) <= 500),
  announcement INTEGER NOT NULL DEFAULT 0 CHECK (announcement IN (0, 1)),
  author_id TEXT NOT NULL REFERENCES profiles (id),
  created_by TEXT NOT NULL,
  in_reply_to_id TEXT REFERENCES posts (id),
  root_post_id TEXT REFERENCES posts (id),
  depth INTEGER NOT NULL DEFAULT 0 CHECK (depth >= 0),
  scheduled_at INTEGER,
  published_at INTEGER,
  pinned_at INTEGER,
  bumped_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  CHECK ((depth = 0 AND root_post_id IS NULL) OR (depth > 0 AND root_post_id IS NOT NULL))
);
CREATE INDEX posts_created ON posts (created_at);
CREATE INDEX posts_bumped ON posts (bumped_at);
CREATE INDEX posts_author ON posts (author_id, created_at);
CREATE INDEX posts_in_reply_to ON posts (in_reply_to_id, created_at);
CREATE INDEX posts_root ON posts (root_post_id, created_at);
CREATE INDEX posts_scheduled ON posts (scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX posts_announcement ON posts (announcement, created_at) WHERE announcement = 1;

CREATE TABLE post_images (
  post_id TEXT NOT NULL REFERENCES posts (id),
  image_id TEXT NOT NULL REFERENCES images (id),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, image_id)
);

CREATE TABLE post_reactions (
  post_id TEXT NOT NULL REFERENCES posts (id),
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, profile_id, emoji)
);
CREATE INDEX post_reactions_profile ON post_reactions (profile_id);

CREATE TABLE post_bookmarks (
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  post_id TEXT NOT NULL REFERENCES posts (id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (profile_id, post_id)
);
CREATE INDEX post_bookmarks_created ON post_bookmarks (profile_id, created_at);

CREATE TABLE post_history (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts (id),
  content TEXT NOT NULL,
  content_warning TEXT,
  -- The images the post had then: a JSON array of image IDs.
  image_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(image_ids)),
  edited_at INTEGER NOT NULL,
  edited_by_profile_id TEXT NOT NULL
);
CREATE INDEX post_history_post ON post_history (post_id, edited_at);

CREATE TABLE mentions (
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  post_id TEXT NOT NULL REFERENCES posts (id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (profile_id, post_id)
);
CREATE INDEX mentions_post ON mentions (post_id);

CREATE TABLE hashtags (
  tag TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
CREATE TABLE post_hashtags (
  post_id TEXT NOT NULL REFERENCES posts (id),
  tag TEXT NOT NULL REFERENCES hashtags (tag),
  PRIMARY KEY (post_id, tag)
);
CREATE INDEX post_hashtags_tag ON post_hashtags (tag);

-- Posts' text, for search (trigram: Korean of three characters or more).
-- Kept by the mutations that write posts.
CREATE VIRTUAL TABLE posts_search USING fts5 (post_id UNINDEXED, content, content_warning, tokenize = 'trigram');

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('reply', 'mention', 'reaction')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  recipient_id TEXT NOT NULL REFERENCES profiles (id),
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  post_id TEXT,
  direct_message_id TEXT,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX notifications_recipient ON notifications (recipient_id, created_at);
CREATE INDEX notifications_unread ON notifications (recipient_id) WHERE read_at IS NULL;

CREATE TABLE moderation_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('delete_post', 'mute_profile', 'unmute_profile')),
  description TEXT NOT NULL,
  moderator TEXT NOT NULL,
  target_member TEXT,
  target_profile_id TEXT,
  target_post_id TEXT,
  extra_data TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX moderation_log_created ON moderation_log (created_at);
