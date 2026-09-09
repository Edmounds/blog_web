CREATE TABLE IF NOT EXISTS game_items (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('steam', 'manual')),
  steam_app_id INTEGER,
  title TEXT NOT NULL,
  steam_playtime_minutes INTEGER NOT NULL DEFAULT 0 CHECK (steam_playtime_minutes >= 0),
  custom_playtime_minutes INTEGER CHECK (custom_playtime_minutes IS NULL OR custom_playtime_minutes >= 0),
  is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)),
  cover_key TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((source = 'steam' AND steam_app_id IS NOT NULL) OR (source = 'manual' AND steam_app_id IS NULL)),
  CHECK (source = 'steam' OR custom_playtime_minutes IS NOT NULL),
  CHECK (source = 'steam' OR cover_key IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_items_steam_app_id
  ON game_items(steam_app_id)
  WHERE steam_app_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_game_items_visible_playtime
  ON game_items(is_visible, custom_playtime_minutes, steam_playtime_minutes, title);

CREATE TABLE IF NOT EXISTS game_sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_attempt_at TEXT,
  last_success_at TEXT,
  last_synced_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

INSERT OR IGNORE INTO game_sync_state (id, last_synced_count) VALUES (1, 0);
