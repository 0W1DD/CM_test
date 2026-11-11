-- A profile's header background (cover), as on Twitter: a wide image behind
-- the top of its page, under a dark veil so the name stays readable.
-- Optional; without it the header keeps its colour.
ALTER TABLE profiles ADD COLUMN cover_id TEXT REFERENCES images (id);
