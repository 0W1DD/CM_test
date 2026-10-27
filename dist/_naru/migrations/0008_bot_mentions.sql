-- Slash command posts, newest first, for bot:mentions to find the commands
-- no built-in command answers without reading every post.
CREATE INDEX posts_slash ON posts (id) WHERE substr(content, 1, 1) = '/';
