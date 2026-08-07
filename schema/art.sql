CREATE TABLE IF NOT EXISTS art_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('book', 'music', 'movie', 'series', 'anime')),
  music_kind TEXT CHECK (music_kind IN ('album', 'single')),
  source TEXT NOT NULL,
  source_id TEXT,
  isbn TEXT,
  original_title TEXT,
  release_date TEXT,
  cover_key TEXT,
  cover_source_url TEXT,
  collected_on TEXT NOT NULL,
  is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS art_item_translations (
  item_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('zh-CN', 'zh-TW', 'en', 'ja')),
  title TEXT NOT NULL,
  creator TEXT NOT NULL,
  extra TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (item_id, locale),
  FOREIGN KEY (item_id) REFERENCES art_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_art_items_public_sort
  ON art_items(is_visible, type, collected_on DESC, created_at DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_art_items_unique_source_id
  ON art_items(source, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_art_translations_item
  ON art_item_translations(item_id);
