-- The Christmas random box: a shop item marked random_box is bought at
-- most once a day per profile and, opened, gives one of the list in
-- modules/boxes.ts, kept in the profile's collection (도감).
ALTER TABLE shop_items ADD COLUMN random_box INTEGER NOT NULL DEFAULT 0
  CHECK (random_box IN (0, 1));

CREATE TABLE box_collection (
  profile_id TEXT NOT NULL,
  entry TEXT NOT NULL,
  category TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  first_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  PRIMARY KEY (profile_id, entry)
);
CREATE INDEX box_collection_recent ON box_collection (profile_id, last_at);
