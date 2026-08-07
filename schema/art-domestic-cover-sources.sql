-- One-time production migration. Run only after deploying code that accepts NULL cover_key values.
ALTER TABLE art_items RENAME COLUMN cover_key TO cover_key_required;
ALTER TABLE art_items ADD COLUMN cover_key TEXT;
UPDATE art_items SET cover_key = cover_key_required;
ALTER TABLE art_items DROP COLUMN cover_key_required;

WITH netease_mapping(id, source, source_id, cover_source_url) AS (
  VALUES
    ('cc5d2b61-93b2-4ba0-9dd1-30e81ec3e4e5', 'netease_album', '36709029', 'https://p1.music.126.net/fdh0myRe6FD87QNJtvGe_A==/109951163054654501.jpg'),
    ('5447eb3c-0a8e-4634-a4b6-d53fc7e8a81f', 'netease_album', '3029801', 'https://p1.music.126.net/3KDqQ9XW2Khj5Ia4tRqAAw==/18771962022688349.jpg'),
    ('6c288f76-b90d-4f78-84ad-eb480417deb2', 'netease_album', '80752440', 'https://p1.music.126.net/6CB6Jsmb7k7qiJqfMY5Row==/109951164260234943.jpg'),
    ('0e695373-0aba-42df-8aa6-d1d595448cdf', 'netease_album', '1770428', 'https://p1.music.126.net/WS5zt4tq5KBONXcAktO2lA==/109951169270236134.jpg'),
    ('7cd1d457-c898-47e4-8b50-d6938452bf8f', 'netease_album', '151018164', 'https://p1.music.126.net/hQcH8tJIQPoZTQDcFReiDA==/109951168214201927.jpg'),
    ('48dd0712-7b91-4aa5-be98-3f86d240bf55', 'netease_album', '1530458', 'https://p1.music.126.net/ZBOImauBJnubAysIexVvhA==/109951171770409475.jpg'),
    ('fd314562-5e59-4d21-82ed-f0cc99ebd0ff', 'netease_album', '2866097', 'https://p1.music.126.net/09q4e_zFRrfcxLAFYPDGfA==/109951167264500208.jpg'),
    ('ab9f7b1f-db9d-448d-a7e2-076770042b96', 'netease_album', '81096083', 'https://p1.music.126.net/o5OhUQkzYmWHi4rjx-n-PA==/109951170006345729.jpg'),
    ('05a2a7fa-39ae-4cd3-a9e2-ea71e20d7c01', 'netease_album', '35792020', 'https://p1.music.126.net/hexeB7rT6VUVezSMYbF9tA==/19072128695650801.jpg'),
    ('f9e09c4b-6cc4-401a-b8dd-4846b3a4c659', 'netease_album', '3270943', 'https://p1.music.126.net/TYYMm9RRtNhlWFt41Upyig==/109951163168817550.jpg'),
    ('bf863735-ec90-43b9-aec2-756866f6481d', 'netease_album', '16953', 'https://p1.music.126.net/Zg4XDfsiRi5vawjSWPP8Ng==/109951172899966259.jpg'),
    ('43a19ad9-86a3-4809-a935-cc50c957f786', 'netease_album', '96288984', 'https://p1.music.126.net/AkIsM0ZKSwa2Ly2Z-630_Q==/109951167720844252.jpg'),
    ('52beb3bd-7099-4160-a57f-cfdeb00448a1', 'netease_album', '21526', 'https://p1.music.126.net/lM-GxhQhNncu_nA9MGQHlQ==/109951169338473286.jpg'),
    ('0e0697af-227b-42a9-9f64-85a7cfb8ed4d', 'netease_album', '159294273', 'https://p1.music.126.net/EpF1BnPGrmPsTY0y64HBvA==/109951168278660931.jpg'),
    ('c9ac1233-e5dc-4e2d-97ec-6a81b812da98', 'netease_album', '3056517', 'https://p1.music.126.net/U3oZfHlbzrFxuR9Y9jOgkA==/109951168223454519.jpg'),
    ('bca2b026-7bd5-4159-8c13-6c22d5ac8c1f', 'netease_album', '134390294', 'https://p1.music.126.net/Db5cmWVoHFtQB01nrazKdw==/109951166498697363.jpg'),
    ('cab58672-1f5f-4bf8-9181-6060f7709e4f', 'netease_album', '35150843', 'https://p1.music.126.net/99_i681E6ZE74t_xue6PUA==/109951166151204092.jpg'),
    ('daf0851c-d3f0-485e-97a9-91a90fe510c1', 'netease_album', '134453600', 'https://p1.music.126.net/KdiJjqEenuXEO7Ax8nmozg==/109951167482882037.jpg'),
    ('13870caf-3abc-4b1d-a563-cb394a494d5b', 'netease_album', '74265645', 'https://p1.music.126.net/NntpAwdmeoD1szHvaNiGDA==/109951163650014211.jpg'),
    ('d4f98f35-224d-44a2-a9b9-185c424c432c', 'netease_album', '1770438', 'https://p1.music.126.net/GZERNplXUdzTPkKqo2F4tA==/109951169217536854.jpg'),
    ('3182fb6e-8426-4b0d-89bb-8a2de34122ab', 'netease_track', '1351913685', 'https://p1.music.126.net/fLdQ1aq-e9aaFhMwowbSRQ==/109951163926487545.jpg'),
    ('8033ed87-2bca-4471-b792-d950d34c7b09', 'netease_track', '565841054', 'https://p1.music.126.net/KKYFfAT5MWnpUEuU2xLQOg==/109951170609836057.jpg')
)
UPDATE art_items
SET source = (SELECT source FROM netease_mapping WHERE netease_mapping.id = art_items.id),
    source_id = (SELECT source_id FROM netease_mapping WHERE netease_mapping.id = art_items.id),
    cover_source_url = (SELECT cover_source_url FROM netease_mapping WHERE netease_mapping.id = art_items.id)
WHERE id IN (SELECT id FROM netease_mapping);

UPDATE art_items
SET cover_key = NULL
WHERE (source IN ('netease_album', 'netease_track') AND cover_source_url LIKE 'https://p%.music.126.net/%')
   OR (source = 'douban_books' AND cover_source_url LIKE 'https://img9.doubanio.com/%');
