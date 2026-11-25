-- What a random box gives may be donated to the shared space (공용공간):
-- it leaves the inventory for good, and the use log keeps it as a
-- donation. It is a use with `donated` set, as SQLite cannot change the
-- `kind` check without rebuilding the table the comments point at.
ALTER TABLE item_uses ADD COLUMN donated INTEGER NOT NULL DEFAULT 0
  CHECK (donated IN (0, 1));
