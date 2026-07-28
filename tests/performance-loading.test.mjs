import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("initial loading overlay exits after useful content is paintable", () => {
  const overlay = read("src/components/site/LoadingOverlay.astro");

  assert.match(overlay, /INITIAL_MIN_MS\s*=\s*240/);
  assert.match(overlay, /INITIAL_FADE_MS\s*=\s*220/);
  assert.match(overlay, /INITIAL_MAX_MS\s*=\s*1_500/);
  assert.match(overlay, /IMAGE_DECODE_MAX_MS\s*=\s*800/);
  assert.match(overlay, /requestAnimationFrame[\s\S]*requestAnimationFrame/);
  assert.match(overlay, /fetchpriority="high"/);
  assert.match(overlay, /if \(initialFinished\) return/);
  assert.doesNotMatch(overlay, /addEventListener\(\s*["']load["'][\s\S]*hideInitial/);
});

test("SPA preload policy prioritizes neighbors and user intent", () => {
  const spa = read("src/layouts/SpaLayout.astro");
  const header = read("src/components/site/Header.astro");

  assert.doesNotMatch(header, /data-astro-prefetch="viewport"/);
  assert.doesNotMatch(spa, /cache:\s*"no-store"/);
  assert.match(spa, /const neighborIndexes/);
  assert.match(spa, /3_000/);
  assert.match(spa, /pointerenter/);
  assert.match(spa, /focusin/);
  assert.match(spa, /touchstart/);
  assert.match(spa, /visibilitychange/);
});

test("header and fonts reserve stable first-paint geometry", () => {
  const base = read("src/layouts/BaseLayout.astro");
  const header = read("src/components/site/Header.astro");
  const global = read("src/styles/global.css");

  assert.match(base, /Allura-Last4ev3r\.woff/);
  assert.doesNotMatch(base, /anthropic-fonts\.css/);
  assert.match(global, /@font-face[\s\S]*font-family:\s*"Biotif"/);
  assert.match(header, /measureText/);
  assert.match(header, /actualBoundingBoxRight/);
  assert.match(header, /document\.fonts\.ready/);
  assert.match(header, /ResizeObserver/);
});

test("homepage remote widgets defer work until after first paint", () => {
  const home = read("src/components/sections/HomeSection.astro");
  const heatmap = read("src/components/domain/GitHubHeatmap.astro");

  assert.match(home, /data-src="\/api\/wakatime-badge\.svg"/);
  assert.match(home, /IntersectionObserver/);
  assert.match(heatmap, /requestIdleCallback/);
  assert.match(heatmap, /loading-overlay:hidden/);
});
