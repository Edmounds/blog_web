import assert from "node:assert/strict";
import test from "node:test";

import { onRequestGet } from "../functions/api/friend-avatar.js";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

const imageService = {
  input(stream) {
    return {
      async output(options) {
        assert.equal(options.format, "image/webp");
        assert.ok(stream instanceof ReadableStream);
        return {
          response: () => new Response(webp, { headers: { "content-type": "image/webp" } }),
        };
      },
    };
  },
};

test("friend avatar proxy returns a cached WebP through the same-origin endpoint", async () => {
  let forwarded;
  const response = await onRequestGet({
    env: {
      IMAGES: imageService,
      ART_COVER_FETCHER: {
        async fetch(request) {
          forwarded = request;
          return new Response(png, { headers: { "content-type": "image/png" } });
        },
      },
    },
    request: new Request("https://blog.muelsyse.us/api/friend-avatar?url=https%3A%2F%2Fexample.com%2Favatar.png"),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.match(response.headers.get("cache-control"), /max-age=86400/);
  assert.equal(forwarded.headers.get("x-art-cover-url"), "https://example.com/avatar.png");
});

test("friend avatar proxy rejects invalid URLs, private targets, invalid images, and oversized responses", async () => {
  for (const url of ["", "http://example.com/avatar.png", "https://user:pass@example.com/avatar.png", "https://127.0.0.1/avatar.png"]) {
    const suffix = url ? `?url=${encodeURIComponent(url)}` : "";
    const response = await onRequestGet({ env: { IMAGES: imageService }, request: new Request(`https://blog.muelsyse.us/api/friend-avatar${suffix}`) });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }

  const invalid = await onRequestGet({
    env: { IMAGES: imageService, ART_COVER_FETCHER: { async fetch() { return new Response("html", { headers: { "content-type": "image/png" } }); } } },
    request: new Request("https://blog.muelsyse.us/api/friend-avatar?url=https%3A%2F%2Fexample.com%2Ffake.png"),
  });
  assert.equal(invalid.status, 400);

  const oversized = await onRequestGet({
    env: { IMAGES: imageService, ART_COVER_FETCHER: { async fetch() { return new Response(null, { headers: { "content-type": "image/png", "content-length": String(5 * 1024 * 1024 + 1) } }); } } },
    request: new Request("https://blog.muelsyse.us/api/friend-avatar?url=https%3A%2F%2Fexample.com%2Fhuge.png"),
  });
  assert.equal(oversized.status, 413);
});

test("friend avatar proxy validates redirect targets and requires the Images binding", async () => {
  const redirected = await onRequestGet({
    env: {
      IMAGES: imageService,
      ART_COVER_FETCHER: { async fetch() { return new Response(null, { status: 302, headers: { location: "http://example.com/avatar.png" } }); } },
    },
    request: new Request("https://blog.muelsyse.us/api/friend-avatar?url=https%3A%2F%2Fexample.com%2Favatar.png"),
  });
  assert.equal(redirected.status, 400);

  const unavailable = await onRequestGet({
    env: {},
    request: new Request("https://blog.muelsyse.us/api/friend-avatar?url=https%3A%2F%2Fexample.com%2Favatar.png"),
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("cache-control"), "no-store");
});
