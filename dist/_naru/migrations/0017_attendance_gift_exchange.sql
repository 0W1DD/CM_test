-- Daily check-in and the weekly gift exchange (modules/events.ts). Days and
-- weeks are Korean dates (UTC+9) as text: a check-in's day, and a week's
-- Monday.

-- One check-in per profile per day, each worth a coin.
CREATE TABLE attendance (
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (profile_id, day)
);

-- A week of the gift exchange: when its recipients were drawn and when its
-- senders were paid, each done once.
CREATE TABLE gift_weeks (
  week TEXT PRIMARY KEY,
  assigned_at INTEGER,
  paid_at INTEGER
);

-- A profile signed up for a week's exchange, the one it gives to (drawn at
-- random, or `pinned` by the staff) and the gift it wrote.
CREATE TABLE gift_entries (
  week TEXT NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  recipient_id TEXT REFERENCES profiles (id),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  content TEXT CHECK (content IS NULL OR length(content) <= 5000),
  submitted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (week, profile_id),
  CHECK (recipient_id IS NULL OR recipient_id != profile_id)
);
CREATE INDEX gift_entries_recipient ON gift_entries (week, recipient_id);

CREATE TABLE gift_images (
  week TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  image_id TEXT NOT NULL REFERENCES images (id),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (week, profile_id, image_id)
);
