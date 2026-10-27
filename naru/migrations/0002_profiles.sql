-- Profiles area: which profile a block was made from, so the blocker's list
-- names the blocked member by the profile they saw (member IDs stay hidden).
ALTER TABLE member_blocks ADD COLUMN profile_id TEXT REFERENCES profiles (id);
CREATE INDEX member_blocks_blocker ON member_blocks (blocker, created_at);
