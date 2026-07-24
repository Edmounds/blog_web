import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createArtItem, deleteArtItem, getArtItem, listArtItems, updateArtItem } from "../functions/_shared/art.js";
import { onRequestDelete } from "../functions/api/admin/art/items/[id].js";

test("D1 art CRUD preserves stable collection sorting, visibility, translations, and deletion", async () => {
  const db = new FakeD1();
  const base = {
    type: "book", source: "legacy", sourceId: "", isbn: "", originalTitle: "", releaseDate: "",
    isVisible: true, translations: { "zh-CN": { title: "第一本", creator: "作者", extra: "" } },
  };
  await createArtItem(db, { ...base, collectedOn: "2026-07-23" }, { key: "art/one/a.jpg", sourceUrl: "" }, { id: "one", now: new Date("2026-07-23T00:00:00Z") });
  await createArtItem(db, { ...base, collectedOn: "2026-07-24", translations: { "zh-CN": { title: "第二本", creator: "作者", extra: "" } } }, { key: "art/two/b.jpg", sourceUrl: "" }, { id: "two", now: new Date("2026-07-24T00:00:00Z") });
  assert.deepEqual((await listArtItems(db)).map((item) => item.id), ["two", "one"]);

  const current = await getArtItem(db, "two");
  const updated = await updateArtItem(db, "two", current, { isVisible: false, collectedOn: "2026-07-22" }, undefined, new Date("2026-07-25T00:00:00Z"));
  assert.equal(updated.isVisible, false);
  assert.equal(updated.translations["zh-CN"].title, "第二本");
  assert.deepEqual((await listArtItems(db, { visibleOnly: true })).map((item) => item.id), ["one"]);

  assert.equal(await deleteArtItem(db, "two"), true);
  assert.equal(await getArtItem(db, "two"), undefined);
});

test("admin deletion keeps D1 metadata when R2 cover deletion fails", async () => {
  const db = new FakeD1();
  const input = {
    type: "book", source: "legacy", sourceId: "", isbn: "", originalTitle: "", releaseDate: "",
    collectedOn: "2026-07-24", isVisible: true,
    translations: { "zh-CN": { title: "保留我", creator: "作者", extra: "" } },
  };
  await createArtItem(db, input, { key: "art/keep/a.jpg", sourceUrl: "" }, { id: "keep", now: new Date("2026-07-24T00:00:00Z") });

  const originalConsoleError = console.error;
  console.error = () => {};
  let response;
  try {
    response = await onRequestDelete({
      env: {
        DB: db,
        ART_COVERS: { delete: async () => { throw new Error("R2 unavailable"); } },
      },
      params: { id: "keep" },
      request: new Request("https://blog.muelsyse.us/api/admin/art/items/keep", {
        method: "DELETE",
        headers: { origin: "https://blog.muelsyse.us", "sec-fetch-site": "same-origin" },
      }),
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.status, 500);
  assert.ok(await getArtItem(db, "keep"));
});

test("art schema allows manual items without source IDs and rejects duplicate sourced items", () => {
  const schema = readFileSync(new URL("../schema/art.sql", import.meta.url), "utf8");
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_art_items_unique_source_id/);
  assert.match(schema, /ON art_items\(source, source_id\)/);
  assert.match(schema, /WHERE source_id IS NOT NULL/);
});

class FakeD1 {
  items = new Map();
  translations = new Map();
  prepare(sql) { return new FakeStatement(this, sql); }
  async batch(statements) { for (const statement of statements) await statement.run(); return statements.map(() => ({ success: true })); }
}

class FakeStatement {
  args = [];
  constructor(db, sql) { this.db = db; this.sql = sql.replace(/\s+/g, " ").trim(); }
  bind(...args) { this.args = args; return this; }
  async run() {
    if (this.sql.startsWith("INSERT INTO art_items")) {
      const [id, type, source, source_id, isbn, original_title, release_date, cover_key, cover_source_url, collected_on, is_visible, created_at, updated_at] = this.args;
      this.db.items.set(id, { id, type, source, source_id, isbn, original_title, release_date, cover_key, cover_source_url, collected_on, is_visible, created_at, updated_at });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("INSERT INTO art_item_translations")) {
      const [item_id, locale, title, creator, extra] = this.args;
      this.db.translations.set(`${item_id}:${locale}`, { item_id, locale, title, creator, extra });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("UPDATE art_items SET")) {
      const [type, source, source_id, isbn, original_title, release_date, cover_key, cover_source_url, collected_on, is_visible, updated_at, id] = this.args;
      const item = this.db.items.get(id); this.db.items.set(id, { ...item, type, source, source_id, isbn, original_title, release_date, cover_key, cover_source_url, collected_on, is_visible, updated_at });
      return { meta: { changes: item ? 1 : 0 } };
    }
    if (this.sql.startsWith("DELETE FROM art_item_translations")) {
      for (const key of this.db.translations.keys()) if (key.startsWith(`${this.args[0]}:`)) this.db.translations.delete(key);
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("DELETE FROM art_items")) {
      const changed = this.db.items.delete(this.args[0]);
      for (const key of this.db.translations.keys()) if (key.startsWith(`${this.args[0]}:`)) this.db.translations.delete(key);
      return { meta: { changes: changed ? 1 : 0 } };
    }
    throw new Error(`Unsupported run: ${this.sql}`);
  }
  async all() {
    if (!this.sql.includes("FROM art_items item")) throw new Error(`Unsupported all: ${this.sql}`);
    let rows = [...this.db.items.values()];
    if (this.sql.includes("WHERE item.id = ?")) rows = rows.filter((item) => item.id === this.args[0]);
    if (this.sql.includes("item.type = ?")) rows = rows.filter((item) => item.type === this.args[0]);
    if (this.sql.includes("item.is_visible = 1")) rows = rows.filter((item) => item.is_visible === 1);
    rows.sort((a, b) => b.collected_on.localeCompare(a.collected_on) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    const results = rows.flatMap((item) => {
      const translations = [...this.db.translations.values()].filter((entry) => entry.item_id === item.id);
      return translations.length ? translations.map((translation) => ({ ...item, ...translation })) : [{ ...item, locale: null }];
    });
    return { results };
  }
}
