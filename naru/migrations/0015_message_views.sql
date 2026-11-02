-- The owner may read any two profiles' direct messages (the community
-- tells its members beforehand). Each time a conversation is opened it is
-- written here: who read it (the owner's acting profile) and whose it was.
CREATE TABLE message_views (
  id TEXT PRIMARY KEY,
  viewer_profile_id TEXT NOT NULL REFERENCES profiles (id),
  viewer_member TEXT NOT NULL,
  profile_a TEXT NOT NULL REFERENCES profiles (id),
  profile_b TEXT NOT NULL REFERENCES profiles (id),
  created_at INTEGER NOT NULL
);
CREATE INDEX message_views_created ON message_views (created_at);
