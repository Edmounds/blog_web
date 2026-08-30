import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const exists = async (path) => {
  try {
    await access(new URL(`../${path}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
};

test("writing collections use tags instead of category, type, or cover fields", async () => {
  const schema = await read("src/content.config.ts");
  const content = await read("src/lib/content.ts");
  const localized = await read("src/lib/localized-content.ts");

  assert.doesNotMatch(schema, /\bimage:\s*z\./);
  assert.doesNotMatch(schema, /\bcategory:\s*z\./);
  assert.doesNotMatch(schema, /\btype:\s*z\./);
  assert.doesNotMatch(schema, /\brouteSlug:\s*z\./);
  assert.doesNotMatch(content, /\bimage\??:/);
  assert.doesNotMatch(content, /\bcategory:/);
  assert.doesNotMatch(localized, /default-cover|\bcover:|\bcategory:/);
});

test("all writing sections render as localized Astro-star timeline archives", async () => {
  const section = await read("src/components/sections/ContentSection.astro");
  const activity = await read("src/components/domain/ArchiveActivityTimeline.astro");
  const models = await read("src/lib/view-models.ts");

  assert.doesNotMatch(section, /<img\b|ArchiveGrid|ContentCard/);
  assert.match(section, /All \{sectionLabel\}/);
  assert.match(section, /ArchiveActivityTimeline/);
  assert.match(section, /ArchiveTableOfContents/);
  assert.match(section, /post\.dateLabel/);
  assert.doesNotMatch(section, /post\.tags\.map/);
  assert.doesNotMatch(models, /\bcover\b|\bcategory\b|\bimage\b/);
  assert.match(models, /tags:\s*post\.archiveTags/);
  assert.match(models, /dateIso:\s*post\.dateIso/);
  assert.match(activity, /\.archive-activity__label[^{]*\{[^}]*white-space:\s*nowrap;/s);
  assert.match(activity, /\.archive-activity__year[^{]*\{[^}]*white-space:\s*nowrap;/s);
});

test("content slugs always come from frontmatter", async () => {
  const content = await read("src/lib/content.ts");
  const ids = await read("scripts/check-content-ids.mjs");
  const schema = await read("src/content.config.ts");

  assert.doesNotMatch(content, /routeSlug/);
  assert.match(content, /entry\.data\.slug/);
  assert.doesNotMatch(content, /entry\.id\.split\("\/"\)\.pop/);
  assert.doesNotMatch(ids, /routeSlug/);
  assert.match(ids, /source\.data\.slug/);
  assert.match(schema, /slug:\s*z\.string/);
  assert.match(schema, /generateId:\s*\(\{ entry \}\) => entry\.replace/);
  assert.doesNotMatch(ids, /functions\/_shared\/post-slugs\.js/);
  assert.match(ids, /src\/lib\/post-slugs\.ts/);
});

test("localized writing entries default missing tags to an empty list", async () => {
  const content = await read("src/lib/content.ts");

  assert.match(content, /tags:\s*entry\.data\.tags\s*\?\?\s*\[\]/);
});

test("site configuration and translations stay outside content while About owns animation keywords", async () => {
  const config = await read("src/content.config.ts");
  const about = await read("src/content/about/profile.md");
  const aboutSection = await read("src/components/sections/AboutSection.astro");
  const background = await read("src/components/site/RouteBackground.astro");
  const translate = await read("scripts/translate.mjs");

  assert.match(config, /base:\s*"\.\/src\/config\/site"/);
  assert.match(config, /base:\s*"\.\/src\/i18n\/content"/);
  assert.match(config, /backgroundKeywords:\s*z\.array\(z\.string\(\)\.min\(1\)\)\.min\(1\)/);
  assert.match(about, /^backgroundKeywords:\s*$/m);
  assert.match(background, /getAboutProfile/);
  assert.match(background, /profile\.data\.backgroundKeywords/);
  assert.doesNotMatch(background, /const keywords\s*=\s*\[/);
  assert.doesNotMatch(background, /--word|content:\s*var\(--word\)/);
  assert.doesNotMatch(aboutSection, /backgroundKeywords/);
  assert.match(translate, /"backgroundKeywords"/);
  assert.match(translate, /src\/i18n\/content/);
  assert.equal(await exists("src/config/site/settings.md"), true);
  assert.equal(await exists("src/i18n/content/en/about/profile.md"), true);
  assert.equal(await exists("src/content/site"), false);
  assert.equal(await exists("src/content/translations"), false);
});

test("CONTENT_SECTIONS contains blog, project, and note in order", async () => {
  const content = await read("src/lib/content.ts");
  const schema = await read("src/content.config.ts");
  const localized = await read("src/lib/localized-content.ts");

  assert.match(content, /export const CONTENT_SECTIONS = \["blog", "project", "note"\] as const;/);
  assert.match(schema, /const project = defineCollection/);
  assert.match(schema, /github:\s*z\.string/);
  assert.match(localized, /getLocalizedProjectEntries/);
  assert.match(localized, /getLocalizedProjectEntry/);
  assert.match(localized, /getLocalizedProjectSections/);
});
