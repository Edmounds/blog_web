import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import preferredProxy from "../workers/blog-preferred-proxy.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public art routes are dynamic and revalidate on every request", () => {
  for (const file of ["src/pages/art/book/index.astro", "src/pages/art/music/index.astro", "src/pages/art/screen/index.astro", "src/pages/[locale]/art/[type]/index.astro"]) {
    const source = read(file);
    assert.match(source, /prerender = false/);
    assert.match(source, /getPublicArtItems/);
    assert.match(source, /s-maxage=0, must-revalidate/);
    assert.doesNotMatch(source, /stale-while-revalidate/);
  }
  assert.match(read("src/layouts/BaseLayout.astro"), /if \(!Astro\.response\.headers\.has\("Cache-Control"\)\)/);
  assert.match(read("public/_headers"), /\/art\/\*[\s\S]*s-maxage=0, must-revalidate/);
});

test("admin art and API paths are covered by the generic Access boundary", () => {
  const middleware = read("src/middleware.ts");
  assert.match(middleware, /pathname\.startsWith\("\/admin\/"\)/);
  assert.match(middleware, /pathname\.startsWith\("\/api\/admin\/"\)/);
  assert.equal(existsSync(new URL("../functions/admin/_middleware.js", import.meta.url)), true);
  assert.equal(existsSync(new URL("../functions/api/admin/_middleware.js", import.meta.url)), true);
});

test("cutover configuration uses the public image bucket and keeps no art sync hooks", () => {
  const packageJson = read("package.json");
  const wrangler = read("wrangler.jsonc");
  assert.match(packageJson, /schema\/art\.sql/);
  assert.doesNotMatch(packageJson, /sync-art\.mjs/);
  assert.match(packageJson, /"deploy:cover-fetcher": "wrangler deploy --config wrangler\.art-cover-fetcher\.jsonc"/);
  assert.match(packageJson, /"art:covers:migrate": "node scripts\/migrate-art-covers-to-images\.mjs"/);
  assert.match(packageJson, /"deploy": "npm run build && npm run deploy:cover-fetcher && wrangler deploy --config dist\/server\/wrangler\.json"/);
  assert.match(packageJson, /wrangler dev --config dist\/server\/wrangler\.json --persist-to \$INIT_CWD\/\.wrangler\/state/);
  assert.match(wrangler, /ART_COVERS/);
  assert.match(wrangler, /blog-images/);
  assert.doesNotMatch(wrangler, /preview_bucket_name/);
  assert.equal(existsSync(new URL("../src/data/art-source.json", import.meta.url)), false);
  assert.equal(existsSync(new URL("../src/lib/artData.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../scripts/sync-art.mjs", import.meta.url)), false);
  assert.equal(existsSync(new URL("../public/images/content/art", import.meta.url)), false);
});

test("the cover migration verifies hashes before optional source deletion", () => {
  const migration = read("scripts/migrate-art-covers-to-images.mjs");
  assert.match(migration, /blog-art-covers/);
  assert.match(migration, /blog-images/);
  assert.match(migration, /createHash\("sha256"\)/);
  assert.match(migration, /--delete-source/);
  assert.match(migration, /Hash verification failed/);
  assert.match(migration, /https:\/\/img\.muelsyse\.us/);
});

test("the Astro SSR Worker owns the art APIs and media route without a Pages origin fallback", () => {
  for (const file of [
    "src/pages/api/admin/art/search.ts",
    "src/pages/api/admin/art/cover-preview.ts",
    "src/pages/api/admin/art/translate.ts",
    "src/pages/api/admin/art/covers.ts",
    "src/pages/api/admin/art/items/index.ts",
    "src/pages/api/admin/art/items/[id].ts",
    "src/pages/media/art/[...path].ts",
  ]) {
    assert.equal(existsSync(new URL(`../${file}`, import.meta.url)), true);
  }
  assert.equal(existsSync(new URL("../functions/[[path]].js", import.meta.url)), false);
  assert.doesNotMatch(read("wrangler.jsonc"), /SSR_ORIGIN/);
  assert.doesNotMatch(read("src/env.d.ts"), /SSR_ORIGIN/);
});

test("cover-fetcher validates both IPv4 and IPv6 DNS answers", () => {
  const source = read("workers/art-cover-fetcher.js");
  assert.match(source, /resolveDns\(hostname, "A", 1\)/);
  assert.match(source, /resolveDns\(hostname, "AAAA", 28\)/);
  assert.match(source, /Promise\.all/);
});

