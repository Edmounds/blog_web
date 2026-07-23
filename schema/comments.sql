CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  device_label TEXT NOT NULL,
  region_label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
  hidden_at TEXT
);

CREATE INDEX IF NOT EXISTS comments_slug_visibility_id_idx
  ON comments (slug, is_hidden, id DESC);

CREATE TABLE IF NOT EXISTS comment_rate_limits (
  visitor_hash TEXT PRIMARY KEY,
  last_submitted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS comment_rate_limits_submitted_idx
  ON comment_rate_limits (last_submitted_at);
