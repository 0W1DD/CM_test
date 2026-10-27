-- Messages: direct messages between profiles and group chats (commung's
-- direct_message* and group_chat* tables). Senders, receivers and members
-- are profile IDs; `created_by` is the Naru member who wrote a message
-- (commung's created_by_user_id). Lists read only live rows, so their
-- indexes are partial on `deleted_at IS NULL`.

CREATE TABLE direct_messages (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '' CHECK (length(content) <= 10000),
  sender_id TEXT NOT NULL REFERENCES profiles (id),
  receiver_id TEXT NOT NULL REFERENCES profiles (id),
  created_by TEXT NOT NULL,
  read_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  CHECK (sender_id != receiver_id),
  CHECK (deleted_at IS NULL OR deleted_at >= created_at),
  CHECK (read_at IS NULL OR read_at >= created_at)
);
-- A conversation's thread, newest first.
CREATE INDEX direct_messages_conversation ON direct_messages (sender_id, receiver_id, created_at, id) WHERE deleted_at IS NULL;
-- A profile's conversations: its latest sent and received messages.
CREATE INDEX direct_messages_sent ON direct_messages (sender_id, created_at, id) WHERE deleted_at IS NULL;
CREATE INDEX direct_messages_received ON direct_messages (receiver_id, created_at, id) WHERE deleted_at IS NULL;
-- Unread counts.
CREATE INDEX direct_messages_unread ON direct_messages (receiver_id, sender_id) WHERE read_at IS NULL AND deleted_at IS NULL;

CREATE TABLE direct_message_images (
  message_id TEXT NOT NULL REFERENCES direct_messages (id),
  image_id TEXT NOT NULL REFERENCES images (id),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (message_id, image_id)
);

CREATE TABLE direct_message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES direct_messages (id),
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  emoji TEXT NOT NULL CHECK (length(emoji) > 0),
  created_at INTEGER NOT NULL,
  UNIQUE (message_id, profile_id, emoji)
);

-- Messages a profile deleted for itself only.
CREATE TABLE direct_message_deletions (
  message_id TEXT NOT NULL REFERENCES direct_messages (id),
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  deleted_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, profile_id)
);
CREATE INDEX direct_message_deletions_profile ON direct_message_deletions (profile_id, message_id);

CREATE TABLE group_chats (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) > 0 AND length(name) <= 100),
  created_by_id TEXT NOT NULL REFERENCES profiles (id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

-- A chat's members. `last_read_at` stands in for commung's per-message
-- group_chat_message_read rows: the member has read every message up to it.
CREATE TABLE group_chat_members (
  group_chat_id TEXT NOT NULL REFERENCES group_chats (id),
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  added_by_id TEXT REFERENCES profiles (id),
  last_read_at INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (group_chat_id, profile_id)
);
CREATE INDEX group_chat_members_profile ON group_chat_members (profile_id);
CREATE INDEX group_chat_members_order ON group_chat_members (group_chat_id, created_at);

CREATE TABLE group_chat_messages (
  id TEXT PRIMARY KEY,
  group_chat_id TEXT NOT NULL REFERENCES group_chats (id),
  sender_id TEXT NOT NULL REFERENCES profiles (id),
  created_by TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '' CHECK (length(content) <= 10000),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
-- A chat's history, newest first; also its last message and unread count.
CREATE INDEX group_chat_messages_history ON group_chat_messages (group_chat_id, created_at, id) WHERE deleted_at IS NULL;

CREATE TABLE group_chat_message_images (
  message_id TEXT NOT NULL REFERENCES group_chat_messages (id),
  image_id TEXT NOT NULL REFERENCES images (id),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (message_id, image_id)
);

CREATE TABLE group_chat_message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES group_chat_messages (id),
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  emoji TEXT NOT NULL CHECK (length(emoji) > 0),
  created_at INTEGER NOT NULL,
  UNIQUE (message_id, profile_id, emoji)
);

CREATE TABLE group_chat_message_deletions (
  message_id TEXT NOT NULL REFERENCES group_chat_messages (id),
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  deleted_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, profile_id)
);
CREATE INDEX group_chat_message_deletions_profile ON group_chat_message_deletions (profile_id, message_id);
