-- The use log also records items handed to another profile (`kind`
-- 'transfer', with `target_profile_id` and `qty`), and members comment
-- under each entry, as under a post: what happened next, or a bot's answer.
ALTER TABLE item_uses ADD COLUMN kind TEXT NOT NULL DEFAULT 'use'
  CHECK (kind IN ('use', 'transfer'));
ALTER TABLE item_uses ADD COLUMN target_profile_id TEXT REFERENCES profiles (id);
ALTER TABLE item_uses ADD COLUMN qty INTEGER NOT NULL DEFAULT 1;

CREATE TABLE item_use_comments (
  id TEXT PRIMARY KEY,
  use_id TEXT NOT NULL REFERENCES item_uses (id),
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
  created_at INTEGER NOT NULL
);
CREATE INDEX item_use_comments_use ON item_use_comments (use_id, id);
