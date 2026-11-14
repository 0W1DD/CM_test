-- Identify the existing system bot by its saved profile ID: @bot may be a member.
INSERT INTO profile_owners (profile_id, member, role, created_at, created_by)
SELECT p.id, m.member, 'owner', m.updated_at, m.member
FROM settings s
JOIN profiles p ON p.id = s.command_bot_profile_id AND p.deleted_at IS NULL
JOIN members m ON m.role = 'owner'
WHERE s.id = 1
ON CONFLICT (profile_id, member) DO UPDATE SET role = 'owner';
