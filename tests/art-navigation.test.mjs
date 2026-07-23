import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("simplified Chinese navigation uses localized labels and collection order", () => {
  const source = JSON.parse(read("src/i18n/source.json"));
  const localizedContent = read("src/lib/localized-content.ts");

  assert.deepEqual(source.site.nav, {
    home: "首页",
    blog: "博客",
    art: "收藏",
    music: "专辑",
    book: "书籍",
    screen: "影视",
    film: "电影",
    series: "剧集",
    anime: "番剧",
    about: "关于",
  });
  assert.ok(localizedContent.indexOf("messages.nav.about") < localizedContent.indexOf("messages.nav.art"));
  assert.match(localizedContent, /messages\.nav\.book[\s\S]*messages\.nav\.music[\s\S]*messages\.nav\.screen/);
});

test("SPA canvas contains only home, blogs, and about", () => {
  const layout = read("src/layouts/SpaLayout.astro");

  assert.match(layout, /width: 300vw/);
  assert.match(layout, /data-path="\/"/);
  assert.match(layout, /data-path="\/blogs\/"/);
  assert.match(layout, /data-path="\/about\/"/);
  assert.doesNotMatch(layout, /ArtSection|data-path="\/art\//);
});

test("collection routes are standalone and old movie route is gone", () => {
  for (const route of ["book", "music", "screen"]) {
    const page = read(`src/pages/art/${route}/index.astro`);
    assert.match(page, /BaseLayout/);
    assert.match(page, /ArtSection/);
    assert.doesNotMatch(page, /SpaLayout/);
  }

  const localizedRoute = read("src/pages/[locale]/art/[type]/index.astro");
  assert.match(localizedRoute, /\["music", "book", "screen"\]/);
  assert.doesNotMatch(localizedRoute, /"movie"/);
});
