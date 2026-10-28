-- The use log: items members use from their inventory, kept apart from the
-- timeline. Each use waits for the staff to confirm it (approved_at). A
-- secret use shows only as a secret to others; its owner and the staff see
-- what it was. `item_name` keeps the name as it was when used.
CREATE TABLE item_uses (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  item_id TEXT NOT NULL REFERENCES shop_items (id),
  item_name TEXT NOT NULL,
  note TEXT CHECK (note IS NULL OR length(note) <= 500),
  secret INTEGER NOT NULL DEFAULT 0,
  consumed INTEGER NOT NULL DEFAULT 0,
  approved_at INTEGER,
  approved_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX item_uses_pending ON item_uses (approved_at, id);
