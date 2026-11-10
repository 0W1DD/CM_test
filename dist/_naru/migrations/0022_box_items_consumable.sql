-- What the random box gives is used up when used (a consumable), not only
-- shown: the items already made from it change over too.
UPDATE shop_items SET consumable = 1 WHERE box_entry = 1;
