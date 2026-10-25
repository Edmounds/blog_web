import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultLocale,
  getAlternatePaths,
  isLocale,
  localeDefinitions,
  locales,
  localizePath,
  stripLocaleFromPath,
  switchLocaleInUrl,
} from "../src/lib/i18n.ts";

test("supported locales include only zh-CN, zh-TW, and en", () => {
  assert.deepEqual(locales, ["zh-CN", "zh-TW", "en"]);
  assert.equal(defaultLocale, "zh-CN");
  assert.equal(locales.length, 3);
  assert.deepEqual(
    localeDefinitions.map((item) => item.code),
    ["zh-CN", "zh-TW", "en"],
  );
});

test("isLocale accepts supported locales and rejects ja", () => {
  assert.equal(isLocale("zh-CN"), true);
  assert.equal(isLocale("zh-TW"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("ja"), false);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale(undefined), false);
});

test("stripLocaleFromPath strips localized prefixes and ignores removed ja", () => {
  assert.deepEqual(stripLocaleFromPath("/en/blog/"), {
    locale: "en",
    pathname: "/blog/",
  });
  assert.deepEqual(stripLocaleFromPath("/zh-TW/note/"), {
    locale: "zh-TW",
    pathname: "/note/",
  });
  assert.deepEqual(stripLocaleFromPath("/blog/"), {
    locale: "zh-CN",
    pathname: "/blog/",
  });
  // ja is no longer a locale segment, so it remains part of the unlocalized path
  assert.deepEqual(stripLocaleFromPath("/ja/blog/"), {
    locale: "zh-CN",
    pathname: "/ja/blog/",
  });
});

test("localizePath generates appropriate localized URLs", () => {
  assert.equal(localizePath("/blog/", "zh-CN"), "/blog/");
  assert.equal(localizePath("/blog/", "en"), "/en/blog/");
  assert.equal(localizePath("/blog/", "zh-TW"), "/zh-TW/blog/");
});

test("switchLocaleInUrl replaces locale prefixes while preserving search and hash", () => {
  assert.equal(
    switchLocaleInUrl("https://blog.muelsyse.us/en/blog/?page=2#heading", "zh-TW"),
    "/zh-TW/blog/?page=2#heading",
  );
  assert.equal(
    switchLocaleInUrl("https://blog.muelsyse.us/zh-TW/about/", "zh-CN"),
    "/about/",
  );
  assert.equal(
    switchLocaleInUrl("https://blog.muelsyse.us/about/", "en"),
    "/en/about/",
  );
});

test("getAlternatePaths returns alternates for all 3 supported locales", () => {
  const alternates = getAlternatePaths("/blog/");
  assert.equal(alternates.length, 3);
  assert.deepEqual(
    alternates.map((item) => item.locale),
    ["zh-CN", "zh-TW", "en"],
  );
  assert.deepEqual(
    alternates.map((item) => item.href),
    ["/blog/", "/zh-TW/blog/", "/en/blog/"],
  );
});
