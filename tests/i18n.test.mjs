import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultLocale,
  localizePath,
  stripLocaleFromPath,
  switchLocaleInUrl,
} from "../src/lib/i18n.ts";

test("Chinese keeps the existing unprefixed routes", () => {
  assert.equal(defaultLocale, "zh-CN");
  assert.equal(localizePath("/blog/example/", "zh-CN"), "/blog/example/");
  assert.deepEqual(stripLocaleFromPath("/blog/example/"), {
    locale: "zh-CN",
    pathname: "/blog/example/",
  });
});

test("other locales use a stable prefix", () => {
  assert.equal(localizePath("/blog/example/", "en"), "/en/blog/example/");
  assert.equal(localizePath("/blog/example/", "zh-TW"), "/zh-TW/blog/example/");
  assert.deepEqual(stripLocaleFromPath("/ja/about/"), {
    locale: "ja",
    pathname: "/about/",
  });
  assert.deepEqual(stripLocaleFromPath("/zh-TW/about/"), {
    locale: "zh-TW",
    pathname: "/about/",
  });
});

test("switching locale preserves query strings and hashes", () => {
  assert.equal(
    switchLocaleInUrl("/en/blog/example/?ref=home#part", "ja"),
    "/ja/blog/example/?ref=home#part",
  );
  assert.equal(switchLocaleInUrl("/ja/about/", "zh-CN"), "/about/");
});
