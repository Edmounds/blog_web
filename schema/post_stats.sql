CREATE TABLE IF NOT EXISTS post_stats (
  slug TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_view_events (
  slug TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (slug, visitor_hash, window_start)
);

CREATE INDEX IF NOT EXISTS post_view_events_window_idx
  ON post_view_events (window_start);
