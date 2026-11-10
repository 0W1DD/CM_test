-- Achievements (modules/achievements.ts): each has three tiers, reached
-- once and kept. Progress is counted from what is already recorded (posts'
-- reactions, coins, check-ins, gifts, boxes, purchases), so nothing here but
-- the tiers reached. The last tier gives the achievement's badge (its
-- title), a row of `badges` tied to it by `achievement`.
CREATE TABLE achievement_tiers (
  profile_id TEXT NOT NULL REFERENCES profiles (id),
  achievement TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 3),
  reached_at INTEGER NOT NULL,
  PRIMARY KEY (profile_id, achievement, tier)
);

ALTER TABLE badges ADD COLUMN achievement TEXT;
CREATE UNIQUE INDEX badges_achievement ON badges (achievement)
  WHERE achievement IS NOT NULL;

INSERT INTO badges (id, name, emoji, description, created_at, updated_at, achievement) VALUES
  ('01900000-0000-7000-8000-0000000000a1', '리액션 장인', '💖', '업적 「좋아요 부탁드립니다」 Ⅲ단계', 0, 0, 'reactions'),
  ('01900000-0000-7000-8000-0000000000a2', '부르주아', '💰', '업적 「난 부자가 될거야」 Ⅲ단계', 0, 0, 'coins_earned'),
  ('01900000-0000-7000-8000-0000000000a3', '큰 손', '🛍️', '업적 「큰 손」 Ⅲ단계', 0, 0, 'coins_spent'),
  ('01900000-0000-7000-8000-0000000000a4', '개근상', '📅', '업적 「개근상」 Ⅲ단계', 0, 0, 'streak'),
  ('01900000-0000-7000-8000-0000000000a5', '베테랑', '🎖️', '업적 「이렇게나 오래됐어」 Ⅲ단계', 0, 0, 'check_ins'),
  ('01900000-0000-7000-8000-0000000000a6', '명예 산타', '🎅', '업적 「시켜줘 너의 명예 산타」 Ⅲ단계', 0, 0, 'gifts'),
  ('01900000-0000-7000-8000-0000000000a7', '착한 아이', '🎁', '업적 「착한 아이에게는 선물을...」 Ⅲ단계', 0, 0, 'boxes'),
  ('01900000-0000-7000-8000-0000000000a8', '바삭바삭', '🍪', '업적 「쿠키 먹기」 Ⅲ단계', 0, 0, 'cookies');

-- The nickname colour pass: an item that, used, colours its holder's name
-- for a week, with no staff confirmation. `name_colors` holds the colour
-- and when it ends.
ALTER TABLE shop_items ADD COLUMN name_color INTEGER NOT NULL DEFAULT 0
  CHECK (name_color IN (0, 1));

CREATE TABLE name_colors (
  profile_id TEXT PRIMARY KEY REFERENCES profiles (id),
  color TEXT NOT NULL,
  until INTEGER NOT NULL
);

INSERT INTO shop_items (id, name, description, price_amount, currency_id,
  consumable, is_unique, name_color, created_at, updated_at)
SELECT '01900000-0000-7000-8000-0000000000c1', '닉네임 색 변경권',
  '사용하면 고른 색으로 7일 동안 닉네임이 바뀝니다.', 10, c.id, 1, 0, 1, 0, 0
FROM shop_currencies c
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM shop_items i
                  WHERE lower(i.name) = lower('닉네임 색 변경권') AND i.deleted_at IS NULL)
ORDER BY c.is_default DESC, c.created_at
LIMIT 1;
