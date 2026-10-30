-- Existing posts and replies all begin at the fireplace.
ALTER TABLE posts ADD COLUMN location TEXT NOT NULL DEFAULT 'fireplace'
  CHECK (location IN ('fireplace', 'kitchen', 'library', 'yard', 'attic'));
