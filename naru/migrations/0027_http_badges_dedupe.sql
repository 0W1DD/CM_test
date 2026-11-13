-- The HTTP status code badges (0026) repeated codes the staff had already
-- made by hand. Keep the hand-made ones, and drop each 0026 badge whose
-- code (its "[200]" icon) a hand-made badge already has.
DELETE FROM profile_badges
WHERE badge_id IN (
  SELECT b.id FROM badges b
  WHERE b.id LIKE '01900000-0000-7000-8000-0000c0de0%'
    AND EXISTS (
      SELECT 1 FROM badges o
      WHERE o.emoji = b.emoji
        AND o.id NOT LIKE '01900000-0000-7000-8000-0000c0de0%'));

DELETE FROM badges
WHERE id LIKE '01900000-0000-7000-8000-0000c0de0%'
  AND EXISTS (
    SELECT 1 FROM badges o
    WHERE o.emoji = badges.emoji
      AND o.id NOT LIKE '01900000-0000-7000-8000-0000c0de0%');
