import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../scripts/migrate-art-to-d1.mjs", import.meta.url), "utf8");
const legacy = readFileSync(new URL("../scripts/lib/legacy-art-data.mjs", import.meta.url), "utf8");

test("legacy migration is idempotent and preserves the 19 existing entries", () => {
  assert.match(migration, /itemExists\(item\.id\)/);
  assert.match(migration, /INSERT OR IGNORE INTO art_items/);
  assert.match(migration, /INSERT OR IGNORE INTO art_item_translations/);
  assert.match(migration, /SELECT COUNT\(\*\) AS items/);
  assert.equal((legacy.match(/id: "/g) ?? []).length, 19);
});

test("migration assigns the first item in each category today and decrements dates", () => {
  assert.match(migration, /subtractDays\(new Date\(\), index\)/);
  assert.match(migration, /const TYPE_GROUPS = \["book", "music", "movie", "series", "anime"\]/);
});

test("legacy migration translates only books and movies", () => {
  assert.match(migration, /const TRANSLATED_TYPES = new Set\(\["book", "movie"\]\)/);
  assert.match(migration, /if \(TRANSLATED_TYPES\.has\(item\.type\)\)/);
});
