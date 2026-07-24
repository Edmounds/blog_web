import assert from "node:assert/strict";
import test from "node:test";

import {
  assertResolvedPublicAddress, fetchRemoteImage, getArtCoverUrl, getShanghaiDate, localizeArtItems,
  parsePublicHttpsUrl, validateArtItemInput,
} from "../functions/_shared/art.js";
import { onRequestGet as previewCover } from "../functions/api/admin/art/cover-preview.js";
import { onRequestDelete as deleteCover, onRequestPost as uploadCover } from "../functions/api/admin/art/covers.js";
import { onRequestGet as listItems, onRequestPost as createItem } from "../functions/api/admin/art/items.js";

test("art input validates types, dates, translations, and required covers", () => {
  const result = validateArtItemInput({
    type: "book", source: "apple_books", sourceId: "1", isbn: "978-7-5442-5821-0", originalTitle: "秘密", releaseDate: "1998",
    collectedOn: "2026-07-24", isVisible: true, cover: { kind: "url", url: "https://example.com/cover.jpg" },
    translations: { "zh-CN": { title: "秘密", creator: "东野圭吾", extra: "备注" } },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.isbn, "9787544258210");
  assert.equal(validateArtItemInput({ ...result.value, collectedOn: "2026-02-30" }).ok, false);
  assert.equal(validateArtItemInput({ ...result.value, type: "game" }).ok, false);
});

test("art input accepts Deezer album candidates", () => {
  const result = validateArtItemInput({
    type: "music", source: "deezer_music", sourceId: "12", isbn: "", originalTitle: "Abbey Road", releaseDate: "1969-09-26",
    collectedOn: "2026-07-24", isVisible: true, cover: { kind: "url", url: "https://deezer.test/cover.jpg" },
    translations: {
      "zh-CN": { title: "Abbey Road", creator: "The Beatles", extra: "" },
      en: { title: "Abbey Road", creator: "The Beatles", extra: "Classic rock" },
      ja: { title: "アビイ・ロード", creator: "ビートルズ", extra: "" },
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.value.translations), ["zh-CN"]);
});

test("books and movies retain all supported translation locales", () => {
  for (const type of ["book", "movie"]) {
    const result = validateArtItemInput({
      type, source: type === "book" ? "apple_books" : "tmdb", sourceId: "12", isbn: "", originalTitle: "标题", releaseDate: "2026",
      collectedOn: "2026-07-24", isVisible: true, cover: { kind: "url", url: "https://example.com/cover.jpg" },
      translations: {
        "zh-CN": { title: "标题", creator: "作者", extra: "备注" },
        "zh-TW": { title: "標題", creator: "作者", extra: "備註" },
        en: { title: "Title", creator: "Creator", extra: "Note" },
        ja: { title: "タイトル", creator: "作者", extra: "メモ" },
      },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(Object.keys(result.value.translations), ["zh-CN", "zh-TW", "en", "ja"]);
  }
});

test("partial art input filters translations using the current or replacement type", () => {
  const translations = {
    "zh-CN": { title: "标题", creator: "作者", extra: "备注" },
    en: { title: "Title", creator: "Creator", extra: "Note" },
  };
  const currentMusic = validateArtItemInput({ translations }, { partial: true, currentType: "music" });
  const switchedToAnime = validateArtItemInput({ type: "anime", translations }, { partial: true, currentType: "book" });
  const currentBook = validateArtItemInput({ translations }, { partial: true, currentType: "book" });

  assert.deepEqual(Object.keys(currentMusic.value.translations), ["zh-CN"]);
  assert.deepEqual(Object.keys(switchedToAnime.value.translations), ["zh-CN"]);
  assert.deepEqual(Object.keys(currentBook.value.translations), ["zh-CN", "en"]);
});

test("admin art lists are never served from browser or shared caches", async () => {
  const response = await listItems({
    env: {
      DB: {
        prepare() {
          return { bind: () => ({ all: async () => ({ results: [] }) }) };
        },
      },
    },
    request: new Request("https://blog.muelsyse.us/api/admin/art/items?type=book"),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { items: [] });
});

test("public localization falls back to simplified Chinese", () => {
  const item = { id: "1", type: "book", coverUrl: "https://img.muelsyse.us/art/1/a.jpg", translations: { "zh-CN": { title: "标题", creator: "作者", extra: "备注" } } };
  assert.deepEqual(localizeArtItems([item], "ja"), [{ id: "1", type: "book", title: "标题", creator: "作者", extra: "备注", cover: "https://img.muelsyse.us/art/1/a.jpg" }]);
});

test("art cover keys resolve to the public R2 image domain", () => {
  assert.equal(getArtCoverUrl("art/one/cover.webp"), "https://img.muelsyse.us/art/one/cover.webp");
});

test("Shanghai default date is independent of UTC day", () => {
  assert.equal(getShanghaiDate(new Date("2026-07-23T16:30:00Z")), "2026-07-24");
});

test("cover URL validation rejects private and non-HTTPS addresses", () => {
  assert.throws(() => parsePublicHttpsUrl("http://example.com/cover.jpg"), Response);
  assert.throws(() => parsePublicHttpsUrl("https://127.0.0.1/cover.jpg"), Response);
  assert.throws(() => parsePublicHttpsUrl("https://192.168.1.2/cover.jpg"), Response);
  assert.equal(parsePublicHttpsUrl("https://images.example.com/cover.jpg").hostname, "images.example.com");
  assert.throws(() => assertResolvedPublicAddress("10.0.0.5"), Response);
  assert.throws(() => assertResolvedPublicAddress("fd00::1"), Response);
  assert.equal(assertResolvedPublicAddress("8.8.8.8"), "8.8.8.8");
  assert.equal(assertResolvedPublicAddress("2606:4700:4700::1111"), "2606:4700:4700::1111");
});

test("remote cover fetch enforces redirects, MIME, signatures, and size", async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
  let count = 0;
  const image = await fetchRemoteImage("https://one.example/cover", async () => {
    count += 1;
    if (count === 1) return new Response(null, { status: 302, headers: { location: "https://two.example/cover.png" } });
    return new Response(png, { status: 200, headers: { "content-type": "image/png", "content-length": String(png.byteLength) } });
  });
  assert.equal(image.mime, "image/png");
  await assert.rejects(() => fetchRemoteImage("https://one.example/fake", async () => new Response("html", { headers: { "content-type": "image/png" } })), Response);
  const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
  await assert.rejects(() => fetchRemoteImage("https://one.example/huge", async () => new Response(oversized, { headers: { "content-type": "image/png" } })), Response);
});

test("admin cover preview serves remote images through the same-origin API", async () => {
  let forwardedRequest;
  const response = await previewCover({
    env: {
      ART_COVER_FETCHER: {
        async fetch(request) {
          forwardedRequest = request;
          return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), {
            headers: { "content-type": "image/png" },
          });
        },
      },
    },
    request: new Request("https://blog.muelsyse.us/api/admin/art/cover-preview?url=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Fw780%2Fposter.jpg"),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(new URL(forwardedRequest.url).hostname, "cover-fetcher.internal");
  assert.equal(forwardedRequest.headers.get("x-art-cover-url"), "https://image.tmdb.org/t/p/w780/poster.jpg");
});

test("admin cover preview passes the target URL explicitly through the service binding", async () => {
  let forwardedRequest;
  const response = await previewCover({
    env: {
      ART_COVER_FETCHER: {
        async fetch(request) {
          forwardedRequest = request;
          return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), {
            headers: { "content-type": "image/png" },
          });
        },
      },
    },
    request: new Request("https://blog.muelsyse.us/api/admin/art/cover-preview?url=https%3A%2F%2Fimg9.doubanio.com%2Fview%2Fsubject%2Fl%2Fpublic%2Fs30014644.jpg"),
  });

  assert.equal(response.status, 200);
  assert.equal(new URL(forwardedRequest.url).hostname, "cover-fetcher.internal");
  assert.equal(forwardedRequest.headers.get("x-art-cover-url"), "https://img9.doubanio.com/view/subject/l/public/s30014644.jpg");
});

test("admin upload stores a validated file and returns its public image URL", async () => {
  const bucket = new FakeBucket();
  const form = new FormData();
  form.set("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])], "cover.png", { type: "image/png" }));
  const response = await uploadCover({
    env: { ART_COVERS: bucket },
    request: new Request("https://blog.muelsyse.us/api/admin/art/covers", {
      method: "POST", headers: { origin: "https://blog.muelsyse.us" }, body: form,
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.match(body.cover.key, /^art\/[a-f0-9-]+\.png$/);
  assert.equal(body.cover.url, `https://img.muelsyse.us/${body.cover.key}`);
  assert.equal(bucket.objects.get(body.cover.key).options.httpMetadata.contentType, "image/png");
  assert.equal(bucket.objects.get(body.cover.key).options.httpMetadata.cacheControl, "public, max-age=31536000, immutable");
});

test("admin upload rejects a MIME type whose bytes are not an image", async () => {
  const form = new FormData();
  form.set("file", new File(["not png"], "fake.png", { type: "image/png" }));
  const response = await uploadCover({
    env: { ART_COVERS: new FakeBucket() },
    request: new Request("https://blog.muelsyse.us/api/admin/art/covers", {
      method: "POST", headers: { origin: "https://blog.muelsyse.us" }, body: form,
    }),
  });
  assert.equal(response.status, 400);
});

test("admin upload cleanup refuses referenced covers and deletes unreferenced covers", async () => {
  const bucket = new FakeBucket();
  const unreferencedKey = "art/22222222-2222-4222-8222-222222222222.png";
  await bucket.put(unreferencedKey, new Uint8Array([1]));
  const referenced = await deleteCover({
    env: { ART_COVERS: bucket, DB: referencedDb(true) },
    request: jsonRequest("DELETE", { key: "art/11111111-1111-4111-8111-111111111111.png" }),
  });
  const unreferenced = await deleteCover({
    env: { ART_COVERS: bucket, DB: referencedDb(false) },
    request: jsonRequest("DELETE", { key: unreferencedKey }),
  });

  assert.equal(referenced.status, 409);
  assert.equal(unreferenced.status, 200);
  assert.equal(bucket.objects.has(unreferencedKey), false);
});

test("failed item creation cleans up a stored upload that was never referenced", async () => {
  const key = "art/33333333-3333-4333-8333-333333333333.png";
  const bucket = new FakeBucket();
  await bucket.put(key, new Uint8Array([1]));
  const originalConsoleError = console.error;
  console.error = () => {};
  let response;
  try {
    response = await createItem({
      env: { ART_COVERS: bucket, DB: failingCreateDb() },
      request: jsonRequest("POST", {
        type: "book", source: "apple_books", sourceId: "", isbn: "", originalTitle: "标题", releaseDate: "",
        collectedOn: "2026-07-24", isVisible: true, cover: { kind: "stored", key },
        translations: { "zh-CN": { title: "标题", creator: "作者", extra: "" } },
      }),
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.status, 500);
  assert.equal(bucket.objects.has(key), false);
});

test("creating the same sourced album twice returns 409 before downloading another cover", async () => {
  const db = duplicateLookupDb({ id: "existing" });
  const bucket = new FakeBucket();
  let coverFetches = 0;
  const response = await createItem({
    env: {
      ART_COVERS: bucket,
      DB: db,
      ART_COVER_FETCHER: {
        async fetch() {
          coverFetches += 1;
          return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), { headers: { "content-type": "image/png" } });
        },
      },
    },
    request: jsonRequest("POST", albumInput()),
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: { code: "ART_ALREADY_EXISTS", message: "该专辑已经收藏。" } });
  assert.equal(coverFetches, 0);
  assert.equal(bucket.objects.size, 0);
  assert.equal(db.batchCalls, 0);
});

test("a concurrent duplicate insert returns 409 and removes its unreferenced cover", async () => {
  const bucket = new FakeBucket();
  const db = duplicateRaceDb();
  const originalConsoleError = console.error;
  console.error = () => {};
  let response;
  try {
    response = await createItem({
      env: {
        ART_COVERS: bucket,
        DB: db,
        ART_COVER_FETCHER: {
          async fetch() {
            return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), { headers: { "content-type": "image/png" } });
          },
        },
      },
      request: jsonRequest("POST", albumInput()),
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: { code: "ART_ALREADY_EXISTS", message: "该专辑已经收藏。" } });
  assert.equal(bucket.objects.size, 0);
});

function jsonRequest(method, body) {
  return new Request("https://blog.muelsyse.us/api/admin/art/covers", {
    method, headers: { origin: "https://blog.muelsyse.us", "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

function referencedDb(referenced) {
  return { prepare: () => ({ bind: () => ({ first: async () => referenced ? { id: "one" } : null }) }) };
}

function failingCreateDb() {
  return {
    prepare(sql) {
      if (sql.startsWith("SELECT id FROM art_items WHERE cover_key")) return { bind: () => ({ first: async () => null }) };
      return { bind: () => ({}) };
    },
    async batch() { throw new Error("D1 unavailable"); },
  };
}

function duplicateLookupDb(existing) {
  return {
    batchCalls: 0,
    prepare(sql) {
      if (sql.includes("WHERE source = ? AND source_id = ?")) return { bind: () => ({ first: async () => existing }) };
      if (sql.startsWith("SELECT id FROM art_items WHERE cover_key")) return { bind: () => ({ first: async () => null }) };
      throw new Error(`Unexpected query: ${sql}`);
    },
    async batch() { this.batchCalls += 1; },
  };
}

function duplicateRaceDb() {
  return {
    prepare(sql) {
      if (sql.includes("WHERE source = ? AND source_id = ?")) return { bind: () => ({ first: async () => null }) };
      if (sql.startsWith("SELECT id FROM art_items WHERE cover_key")) return { bind: () => ({ first: async () => null }) };
      return { bind: () => ({}) };
    },
    async batch() {
      const error = new Error("D1_ERROR: UNIQUE constraint failed: art_items.source, art_items.source_id");
      error.cause = new Error("UNIQUE constraint failed: art_items.source, art_items.source_id");
      throw error;
    },
  };
}

function albumInput() {
  return {
    type: "music", source: "deezer_music", sourceId: "9007781", isbn: "", originalTitle: "1989 (Deluxe)", releaseDate: "2014-10-27",
    collectedOn: "2026-07-25", isVisible: true, cover: { kind: "url", url: "https://deezer.test/1989.png" },
    translations: { "zh-CN": { title: "1989 (Deluxe)", creator: "Taylor Swift", extra: "" } },
  };
}

class FakeBucket {
  objects = new Map();
  async put(key, value, options = {}) { this.objects.set(key, { value, options }); }
  async get(key) { return this.objects.get(key) ? { body: this.objects.get(key).value } : null; }
  async head(key) { return this.objects.has(key) ? {} : null; }
  async delete(key) { this.objects.delete(key); }
}
