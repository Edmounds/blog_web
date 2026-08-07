-- Follow-up migration for six books whose original Douban CDN objects reject browser-origin requests.
-- The replacement source IDs are official alternate editions with verified img9.doubanio.com covers.
WITH douban_mapping(id, source_id, cover_source_url) AS (
  VALUES
    ('29f0e508-64d3-475a-b8c8-7c1e80b8d71d', '27112607', 'https://img9.doubanio.com/view/subject/l/public/s30014645.jpg'),
    ('9c26bdf2-eb9c-4cf0-b12e-43173f0947ba', '26267087', 'https://img9.doubanio.com/view/subject/l/public/s28990296.jpg'),
    ('177ce75a-8372-4738-8766-81bd2cf7bb4c', '36952495', 'https://img9.doubanio.com/view/subject/l/public/s34945364.jpg'),
    ('f92e31ff-622f-41f1-b79f-0d6a58cee290', '4913064', 'https://img9.doubanio.com/view/subject/l/public/s29869926.jpg'),
    ('ac048000-cb82-4c31-a7a5-86284df87e45', '37824412', 'https://img9.doubanio.com/view/subject/l/public/s35297074.jpg'),
    ('68b34115-72df-466a-86f6-eab650a34471', '6985548', 'https://img9.doubanio.com/view/subject/l/public/s9747196.jpg')
)
UPDATE art_items
SET source_id = (SELECT source_id FROM douban_mapping WHERE douban_mapping.id = art_items.id),
    cover_source_url = (SELECT cover_source_url FROM douban_mapping WHERE douban_mapping.id = art_items.id),
    cover_key = NULL
WHERE source = 'douban_books'
  AND id IN (SELECT id FROM douban_mapping);
