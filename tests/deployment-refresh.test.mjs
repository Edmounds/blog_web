import assert from "node:assert/strict";
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
  for (const route of ["/", "/blog/*", "/art/*", "/en/*", "/ja/*", "/zh-TW/*"]) {
    assert.match(headers, new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+Cache-Control: no-cache`));
  }
});
