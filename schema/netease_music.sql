CREATE TABLE IF NOT EXISTS netease_weekly_ranking (
  rank INTEGER PRIMARY KEY CHECK (rank BETWEEN 1 AND 20),
  song_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  artists_json TEXT NOT NULL,
  cover_url TEXT,
  play_count INTEGER NOT NULL CHECK (play_count >= 0),
  score INTEGER NOT NULL CHECK (score >= 0),
  synced_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_netease_weekly_ranking_song
  ON netease_weekly_ranking(song_id);

CREATE TABLE IF NOT EXISTS netease_music_sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_attempt_at TEXT,
  last_success_at TEXT,
  last_synced_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

INSERT OR IGNORE INTO netease_music_sync_state (id, last_synced_count) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS netease_total_ranking (
  rank INTEGER PRIMARY KEY CHECK (rank BETWEEN 1 AND 50),
  song_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  artists_json TEXT NOT NULL,
  cover_url TEXT,
  play_count INTEGER NOT NULL CHECK (play_count >= 0),
  score INTEGER NOT NULL CHECK (score >= 0),
  synced_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_netease_total_ranking_song
  ON netease_total_ranking(song_id);

CREATE TABLE IF NOT EXISTS netease_total_ranking_sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_attempt_at TEXT,
  last_success_at TEXT,
  last_synced_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

INSERT OR IGNORE INTO netease_total_ranking_sync_state (id, last_synced_count) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS netease_auth_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  encrypted_cookie TEXT,
  cookie_iv TEXT,
  last_refresh_attempt_at TEXT,
  last_refresh_success_at TEXT,
  last_login_at TEXT,
  last_error_code TEXT,
  last_error TEXT,
  updated_at TEXT
);

INSERT OR IGNORE INTO netease_auth_state (id) VALUES (1);
