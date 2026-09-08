ALTER TABLE art_items ADD COLUMN rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));
ALTER TABLE game_items ADD COLUMN rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));
