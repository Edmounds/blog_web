import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

test("the custom 404 route is standalone and explicitly returns 404", () => {
  const page = read("src/pages/404.astro");

  assert.match(page, /Astro\.response\.status\s*=\s*404/);
  assert.match(page, /Astro\.response\.statusText\s*=\s*"Not Found"/);
  assert.doesNotMatch(page, /BaseLayout|Header|Footer|RouteBackground|SpaLayout/);
  assert.match(page, /<h1[^>]*>404<\/h1>/);
  assert.match(page, /<p>PAGE NOT FOUND<\/p>/);
});

test("unknown API routes keep a JSON 404 instead of the visual page", () => {
  const api404 = read("src/pages/api/[...path].ts");

  assert.match(api404, /export const ALL/);
  assert.match(api404, /Response\.json/);
  assert.match(api404, /status:\s*404/);
  assert.match(api404, /code:\s*"NOT_FOUND"/);
});

test("the 404 page references generated responsive visual assets", () => {
  const page = read("src/pages/404.astro");

  for (const source of page.matchAll(/(?:src|srcset)="([^"]+)"/g)) {
    for (const candidate of source[1].split(",")) {
      const publicPath = candidate.trim().split(/\s+/, 1)[0];
      if (publicPath.startsWith("/images/404-")) {
        assert.equal(exists(`public${publicPath}`), true, `${publicPath} should exist`);
      }
    }
  }

  assert.match(page, /<picture/);
  assert.match(page, /prefers-reduced-motion/);
});

test("the home link supports all four site locales", () => {
  const page = read("src/pages/404.astro");

  assert.match(page, /"zh-CN":\s*"返回首页"/);
  assert.match(page, /"zh-TW":\s*"返回首頁"/);
  assert.match(page, /en:\s*"Back home"/);
  assert.match(page, /ja:\s*"ホームへ"/);
  assert.match(page, /stripLocaleFromPath\(Astro\.url\.pathname\)/);
  assert.match(page, /localizePath\("\/", locale\)/);
});

test("the 404 asset generator validates output before replacing public assets", () => {
  const generator = read("scripts/generate-404-image.py");

  assert.match(generator, /--asset/);
  assert.match(generator, /OPENAI_IMAGE_BASE_URL/);
  assert.match(generator, /OPENAI_IMAGE_API_KEY/);
  assert.match(generator, /validate_background\(master\)/);
  assert.match(generator, /validate_character\(master\)/);
  assert.match(generator, /os\.replace\(source, destination\)/);
});
