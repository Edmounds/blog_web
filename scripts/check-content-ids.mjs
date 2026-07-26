import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { CONTENT_IDS as FUNCTION_CONTENT_IDS } from "../functions/_shared/post-slugs.js";
import { CONTENT_IDS as ASTRO_CONTENT_IDS } from "../src/lib/post-slugs.ts";

const groups = ["blog", "note", "project"];
const contentIds = [];

for (const group of groups) {
  const root = path.join(process.cwd(), "src/content", group);
  for (const file of await walk(root)) {
    if (!/\.(md|mdx)$/.test(file)) continue;
    const source = matter((await readFile(file, "utf8")).replace(/^\uFEFF/, ""));
    if (source.data.published === false) continue;
    const slug = path.basename(file).replace(/\.(md|mdx)$/, "");
    contentIds.push(`${group}/${slug}`);
  }
}

contentIds.sort();
for (const [file, ids] of [
  ["functions/_shared/post-slugs.js", FUNCTION_CONTENT_IDS],
  ["src/lib/post-slugs.ts", ASTRO_CONTENT_IDS],
]) {
  const actual = [...ids].sort();
  if (JSON.stringify(contentIds) !== JSON.stringify(actual)) {
    console.error(`${file} does not match published content IDs.`);
    console.error(`Expected:\n${JSON.stringify(contentIds, null, 2)}`);
    console.error(`Actual:\n${JSON.stringify(actual, null, 2)}`);
    process.exitCode = 1;
  }
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}
