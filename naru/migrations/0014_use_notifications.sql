-- Notifications about the use log beside those about posts: an item handed
-- to you ('gift'), your use or transfer confirmed ('use_approved'), and, for
-- the staff, a new entry waiting for them ('use_request'). `use_id` names
-- the entry. The table is made again for its type check.
CREATE TABLE notifications_new (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('reply', 'mention', 'reaction', 'gift', 'use_approved', 'use_request')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  recipient_id TEXT NOT NULL REFERENCES profiles (id),
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  post_id TEXT,
  direct_message_id TEXT,
  use_id TEXT,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
INSERT INTO notifications_new (id, type, title, message, recipient_id,
  profile_id, post_id, direct_message_id, read_at, created_at)
SELECT id, type, title, message, recipient_id, profile_id, post_id,
  direct_message_id, read_at, created_at
FROM notifications;
DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;
CREATE INDEX notifications_recipient ON notifications (recipient_id, created_at);
CREATE INDEX notifications_unread ON notifications (recipient_id) WHERE read_at IS NULL;
CREATE INDEX notifications_use ON notifications (use_id) WHERE use_id IS NOT NULL;
