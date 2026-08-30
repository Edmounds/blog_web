import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getLegacyContentRedirect } from "../src/lib/content-redirects.ts";

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

test("current, unrelated, and art URLs do not redirect", () => {
  assert.equal(getLegacyContentRedirect(new URL("https://blog.example/blog/20260128-01/")), undefined);
  assert.equal(getLegacyContentRedirect(new URL("https://blog.example/about/")), undefined);
  assert.equal(getLegacyContentRedirect(new URL("https://blog.example/art/book/")), undefined);
  assert.equal(getLegacyContentRedirect(new URL("https://blog.example/art/game/")), undefined);
  assert.equal(getLegacyContentRedirect(new URL("https://blog.example/art/")), undefined);
});

test("Astro middleware returns permanent redirects for legacy content", async () => {
  const middleware = await readFile(new URL("../src/middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /getLegacyContentRedirect\(requestUrl\)/);
  assert.match(middleware, /Response\.redirect\(redirectUrl, 301\)/);
});
