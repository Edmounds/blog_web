import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("each deployment publishes a version marker and checks it from the browser", () => {
  const config = read("astro.config.mjs");
  const layout = read("src/layouts/BaseLayout.astro");
  const workflow = read(".github/workflows/deploy.yml");

  assert.match(config, /version\.json/);
  assert.match(config, /PUBLIC_BUILD_ID/);
  assert.match(config, /astro:build:done/);
  assert.match(layout, /data-build-id/);
  assert.match(layout, /Cache-Control["'],\s*["']no-cache/);
  assert.match(layout, /cache:\s*["']no-store["']/);
  assert.match(layout, /window\.location\.reload\(\)/);
  assert.match(workflow, /PUBLIC_BUILD_ID:\s*\$\{\{ github\.sha \}\}/);
});

test("version checks do not run against the local development server", () => {
  const layout = read("src/layouts/BaseLayout.astro");

  assert.match(layout, /import\.meta\.env\.PROD/);
});

test("Cloudflare revalidates HTML while keeping the version marker uncached", () => {
  const headers = read("public/_headers");

  assert.match(headers, /\/version\.json\s+Cache-Control: no-store/);
  for (const route of ["/", "/blog/*", "/en/*", "/ja/*", "/zh-TW/*"]) {
    assert.match(headers, new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+Cache-Control: no-cache`));
  }
  assert.match(headers, /\/art\/\*\s+Cache-Control: public, max-age=0, s-maxage=0, must-revalidate/);
});

test("deployment checks only run after thirty minutes away", () => {
  const layout = read("src/layouts/BaseLayout.astro");
  assert.doesNotMatch(layout, /setInterval\(check/);
  assert.doesNotMatch(layout, /void check\(\);\s*window/);
  assert.match(layout, /Date\.now\(\) - hiddenAt < 30 \* 60_000/);
});

test("public assets are immutable and public pages have security headers", () => {
  const headers = read("public/_headers");
  for (const route of ["/_astro/*", "/fonts/*", "/images/content/*"]) assert.match(headers, new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+Cache-Control: public, max-age=31536000, immutable`));
  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /Strict-Transport-Security:/);
  assert.match(headers, /X-Frame-Options: DENY/);
});

test("the replaceable profile portrait uses a content-versioned URL", () => {
  const sourceProfile = read("src/content/about/profile.md");
  const layout = read("src/layouts/BaseLayout.astro");
  const portrait = sourceProfile.match(/portrait: (\/images\/content\/about\/profile-([a-f0-9]{12})\.png)/);

  assert.ok(portrait);
  assert.match(layout, new RegExp(`imageUrl = "${portrait[1]}"`));
  const bytes = readFileSync(new URL(`../public${portrait[1]}`, import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex").slice(0, 12), portrait[2]);
});
