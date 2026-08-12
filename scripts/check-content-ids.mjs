import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

const groups = ["blog", "note"];
const contentIds = [];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

for (const group of groups) {
  const root = path.join(process.cwd(), "src/content", group);
  const seen = new Map();
  for (const file of await walk(root)) {
    if (!/\.(md|mdx)$/.test(file)) continue;
    const source = matter((await readFile(file, "utf8")).replace(/^\uFEFF/, ""));
    if (source.data.published === false) continue;
    const slug = source.data.slug;
    if (typeof slug !== "string" || !slugPattern.test(slug)) {
      throw new Error(`Published content requires a lowercase kebab-case slug: ${path.relative(process.cwd(), file)}`);
    }
    const duplicate = seen.get(slug);
    if (duplicate) {
      throw new Error(`Duplicate ${group} slug "${slug}": ${path.relative(process.cwd(), duplicate)} and ${path.relative(process.cwd(), file)}`);
    }
    seen.set(slug, file);
    contentIds.push(`${group}/${slug}`);
  }
}

contentIds.sort();
for (const file of ["src/lib/post-slugs.ts"]) {
  const ids = parseContentIds(await readFile(file, "utf8"), file);
  const actual = [...ids].sort();
  if (JSON.stringify(contentIds) !== JSON.stringify(actual)) {
    console.error(`${file} does not match published content IDs.`);
    console.error(`Expected:\n${JSON.stringify(contentIds, null, 2)}`);
    console.error(`Actual:\n${JSON.stringify(actual, null, 2)}`);
    process.exitCode = 1;
  }
}

function parseContentIds(source, file) {
  const match = source.match(/export const CONTENT_IDS\s*=\s*(\[[\s\S]*?\])(?:\s+as const)?\s*;/);
  if (!match) throw new Error(`Could not parse CONTENT_IDS from ${file}.`);
  const ids = JSON.parse(match[1].replace(/,\s*]/, "]"));
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    throw new Error(`CONTENT_IDS in ${file} must be a string array.`);
  }
  return ids;
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
