-- The site owner's own look, beside the theme colour: 사용자 CSS, kept in the
-- database so a template update leaves it, and whether the page loads the
-- site's /_owner/style.css and /_owner/script.js, Naru's folder that no
-- template or update touches.
--
-- The table is made again for theme_key_color's check: 0001's GLOB pattern
-- is longer than Naru's SQLite allows ("LIKE or GLOB pattern too complex"),
-- so no colour could be saved. This one takes the same #rrggbb without one.
CREATE TABLE settings_new (
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
  theme_key_color TEXT CHECK (
    theme_key_color IS NULL OR (
      length(theme_key_color) = 7 AND substr(theme_key_color, 1, 1) = '#'
      AND ltrim(lower(substr(theme_key_color, 2)), '0123456789abcdef') = ''
    )
  ),
  banner_image_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  command_bot_profile_id TEXT REFERENCES profiles (id),
  custom_css TEXT CHECK (custom_css IS NULL OR length(custom_css) <= 50000),
  owner_files INTEGER NOT NULL DEFAULT 0 CHECK (owner_files IN (0, 1)),
  CHECK (ends_at > starts_at)
);
INSERT INTO settings_new (id, name, description, starts_at, ends_at,
  is_recruiting, recruiting_starts_at, recruiting_ends_at, minimum_birth_year,
  mute_new_members, show_all_replies, bump_on_reply, auto_approve,
  theme_key_color, banner_image_id, created_at, updated_at,
  command_bot_profile_id)
SELECT id, name, description, starts_at, ends_at, is_recruiting,
  recruiting_starts_at, recruiting_ends_at, minimum_birth_year,
  mute_new_members, show_all_replies, bump_on_reply, auto_approve,
  theme_key_color, banner_image_id, created_at, updated_at,
  command_bot_profile_id
FROM settings;
DROP TABLE settings;
ALTER TABLE settings_new RENAME TO settings;
