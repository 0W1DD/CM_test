-- Badges (뱃지): the staff make them (name, emoji, description) and give
-- them to profiles; each profile may feature one, shown by its name.
CREATE TABLE badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 30),
  emoji TEXT NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  description TEXT CHECK (description IS NULL OR length(description) <= 200),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE profile_badges (
  profile_id TEXT NOT NULL,
  badge_id TEXT NOT NULL REFERENCES badges (id) ON DELETE CASCADE,
  featured INTEGER NOT NULL DEFAULT 0,
  granted_at INTEGER NOT NULL,
  granted_by TEXT,
  PRIMARY KEY (profile_id, badge_id)
);
CREATE INDEX profile_badges_badge ON profile_badges (badge_id);
CREATE INDEX profile_badges_featured ON profile_badges (featured) WHERE featured = 1;

-- The first badge, for those here in the first week.
INSERT INTO badges (id, name, emoji, description, created_at, updated_at)
VALUES ('01900000-0000-7000-8000-000000000001', '첫 주를 함께한', '🎄',
        '커뮤의 첫 주를 함께한 분께 드리는 뱃지입니다.', 0, 0);
