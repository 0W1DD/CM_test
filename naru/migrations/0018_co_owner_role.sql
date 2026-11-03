-- Sub-owners (부소유자): members who may do what the owner does, except
-- hand the community over or change or remove the owner. SQLite cannot
-- change a CHECK, so the table is rebuilt with `co_owner` allowed.
CREATE TABLE members_new (
  member TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('owner', 'co_owner', 'moderator', 'member')),
  application_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  activated_at INTEGER
);
INSERT INTO members_new (member, role, application_id, created_at, updated_at, activated_at)
  SELECT member, role, application_id, created_at, updated_at, activated_at FROM members;
DROP TABLE members;
ALTER TABLE members_new RENAME TO members;
CREATE INDEX members_role ON members (role);
CREATE INDEX members_created ON members (created_at);
