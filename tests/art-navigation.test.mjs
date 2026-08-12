import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("primary navigation places text Links immediately before About and Life", () => {
  const header = read("src/components/site/Header.astro");
  assert.match(
    header,
    /const primary = \[[\s\S]*?label: "Blog"[\s\S]*?label: "Note"[\s\S]*?label: "Links"[\s\S]*?label: "About"[\s\S]*?\];[\s\S]*?<div class="life-menu">/,
  );
  assert.doesNotMatch(header, /Project/);
  assert.doesNotMatch(header, /LinkIcon|header-links/);
  assert.match(header, /label: "Links", href: "\/links\/", primaryRoute: false/);
  assert.match(header, /Books[\s\S]*Music[\s\S]*Screen/);
});

test("SPA canvas contains only home, about, blog, and note", () => {
  const layout = read("src/layouts/SpaLayout.astro");
  assert.match(layout, /\.spa-track\s*\{[\s\S]*?display:\s*flex;[\s\S]*?width:\s*100%/);
  assert.match(layout, /\.spa-track > section\s*\{[\s\S]*?flex:\s*0 0 100%/);
  assert.match(layout, /data-path="\/"/);
  assert.match(layout, /const routes = \["\/", "\/about\/", "\/blog\/", "\/note\/"\]/);
  assert.doesNotMatch(layout, /project|Project/);
  assert.match(layout, /routes\.slice\(1\)\.map/);
  assert.doesNotMatch(layout, /ArtSection|data-path="\/art\//);
});

test("SPA owns primary route preloading and canvas entries are prerendered", () => {
  const header = read("src/components/site/Header.astro");
  const spa = read("src/layouts/SpaLayout.astro");
  assert.match(header, /data-primary-route/);
  assert.doesNotMatch(header, /data-astro-prefetch="viewport"/);
  assert.match(spa, /const preloadFromLink[\s\S]*loadSlide[\s\S]*pointerenter/);

  for (const route of ["blog", "note"]) {
    assert.match(read(`src/pages/${route}/index.astro`), /export const prerender = true/);
    const localized = read(`src/pages/[locale]/${route}/index.astro`);
    assert.match(localized, /export const prerender = true/);
    assert.match(localized, /getStaticPaths/);
  }
});

test("collection routes are standalone and old movie route is gone", () => {
  for (const route of ["book", "music", "screen"]) {
    const page = read(`src/pages/art/${route}/index.astro`);
    assert.match(page, /BaseLayout/);
    assert.match(page, /ArtSection/);
    assert.doesNotMatch(page, /SpaLayout/);
  }
  const localizedRoute = read("src/pages/[locale]/art/[type]/index.astro");
  assert.match(localizedRoute, /\["music", "book", "screen", "game"\]/);
  assert.doesNotMatch(localizedRoute, /Astro\.params\.type as "movie"/);
});
