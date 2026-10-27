-- Slash commands are built in and always on: the installed apps and their
-- command rows go, and one bot profile, which the commands make when they
-- first reply, posts every reply.
ALTER TABLE settings ADD COLUMN command_bot_profile_id TEXT REFERENCES profiles (id);
DROP TABLE bot_commands;
DROP TABLE installed_apps;
