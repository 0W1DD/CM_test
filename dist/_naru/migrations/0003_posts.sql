-- Posts: what the timeline, profiles and reports need beyond 0001.

-- Reports of posts. commung emailed them to its platform's admins; here they
-- are kept, and the community's owner and moderators are notified.
CREATE TABLE post_reports (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts (id),
  reporter_profile_id TEXT NOT NULL REFERENCES profiles (id),
  reporter_member TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) > 0 AND length(reason) <= 2000),
  created_at INTEGER NOT NULL
);
CREATE INDEX post_reports_created ON post_reports (created_at);
CREATE INDEX post_reports_post ON post_reports (post_id);

-- The timeline: root posts newest first, or by their last reply (bump_on_reply).
CREATE INDEX posts_timeline ON posts (depth, id);
CREATE INDEX posts_timeline_bumped ON posts (depth, bumped_at, id);
-- A profile's pinned posts (at most three).
CREATE INDEX posts_pinned ON posts (author_id, pinned_at) WHERE pinned_at IS NOT NULL;
-- Scheduled posts not yet published, for publishDue.
CREATE INDEX posts_due ON posts (scheduled_at) WHERE published_at IS NULL AND scheduled_at IS NOT NULL;
