import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

test("About acknowledgements credit Cloudflare, TMDB, and Steam in order", () => {
  const profiles = [
    "src/content/about/profile.md",
    "src/content/translations/en/about/profile.md",
    "src/content/translations/ja/about/profile.md",
    "src/content/translations/zh-TW/about/profile.md",
  ];

  for (const path of profiles) {
    const profile = read(path);
    const astroStar = profile.indexOf("Astro-star");
    const cloudflare = profile.indexOf("Cloudflare");
    const tmdb = profile.indexOf("TMDB");
    const steam = profile.indexOf("Steam Web API");

    assert.ok(astroStar >= 0, `${path} must credit Astro-star`);
    assert.ok(cloudflare > astroStar, `${path} must place Cloudflare after Astro-star`);
    assert.ok(tmdb > cloudflare, `${path} must place TMDB after Cloudflare`);
    assert.ok(steam > tmdb, `${path} must place Steam last`);
    for (const logo of ["cloudflare", "tmdb", "steam"]) {
      assert.match(profile, new RegExp(`\\[!\\[[^\\]]+\\]\\(\\/images\\/${logo}-logo\\.svg\\)\\]\\(`));
    }
  }
});

test("About acknowledgement logos are local, accessible, and displayed as large standalone rows", () => {
  for (const brand of ["cloudflare", "tmdb", "steam"]) {
    const path = `public/images/${brand}-logo.svg`;
    assert.equal(exists(path), true, `${path} must exist`);
    assert.match(read(path), /role="img"/);
    assert.match(read(path), /<title/);
  }

  const about = read("src/components/sections/AboutSection.astro");
  assert.match(about, /img\[src\$="-logo\.svg"\]/);
  assert.match(about, /max-height:\s*4rem/);
  assert.match(about, /p:has\(> a > img\[src\$="-logo\.svg"\]\)/);
});

test("translation cache preserves the reviewed localized acknowledgements", () => {
  const manifest = JSON.parse(read("src/i18n/translation-manifest.json"));

  for (const locale of ["en", "ja", "zh-TW"]) {
    const profile = read(`src/content/translations/${locale}/about/profile.md`).replace(/^\uFEFF/, "");
    const cached = manifest.entries[`${locale}:content.about.profile.md.document`];

    assert.ok(cached, `${locale} About translation must be cached`);
    assert.match(cached.fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(cached.translation.trim(), profile.trim());
  }
});
