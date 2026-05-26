import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { POST_SLUGS } from "../functions/_shared/post-slugs.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const blogDir = path.join(root, "src/content/blog");
const files = await readdir(blogDir);
const slugs = [];

for (const file of files) {
  if (!file.endsWith(".md")) continue;

  const content = (await readFile(path.join(blogDir, file), "utf8")).replace(/^\uFEFF/, "");
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";

  if (/^draft:\s*true\s*$/m.test(frontmatter)) continue;

  slugs.push(toAstroSlug(file.replace(/\.md$/, "")));
}

slugs.sort();

const expected = JSON.stringify(slugs, null, 2);
const actual = JSON.stringify([...POST_SLUGS].sort(), null, 2);

if (actual !== expected) {
  console.error("functions/_shared/post-slugs.js does not match published blog content.");
  console.error(`Expected:\n${expected}`);
  console.error(`Actual:\n${actual}`);
  process.exit(1);
}

function toAstroSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
