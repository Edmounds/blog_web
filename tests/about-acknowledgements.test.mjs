import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

test("About acknowledgements credit Cloudflare, TMDB, and Steam in order", () => {
  const profiles = [
    "src/content/about/profile.md",
    "src/i18n/content/en/about/profile.md",
    "src/i18n/content/ja/about/profile.md",
    "src/i18n/content/zh-TW/about/profile.md",
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
      assert.match(profile, new RegExp(`<img[^>]+src="/images/${logo}-logo\\.svg\\?v=20260728"`));
    }
    assert.equal((profile.match(/loading="eager"/g) ?? []).length, 3);
    assert.equal((profile.match(/width="(?:240|300)" height="64"/g) ?? []).length, 3);
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
  assert.match(about, /\.acknowledgement-logo/);
  assert.match(about, /max-height:\s*4rem/);
  assert.doesNotMatch(about, /:has\(/);
});

test("translation cache preserves the reviewed localized acknowledgements", () => {
  const manifest = JSON.parse(read("src/i18n/translation-manifest.json"));
  const normalize = (value) => value.trim().replace(/[ \t]+$/gm, "");

  for (const locale of ["en", "ja", "zh-TW"]) {
    const profile = read(`src/i18n/content/${locale}/about/profile.md`).replace(/^\uFEFF/, "");
    const cached = manifest.entries[`${locale}:content.about.profile.md.document`];

    assert.ok(cached, `${locale} About translation must be cached`);
    assert.match(cached.fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(normalize(cached.translation), normalize(profile));
  }
});
