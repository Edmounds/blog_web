-- Prefix legacy Blog keys so Blog and Note can safely share slugs.
-- If a prefixed row already exists, keep the canonical row and merge the old
-- aggregate before deleting the legacy key.
INSERT INTO post_stats (slug, views, likes, updated_at)
SELECT 'blog/' || slug, views, likes, updated_at
FROM post_stats
WHERE slug NOT LIKE '%/%'
ON CONFLICT(slug) DO UPDATE SET
  views = post_stats.views + excluded.views,
  likes = post_stats.likes + excluded.likes,
  updated_at = MAX(post_stats.updated_at, excluded.updated_at);

DELETE FROM post_stats
WHERE slug NOT LIKE '%/%';

INSERT OR IGNORE INTO post_view_events (slug, visitor_hash, window_start)
SELECT 'blog/' || slug, visitor_hash, window_start
FROM post_view_events
WHERE slug NOT LIKE '%/%';

DELETE FROM post_view_events
WHERE slug NOT LIKE '%/%';

UPDATE comments
SET slug = 'blog/' || slug
WHERE slug NOT LIKE '%/%';

-- blog/designing-for-clarity-in-chaos -> blog/20260128-01
INSERT INTO post_stats (slug, views, likes, updated_at)
SELECT 'blog/20260128-01', views, likes, updated_at
FROM post_stats
WHERE slug = 'blog/designing-for-clarity-in-chaos'
ON CONFLICT(slug) DO UPDATE SET
  views = post_stats.views + excluded.views,
  likes = post_stats.likes + excluded.likes,
  updated_at = MAX(post_stats.updated_at, excluded.updated_at);

DELETE FROM post_stats
WHERE slug = 'blog/designing-for-clarity-in-chaos';

INSERT OR IGNORE INTO post_view_events (slug, visitor_hash, window_start)
SELECT 'blog/20260128-01', visitor_hash, window_start
FROM post_view_events
WHERE slug = 'blog/designing-for-clarity-in-chaos';

DELETE FROM post_view_events
WHERE slug = 'blog/designing-for-clarity-in-chaos';

UPDATE comments
SET slug = 'blog/20260128-01'
WHERE slug = 'blog/designing-for-clarity-in-chaos';

-- blog/first-note -> blog/20260128-01
INSERT INTO post_stats (slug, views, likes, updated_at)
SELECT 'blog/20260128-01', views, likes, updated_at
FROM post_stats
WHERE slug = 'blog/first-note'
ON CONFLICT(slug) DO UPDATE SET
  views = post_stats.views + excluded.views,
  likes = post_stats.likes + excluded.likes,
  updated_at = MAX(post_stats.updated_at, excluded.updated_at);

DELETE FROM post_stats
WHERE slug = 'blog/first-note';

INSERT OR IGNORE INTO post_view_events (slug, visitor_hash, window_start)
SELECT 'blog/20260128-01', visitor_hash, window_start
FROM post_view_events
WHERE slug = 'blog/first-note';

DELETE FROM post_view_events
WHERE slug = 'blog/first-note';

UPDATE comments
SET slug = 'blog/20260128-01'
WHERE slug = 'blog/first-note';

-- note/arknights-p3r -> note/20260726-01
INSERT INTO post_stats (slug, views, likes, updated_at)
SELECT 'note/20260726-01', views, likes, updated_at
FROM post_stats
WHERE slug = 'note/arknights-p3r'
ON CONFLICT(slug) DO UPDATE SET
  views = post_stats.views + excluded.views,
  likes = post_stats.likes + excluded.likes,
  updated_at = MAX(post_stats.updated_at, excluded.updated_at);

DELETE FROM post_stats
WHERE slug = 'note/arknights-p3r';

INSERT OR IGNORE INTO post_view_events (slug, visitor_hash, window_start)
SELECT 'note/20260726-01', visitor_hash, window_start
FROM post_view_events
WHERE slug = 'note/arknights-p3r';

DELETE FROM post_view_events
WHERE slug = 'note/arknights-p3r';

UPDATE comments
SET slug = 'note/20260726-01'
WHERE slug = 'note/arknights-p3r';

-- note/dongyeguiwu-passaway -> note/20260727-01
INSERT INTO post_stats (slug, views, likes, updated_at)
SELECT 'note/20260727-01', views, likes, updated_at
FROM post_stats
WHERE slug = 'note/dongyeguiwu-passaway'
ON CONFLICT(slug) DO UPDATE SET
  views = post_stats.views + excluded.views,
  likes = post_stats.likes + excluded.likes,
  updated_at = MAX(post_stats.updated_at, excluded.updated_at);

DELETE FROM post_stats
WHERE slug = 'note/dongyeguiwu-passaway';

INSERT OR IGNORE INTO post_view_events (slug, visitor_hash, window_start)
SELECT 'note/20260727-01', visitor_hash, window_start
FROM post_view_events
WHERE slug = 'note/dongyeguiwu-passaway';

DELETE FROM post_view_events
WHERE slug = 'note/dongyeguiwu-passaway';

UPDATE comments
SET slug = 'note/20260727-01'
WHERE slug = 'note/dongyeguiwu-passaway';
