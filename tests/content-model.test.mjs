import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

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
  const models = await read("src/lib/view-models.ts");

  assert.doesNotMatch(section, /<img\b|ArchiveGrid|ContentCard/);
  assert.match(section, /All \{sectionLabel\}/);
  assert.match(section, /ArchiveActivityTimeline/);
  assert.match(section, /ArchiveTableOfContents/);
  assert.match(section, /post\.dateLabel/);
  assert.doesNotMatch(section, /post\.summary|post\.readingTime|post\.tags\.map/);
  assert.doesNotMatch(models, /\bcover\b|\bcategory\b|\bimage\b/);
  assert.match(models, /tags:\s*post\.archiveTags/);
  assert.match(models, /dateIso:\s*post\.dateIso/);
});

test("the current blog entry uses only tags for classification metadata", async () => {
  const post = await read("src/content/blog/first-note.md");

  assert.doesNotMatch(post, /^\s*(?:#\s*)?(?:routeSlug|image|cover|category|type):/m);
  assert.match(post, /^tags:\s*$/m);
});

test("content slugs always come from Markdown file names", async () => {
  const content = await read("src/lib/content.ts");
  const ids = await read("scripts/check-content-ids.mjs");

  assert.doesNotMatch(content, /routeSlug/);
  assert.match(content, /entry\.id\.split\("\/"\)\.pop/);
  assert.doesNotMatch(ids, /routeSlug/);
  assert.match(ids, /path\.basename\(file\)/);
});