test("cover-fetcher supplies Douban's required image referer", () => {
  const source = read("workers/art-cover-fetcher.js");
  assert.match(source, /request\.headers\.get\("x-art-cover-url"\)/);
  assert.match(source, /fetch\(new Request\(url, \{ headers \}\)/);
  assert.match(source, /hostname\.endsWith\("\.doubanio\.com"\)/);
  assert.match(source, /headers\.set\("referer", "https:\/\/book\.douban\.com\/"\)/);
});

test("cover-fetcher normalizes common JPEG MIME aliases", () => {
  const source = read("workers/art-cover-fetcher.js");
  assert.match(source, /mime === "image\/jpg" \|\| mime === "image\/pjpeg"/);
  assert.match(source, /return "image\/jpeg"/);
  assert.match(source, /response\.headers\.get\("content-type"\) \?\? mime/);
});

test("the shared remote image fetcher accepts SVG only for the sanitized friend-avatar path", () => {
  const fetcher = read("workers/art-cover-fetcher.js");
  const avatar = read("functions/api/friend-avatar.js");
  const appConfig = read("wrangler.astro.jsonc");

  assert.match(fetcher, /image\/svg\+xml/);
  assert.match(avatar, /@cf-wasm\/resvg\/edge-light/);
  assert.match(avatar, /format: "image\/webp"/);
  assert.match(avatar, /max-age=86400/);
  assert.match(appConfig, /"images"[\s\S]*"binding": "IMAGES"/);
});

test("the existing preferred-edge Worker keeps the public route and calls SSR through a service binding", () => {
  const appConfig = read("wrangler.astro.jsonc");
  const proxyConfig = read("wrangler.preferred-proxy.jsonc");
  const proxyWorker = read("workers/blog-preferred-proxy.js");
  assert.doesNotMatch(appConfig, /blog\.muelsyse\.us\/\*/);
  assert.match(appConfig, /"keep_vars": true/);
  assert.match(appConfig, /"not_found_handling": "none"/);
  assert.match(proxyConfig, /"binding": "ORIGIN"/);
  assert.match(appConfig, /"name": "new-blog-ssr"/);
  assert.match(proxyConfig, /"service": "new-blog-ssr"/);
  assert.match(proxyConfig, /blog\.muelsyse\.us\/\*/);
  assert.match(proxyWorker, /env\.ORIGIN\.fetch/);
  assert.doesNotMatch(proxyWorker, /new-blog-c0s\.pages\.dev/);
});

test("deployment docs and CI target the Astro SSR Worker", () => {
  const readme = read("README.md");
  const workflow = read(".github/workflows/deploy.yml");

  assert.match(workflow, /name: Deploy Astro SSR Worker/);
  assert.match(workflow, /node-version: 22/);
  assert.doesNotMatch(workflow, /Deploy to Cloudflare Pages/);
  assert.match(readme, /wrangler secret put WAKA_TIME_API_KEY --name new-blog-ssr/);
  assert.match(readme, /WAKATIME_API_KEY.*兼容/);
  assert.doesNotMatch(readme, /wrangler pages secret put/);
  assert.equal(existsSync(new URL("../LICENSE-ASTRO-STAR", import.meta.url)), true);
  assert.match(read("NOTICE"), /Astro-star 0\.16\.25/);
});

test("the preferred-edge Worker forwards same-origin DELETE requests without requiring a JSON body", async () => {
  let forwardedRequest;
  const response = await preferredProxy.fetch(
    new Request("https://blog.muelsyse.us/api/admin/art/items/book-1", {
      method: "DELETE",
      headers: { origin: "https://blog.muelsyse.us" },
    }),
    {
      ORIGIN: {
        async fetch(request) {
          forwardedRequest = request;
          return new Response(null, { status: 204 });
        },
      },
    },
  );

  assert.equal(response.status, 204);
  assert.equal(forwardedRequest?.method, "DELETE");
  assert.equal(response.headers.get("x-blog-edge"), "preferred-worker");
});

test("the preferred-edge Worker keeps the image CDN in its CSP", async () => {
  const response = await preferredProxy.fetch(
    new Request("https://blog.muelsyse.us/"),
    {
      ORIGIN: {
        async fetch() {
          return new Response("ok");
        },
      },
    },
  );

  const csp = response.headers.get("content-security-policy");
  assert.match(csp, /img-src 'self' data: https:\/\/img\.muelsyse\.us/);
  assert.match(csp, /https:\/\/\*\.doubanio\.com/);
  assert.match(csp, /https:\/\/p1\.music\.126\.net/);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.doesNotMatch(csp, /img-src[^;]*https:\/\/\*(?:\s|;|$)/);
  assert.doesNotMatch(csp, /image\.tmdb\.org|cdn-images\.dzcdn\.net|img-src[^;]*\shttps:\s/);
});

test("all public CSP definitions allow only the selected external art cover hosts", () => {
  for (const file of ["src/middleware.ts", "public/_headers", "workers/blog-preferred-proxy.js"]) {
    const source = read(file);
    assert.match(source, /https:\/\/img\.muelsyse\.us/);
    assert.match(source, /https:\/\/p1\.music\.126\.net/);
    assert.match(source, /https:\/\/\*\.doubanio\.com/);
    assert.doesNotMatch(source, /image\.tmdb\.org|cdn-images\.dzcdn\.net/);
  }

  const admin = read("src/components/domain/ArtAdmin.tsx");
  assert.match(admin, /\/api\/admin\/art\/cover-preview\?url=/);
});

test("the preferred-edge Worker rejects cross-origin write requests", async () => {
  let forwarded = false;
  const response = await preferredProxy.fetch(
    new Request("https://blog.muelsyse.us/api/like", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify({ contentId: "blog/first-note" }),
    }),
    {
      ORIGIN: {
        async fetch() {
          forwarded = true;
          return new Response(null, { status: 204 });
        },
      },
    },
  );

  assert.equal(response.status, 403);
  assert.equal(forwarded, false);
});

test("the preferred-edge Worker treats browser cross-site metadata as a write rejection", async () => {
  let forwarded = false;
  const response = await preferredProxy.fetch(
    new Request("https://blog.muelsyse.us/api/admin/art/items/book-1", {
      method: "DELETE",
      headers: { "sec-fetch-site": "cross-site" },
    }),
    {
      ORIGIN: {
        async fetch() {
          forwarded = true;
          return new Response(null, { status: 204 });
        },
      },
    },
  );

  assert.equal(response.status, 403);
  assert.equal(forwarded, false);
});
