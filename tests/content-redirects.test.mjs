import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getLegacyArtRedirect, getLegacyContentRedirect } from "../src/lib/content-redirects.ts";

test("legacy content URLs redirect to date slugs in every locale", () => {
  assert.equal(
    getLegacyContentRedirect(new URL("https://blog.example/blog/first-note/?from=rss"))?.href,
    "https://blog.example/blog/20260128-01/?from=rss",
  );
  assert.equal(
    getLegacyContentRedirect(new URL("https://blog.example/ja/note/arknights-p3r/"))?.href,
    "https://blog.example/ja/note/20260726-01/",
  );
  assert.equal(
    getLegacyContentRedirect(new URL("https://blog.example/zh-TW/note/dongyeguiwu-passaway"))?.href,
    "https://blog.example/zh-TW/note/20260727-01/",
  );
  assert.equal(
    getLegacyContentRedirect(new URL("https://blog.example/en/blog/designing-for-clarity-in-chaos/"))?.href,
    "https://blog.example/en/blog/20260128-01/",
  );
});

test("current and unrelated URLs do not redirect", () => {
  assert.equal(getLegacyContentRedirect(new URL("https://blog.example/blog/20260128-01/")), undefined);
  assert.equal(getLegacyContentRedirect(new URL("https://blog.example/about/")), undefined);
});

test("legacy /art/ collection URLs redirect to their /life/ counterparts", () => {
  assert.equal(
    getLegacyArtRedirect(new URL("https://blog.example/art/book/"))?.href,
    "https://blog.example/life/book/",
  );
  assert.equal(
    getLegacyArtRedirect(new URL("https://blog.example/ja/art/game"))?.href,
    "https://blog.example/ja/life/game/",
  );
  assert.equal(
    getLegacyArtRedirect(new URL("https://blog.example/art/?ref=feed"))?.href,
    "https://blog.example/life/?ref=feed",
  );
});

test("only real collection types redirect away from /art/", () => {
  assert.equal(getLegacyArtRedirect(new URL("https://blog.example/art/movie/")), undefined);
  assert.equal(getLegacyArtRedirect(new URL("https://blog.example/admin/art/")), undefined);
  assert.equal(getLegacyArtRedirect(new URL("https://blog.example/api/art/douban-cover/x")), undefined);
  assert.equal(getLegacyArtRedirect(new URL("https://blog.example/life/book/")), undefined);
});

test("Astro middleware returns permanent redirects for legacy content", async () => {
  const middleware = await readFile(new URL("../src/middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /getLegacyContentRedirect\(requestUrl\)/);
  assert.match(middleware, /Response\.redirect\(redirectUrl, 301\)/);
});
