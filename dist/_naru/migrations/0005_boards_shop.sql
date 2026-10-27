-- The community's boards (commung's community_board*), its shop (shop_*),
-- installed apps and their slash commands (installed_app, bot_command), and
-- bots with their API tokens (bot, bot_token). IDs are UUIDv7 strings made
-- in site code; times are INTEGER milliseconds; flags INTEGER 0/1; members
-- are Naru member IDs.

-- Boards: titled posts with threaded replies, apart from the timeline.
CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) > 0 AND length(name) <= 100),
  slug TEXT NOT NULL CHECK (length(slug) > 0 AND length(slug) <= 100 AND slug NOT GLOB '*[^a-z0-9-]*'),
  description TEXT CHECK (description IS NULL OR length(description) <= 1000),
  allow_comments INTEGER NOT NULL DEFAULT 1 CHECK (allow_comments IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX boards_slug ON boards (slug) WHERE deleted_at IS NULL;

CREATE TABLE board_posts (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards (id),
  author_id TEXT NOT NULL REFERENCES profiles (id),
  title TEXT NOT NULL CHECK (length(title) > 0 AND length(title) <= 200),
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 50000),
  image_id TEXT REFERENCES images (id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX board_posts_board ON board_posts (board_id, id) WHERE deleted_at IS NULL;

CREATE TABLE board_replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES board_posts (id),
  author_id TEXT NOT NULL REFERENCES profiles (id),
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 10000),
  in_reply_to_id TEXT REFERENCES board_replies (id),
  depth INTEGER NOT NULL DEFAULT 0,
  root_reply_id TEXT REFERENCES board_replies (id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  CHECK ((in_reply_to_id IS NULL AND depth = 0) OR (in_reply_to_id IS NOT NULL AND depth > 0)),
  CHECK ((depth = 0 AND root_reply_id IS NULL) OR (depth > 0 AND root_reply_id IS NOT NULL))
);
CREATE INDEX board_replies_post ON board_replies (post_id, depth, id);
CREATE INDEX board_replies_root ON board_replies (root_reply_id, created_at);
CREATE INDEX board_replies_in_reply_to ON board_replies (in_reply_to_id);

-- Replies to a member's board post or reply (commung's user_notification of
-- type board_reply): kept for the member, not a profile.
CREATE TABLE board_notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'board_reply' CHECK (type IN ('board_reply')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  recipient TEXT NOT NULL,
  actor_profile_id TEXT REFERENCES profiles (id),
  post_id TEXT NOT NULL REFERENCES board_posts (id),
  reply_id TEXT REFERENCES board_replies (id),
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX board_notifications_recipient ON board_notifications (recipient, id);
CREATE INDEX board_notifications_unread ON board_notifications (recipient) WHERE read_at IS NULL;

-- The shop: currencies, what profiles hold of them, items for sale, what
-- profiles own, and every change as a transaction.
CREATE TABLE shop_currencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) > 0 AND length(name) <= 50),
  description TEXT CHECK (description IS NULL OR length(description) <= 500),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX shop_currencies_name ON shop_currencies (lower(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX shop_currencies_default ON shop_currencies (is_default) WHERE is_default = 1 AND deleted_at IS NULL;

CREATE TABLE shop_balances (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  currency_id TEXT NOT NULL REFERENCES shop_currencies (id),
  amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  updated_at INTEGER NOT NULL,
  UNIQUE (profile_id, currency_id)
);

CREATE TABLE shop_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) > 0 AND length(name) <= 100),
  description TEXT CHECK (description IS NULL OR length(description) <= 1000),
  price_amount INTEGER NOT NULL CHECK (price_amount > 0),
  currency_id TEXT NOT NULL REFERENCES shop_currencies (id),
  consumable INTEGER NOT NULL DEFAULT 0 CHECK (consumable IN (0, 1)),
  is_unique INTEGER NOT NULL DEFAULT 0 CHECK (is_unique IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX shop_items_name ON shop_items (lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE shop_inventory (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  item_id TEXT NOT NULL REFERENCES shop_items (id),
  qty INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  granted_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (profile_id, item_id)
);

CREATE TABLE shop_transactions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  kind TEXT NOT NULL CHECK (kind IN ('currency_grant', 'currency_charge', 'currency_refund', 'item_grant', 'item_purchase', 'item_consume')),
  source TEXT NOT NULL CHECK (source IN ('owner_grant', 'bot_grant', 'post_reward', 'purchase', 'consume', 'refund')),
  currency_id TEXT REFERENCES shop_currencies (id),
  currency_delta INTEGER,
  item_id TEXT REFERENCES shop_items (id),
  item_qty_delta INTEGER,
  reason TEXT CHECK (reason IS NULL OR length(reason) <= 500),
  actor_member TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX shop_transactions_profile ON shop_transactions (profile_id, id);

-- Apps installed from the built-in catalog, each acting as its own bot
-- profile, and the slash commands they answer.
CREATE TABLE installed_apps (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  builtin_id TEXT NOT NULL CHECK (length(builtin_id) > 0 AND length(builtin_id) <= 50),
  version TEXT NOT NULL CHECK (length(version) > 0 AND length(version) <= 50),
  config TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(config)),
  installed_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX installed_apps_builtin ON installed_apps (builtin_id) WHERE deleted_at IS NULL;

CREATE TABLE bot_commands (
  id TEXT PRIMARY KEY,
  installed_app_id TEXT NOT NULL REFERENCES installed_apps (id),
  name TEXT NOT NULL CHECK (length(name) > 0 AND length(name) <= 31),
  description TEXT CHECK (description IS NULL OR length(description) <= 1000),
  handler_builtin_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX bot_commands_name ON bot_commands (lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX bot_commands_app ON bot_commands (installed_app_id);

-- Bots: a profile the owner's programs post as with a token.
CREATE TABLE bots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) > 0 AND length(name) <= 100),
  description TEXT CHECK (description IS NULL OR length(description) <= 1000),
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

-- A token is "<id>.<secret>", shown once; only the secret's hash is kept
-- (ctx.passwords.hash), checked with ctx.passwords.verify.
CREATE TABLE bot_tokens (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots (id),
  hash TEXT NOT NULL,
  name TEXT CHECK (name IS NULL OR length(name) <= 100),
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER,
  last_used_at INTEGER
);
CREATE INDEX bot_tokens_bot ON bot_tokens (bot_id, created_at);
