-- The random box's book (도감) is the community's, not each profile's:
-- what a box gives goes into the opener's inventory as an item (box_entry,
-- kept out of the shop's list), and whoever holds one may register it.
-- The first to register an entry is kept as its finder.
ALTER TABLE shop_items ADD COLUMN box_entry INTEGER NOT NULL DEFAULT 0
  CHECK (box_entry IN (0, 1));

CREATE TABLE box_registry (
  entry TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  registered_at INTEGER NOT NULL
);
CREATE INDEX box_registry_recent ON box_registry (registered_at);

DROP TABLE box_collection;
