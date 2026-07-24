import assert from "node:assert/strict";
import test from "node:test";

import { assertResolvedPublicAddress, fetchRemoteImage, getShanghaiDate, localizeArtItems, parsePublicHttpsUrl, validateArtItemInput } from "../functions/_shared/art.js";
import { onRequestGet as previewCover } from "../functions/api/admin/art/cover-preview.js";

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
    translations: { "zh-CN": { title: "Abbey Road", creator: "The Beatles", extra: "" } },
  });
  assert.equal(result.ok, true);
});

test("public localization falls back to simplified Chinese", () => {
  const item = { id: "1", type: "book", coverUrl: "/media/art/1/a.jpg", translations: { "zh-CN": { title: "标题", creator: "作者", extra: "备注" } } };
  assert.deepEqual(localizeArtItems([item], "ja"), [{ id: "1", type: "book", title: "标题", creator: "作者", extra: "备注", cover: "/media/art/1/a.jpg" }]);
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
