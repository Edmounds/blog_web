import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("primary navigation uses fixed English labels and Life collection order", () => {
  const header = read("src/components/site/Header.astro");
  assert.match(header, /About/);
  assert.match(header, /Blog/);
  assert.match(header, /Note/);
  assert.match(header, /Project/);
  assert.match(header, /Life/);
  assert.match(header, /Books[\s\S]*Music[\s\S]*Screen/);
});

test("SPA canvas contains home, about, blog, note, and project", () => {
  const layout = read("src/layouts/SpaLayout.astro");
  assert.match(layout, /width: 500vw/);
  assert.match(layout, /data-path="\/"/);
  assert.match(layout, /data-path="\/about\/"/);
  assert.match(layout, /data-path="\/blog\/"/);
  assert.match(layout, /data-path="\/note\/"/);
  assert.match(layout, /data-path="\/project\/"/);
  assert.doesNotMatch(layout, /ArtSection|data-path="\/art\//);
});

test("Life pages prefetch primary canvas routes and canvas entries are prerendered", () => {
  const header = read("src/components/site/Header.astro");
  assert.match(header, /data-primary-route data-astro-prefetch="viewport"/);

  for (const route of ["blog", "note", "project"]) {
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
