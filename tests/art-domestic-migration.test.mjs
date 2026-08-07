import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const schema = readFileSync(new URL("../schema/art.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../schema/art-domestic-cover-sources.sql", import.meta.url), "utf8");
const doubanAlternatesMigration = readFileSync(new URL("../schema/art-douban-cover-alternates.sql", import.meta.url), "utf8");

test("domestic cover migration maps all 22 Deezer records and makes cover keys nullable", () => {
  const mappedRows = migration.match(/^    \('[a-f0-9-]+', 'netease_(?:album|track)'/gm) ?? [];
  assert.equal(mappedRows.length, 22);

  const db = new DatabaseSync(":memory:");
  db.exec(schema.replace("cover_key TEXT,", "cover_key TEXT NOT NULL,"));
  const insert = db.prepare(`INSERT INTO art_items
    (id, type, music_kind, source, source_id, cover_key, cover_source_url, collected_on, is_visible, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, '2026-07-24', 1, '2026-07-24T00:00:00.000Z', '2026-07-24T00:00:00.000Z')`);
  insert.run("cc5d2b61-93b2-4ba0-9dd1-30e81ec3e4e5", "music", "album", "deezer_music", "52612062", "art/reputation.jpg", "https://cdn-images.dzcdn.net/reputation.jpg");
  insert.run("existing-music", "music", "single", "netease_track", "1", "art/song.jpg", "https://p1.music.126.net/song.jpg");
  insert.run("existing-book", "book", null, "douban_books", "2", "art/book.jpg", "https://img9.doubanio.com/book.jpg");
  insert.run("blocked-book", "book", null, "douban_books", "4", "art/blocked-book.jpg", "https://img1.doubanio.com/blocked-book.jpg");
  insert.run("foreign-cover", "movie", null, "tmdb", "3", "art/movie.jpg", "https://image.tmdb.org/movie.jpg");

  db.exec(migration);

  const columns = db.prepare("PRAGMA table_info(art_items)").all();
  assert.equal(columns.find((column) => column.name === "cover_key").notnull, 0);
  assert.deepEqual({ ...db.prepare("SELECT source, source_id, cover_key, cover_source_url FROM art_items WHERE id = ?").get("cc5d2b61-93b2-4ba0-9dd1-30e81ec3e4e5") }, {
    source: "netease_album",
    source_id: "36709029",
    cover_key: null,
    cover_source_url: "https://p1.music.126.net/fdh0myRe6FD87QNJtvGe_A==/109951163054654501.jpg",
  });
  assert.equal(db.prepare("SELECT cover_key FROM art_items WHERE id = 'existing-music'").get().cover_key, null);
  assert.equal(db.prepare("SELECT cover_key FROM art_items WHERE id = 'existing-book'").get().cover_key, null);
  assert.equal(db.prepare("SELECT cover_key FROM art_items WHERE id = 'blocked-book'").get().cover_key, "art/blocked-book.jpg");
  assert.equal(db.prepare("SELECT cover_key FROM art_items WHERE id = 'foreign-cover'").get().cover_key, "art/movie.jpg");
});

test("Douban alternate-edition migration moves all six blocked covers off R2", () => {
  const mappedRows = doubanAlternatesMigration.match(/^    \('[a-f0-9-]+', '\d+', 'https:\/\/img9\.doubanio\.com\//gm) ?? [];
  assert.equal(mappedRows.length, 6);

  const db = new DatabaseSync(":memory:");
  db.exec(schema);
  const insert = db.prepare(`INSERT INTO art_items
    (id, type, source, source_id, cover_key, cover_source_url, collected_on, is_visible, created_at, updated_at)
    VALUES (?, 'book', 'douban_books', ?, ?, ?, '2026-07-24', 1, '2026-07-24T00:00:00.000Z', '2026-07-24T00:00:00.000Z')`);
  insert.run(
    "29f0e508-64d3-475a-b8c8-7c1e80b8d71d",
    "10554308",
    "art/white-night.jpg",
    "https://img1.doubanio.com/view/subject/l/public/s24514468.jpg",
  );
  insert.run("unrelated-book", "1", "art/unrelated.jpg", "https://img1.doubanio.com/unrelated.jpg");

  db.exec(doubanAlternatesMigration);

  assert.deepEqual({ ...db.prepare("SELECT source_id, cover_key, cover_source_url FROM art_items WHERE id = ?").get("29f0e508-64d3-475a-b8c8-7c1e80b8d71d") }, {
    source_id: "27112607",
    cover_key: null,
    cover_source_url: "https://img9.doubanio.com/view/subject/l/public/s30014645.jpg",
  });
  assert.equal(db.prepare("SELECT cover_key FROM art_items WHERE id = 'unrelated-book'").get().cover_key, "art/unrelated.jpg");
});
