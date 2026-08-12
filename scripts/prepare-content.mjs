import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import matter from "gray-matter";
import { parseDocument } from "yaml";

const CONTENT_GROUPS = ["blog", "note"];
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const hasUtf8Bom = (buffer) =>
  buffer.length >= 3 &&
  buffer[0] === UTF8_BOM[0] &&
  buffer[1] === UTF8_BOM[1] &&
  buffer[2] === UTF8_BOM[2];

const walk = async (directory) => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
};

export const prepareContent = async (rootDir = process.cwd()) => {
  const records = [];
  let slugsAdded = 0;

  for (const group of CONTENT_GROUPS) {
    const directory = path.join(rootDir, "src/content", group);
    for (const filePath of (await walk(directory)).sort()) {
      if (!/\.(md|mdx)$/.test(filePath)) continue;

      const fileBuffer = await readFile(filePath);
      const withBom = hasUtf8Bom(fileBuffer);
      const sourceBuffer = withBom ? fileBuffer.subarray(3) : fileBuffer;
      const source = sourceBuffer.toString("utf8");

      const document = matter(source);
      records.push({ group, filePath, fileBuffer, source, document, withBom });
    }
  }

  const published = records.filter(({ document }) => document.data.published !== false);
  const usedSlugs = new Map(CONTENT_GROUPS.map((group) => [group, new Map()]));

  for (const record of published) {
    const slug = record.document.data.slug;
    if (slug === undefined) continue;
    if (typeof slug !== "string" || !SLUG_REGEX.test(slug)) {
      throw new Error(`Published content slug must use lowercase kebab-case: ${path.relative(rootDir, record.filePath)}`);
    }
    reserveSlug(usedSlugs, record, slug, rootDir);
  }

  for (const record of published) {
    if (record.document.data.slug !== undefined) continue;
    const date = dateKey(record.document.data.createdAt);
    if (!date) {
      throw new Error(`Published content requires a valid createdAt before a slug can be generated: ${path.relative(rootDir, record.filePath)}`);
    }

    const sectionSlugs = usedSlugs.get(record.group);
    let sequence = 1;
    let slug;
    do {
      slug = `${date}-${String(sequence).padStart(2, "0")}`;
      sequence += 1;
    } while (sectionSlugs.has(slug));

    record.document.data.slug = slug;
    reserveSlug(usedSlugs, record, slug, rootDir);
    record.source = addFrontmatterSlug(record.document, slug);
    record.document = matter(record.source);
    slugsAdded += 1;
  }

  for (const record of records) {
    if (record.source === record.fileBuffer.subarray(record.withBom ? 3 : 0).toString("utf8")) continue;
    const sourceBuffer = Buffer.from(record.source, "utf8");
    await writeFile(record.filePath, record.withBom ? Buffer.concat([UTF8_BOM, sourceBuffer]) : sourceBuffer);
  }

  const contentIds = published.map(({ group, document }) => `${group}/${document.data.slug}`);
  contentIds.sort();
  const outputPaths = [{
    path: path.join(rootDir, "src/lib/post-slugs.ts"),
    output: `export const CONTENT_IDS = [\n${contentIds.map((id) => `  ${JSON.stringify(id)},`).join("\n")}\n] as const;\n`,
  }];
  let idsUpdated = false;
  for (const target of outputPaths) {
    let targetUpdated = false;
    try {
      targetUpdated = await readFile(target.path, "utf8") !== target.output;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      targetUpdated = true;
    }
    if (targetUpdated) await writeFile(target.path, target.output, "utf8");
    idsUpdated ||= targetUpdated;
  }

  return { contentIds, idsUpdated, slugsAdded };
};

const reserveSlug = (usedSlugs, record, slug, rootDir) => {
  const sectionSlugs = usedSlugs.get(record.group);
  const existing = sectionSlugs.get(slug);
  if (existing) {
    throw new Error(
      `Duplicate ${record.group} slug "${slug}": ${path.relative(rootDir, existing)} and ${path.relative(rootDir, record.filePath)}`,
    );
  }
  sectionSlugs.set(slug, record.filePath);
};

const dateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10).replaceAll("-", "");
};

const addFrontmatterSlug = (document, slug) => {
  const yaml = parseDocument(document.matter);
  yaml.set("slug", slug);
  return `---\n${String(yaml).trimEnd()}\n---${document.content}`;
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await prepareContent();
  console.log(`Content ready: ${result.contentIds.length} published ID(s), ${result.slugsAdded} slug(s) added, ID list ${result.idsUpdated ? "updated" : "unchanged"}.`);
}
