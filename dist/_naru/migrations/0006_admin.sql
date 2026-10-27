-- Membership and admin: applications, members, moderation, links.

-- The profile an approval made or brought back for an application, so
-- approving it again after revoking reactivates that profile rather than
-- refusing its username as taken.
ALTER TABLE applications ADD COLUMN profile_id TEXT REFERENCES profiles (id);

-- Usernames pending applications hold, looked up case-insensitively.
CREATE INDEX applications_username ON applications (lower(profile_username), status);

-- The members list, newest first.
CREATE INDEX members_created ON members (created_at);

CREATE INDEX community_links_created ON community_links (created_at) WHERE deleted_at IS NULL;
