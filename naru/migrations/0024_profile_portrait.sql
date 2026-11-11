-- A profile's big picture (portrait): a tall image that fills the left of
-- its page's header in place of the small round picture. Optional; the
-- round picture stays for posts and lists.
ALTER TABLE profiles ADD COLUMN portrait_id TEXT REFERENCES images (id);
