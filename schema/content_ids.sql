-- Prefix legacy Blog keys so Blog, Note, and Project can safely share slugs.
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

-- The first post now derives its public slug from first-note.md.
INSERT INTO post_stats (slug, views, likes, updated_at)
SELECT 'blog/first-note', views, likes, updated_at
FROM post_stats
WHERE slug = 'blog/designing-for-clarity-in-chaos'
ON CONFLICT(slug) DO UPDATE SET
  views = post_stats.views + excluded.views,
  likes = post_stats.likes + excluded.likes,
  updated_at = MAX(post_stats.updated_at, excluded.updated_at);

DELETE FROM post_stats
WHERE slug = 'blog/designing-for-clarity-in-chaos';

INSERT OR IGNORE INTO post_view_events (slug, visitor_hash, window_start)
SELECT 'blog/first-note', visitor_hash, window_start
FROM post_view_events
WHERE slug = 'blog/designing-for-clarity-in-chaos';

DELETE FROM post_view_events
WHERE slug = 'blog/designing-for-clarity-in-chaos';

UPDATE comments
SET slug = 'blog/first-note'
WHERE slug = 'blog/designing-for-clarity-in-chaos';
