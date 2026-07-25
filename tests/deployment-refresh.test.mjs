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
  for (const route of ["/", "/blog/*", "/en/*", "/ja/*", "/zh-TW/*"]) {
    assert.match(headers, new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+Cache-Control: no-cache`));
  }
  assert.match(headers, /\/art\/\*\s+Cache-Control: public, max-age=0, s-maxage=0, must-revalidate/);
});

test("public pages check for deployments on load, every minute, and when revisited", () => {
  const layout = read("src/layouts/BaseLayout.astro");

  assert.match(layout, /const DEPLOYMENT_CHECK_INTERVAL_MS = 60_000/);
  assert.match(layout, /void checkForDeployment\(\)/);
  assert.match(layout, /window\.setInterval\(\(\) => void checkForDeployment\(\), DEPLOYMENT_CHECK_INTERVAL_MS\)/);
  assert.match(layout, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(layout, /window\.addEventListener\("focus", onFocus\)/);
  assert.match(layout, /document\.visibilityState !== "visible"/);
  assert.doesNotMatch(layout, /30 \* 60_000|hiddenAt/);
});

test("deployment refresh is single-instance, skips admin pages, and cannot loop", () => {
  const layout = read("src/layouts/BaseLayout.astro");

  assert.match(layout, /!window\.location\.pathname\.startsWith\("\/admin\/"\)/);
  assert.match(layout, /__deploymentRefreshCleanup/);
  assert.match(layout, /checkInFlight/);
  assert.match(layout, /sessionStorage\.getItem\(DEPLOYMENT_REFRESH_KEY\)/);
  assert.match(layout, /sessionStorage\.setItem\(DEPLOYMENT_REFRESH_KEY, deployment\.buildId\)/);
  assert.match(layout, /window\.clearInterval\(intervalId\)/);
});

test("public assets are immutable and public pages have security headers", () => {
  const headers = read("public/_headers");
  for (const route of ["/_astro/*", "/fonts/*", "/images/content/*"]) assert.match(headers, new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+Cache-Control: public, max-age=31536000, immutable`));
  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /Strict-Transport-Security:/);
  assert.match(headers, /X-Frame-Options: DENY/);
});

test("the replaceable profile portrait and social card use content-versioned WebP URLs", () => {
  const sourceProfile = read("src/content/about/profile.md");
  const layout = read("src/layouts/BaseLayout.astro");
  const portrait = sourceProfile.match(/portrait: (\/images\/content\/about\/profile-([a-f0-9]{12})-w320\.webp)/);

  assert.ok(portrait);
  const bytes = readFileSync(new URL(`../public${portrait[1]}`, import.meta.url));
  assert.ok(bytes.length > 0);
  assert.match(layout, new RegExp(`imageUrl = "/images/content/about/profile-${portrait[2]}-social\\.webp"`));
  assert.doesNotMatch(layout, /og:image[^\n]*\.avif|twitter:image[^\n]*\.avif/);
});
