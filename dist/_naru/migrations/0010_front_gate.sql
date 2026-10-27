-- The front gate: what a visitor who is not a member yet sees on the
-- community's home, above the sign-in or apply button. The owner's HTML,
-- which the page sanitizes as it shows it, and a picture (an image
-- registered with images:register, as the banner is).
ALTER TABLE settings ADD COLUMN gate_html TEXT
  CHECK (gate_html IS NULL OR length(gate_html) <= 20000);
ALTER TABLE settings ADD COLUMN gate_image_id TEXT;
