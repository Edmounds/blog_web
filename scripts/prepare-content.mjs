import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import matter from "gray-matter";

const CONTENT_GROUPS = ["blog", "note", "project"];
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const CJK_REGEX = /[\u3400-\u9fff\uf900-\ufaff]/u;
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
  const contentIds = [];
  let bomAdded = 0;

  for (const group of CONTENT_GROUPS) {
    const directory = path.join(rootDir, "src/content", group);
    for (const filePath of await walk(directory)) {
      if (!/\.(md|mdx)$/.test(filePath)) continue;

      const fileBuffer = await readFile(filePath);
      const withBom = hasUtf8Bom(fileBuffer);
      const sourceBuffer = withBom ? fileBuffer.subarray(3) : fileBuffer;
      const source = sourceBuffer.toString("utf8");

      if (path.extname(filePath) === ".md" && CJK_REGEX.test(source) && !withBom) {
        await writeFile(filePath, Buffer.concat([UTF8_BOM, fileBuffer]));
        bomAdded += 1;
      }

      const document = matter(source);
      if (document.data.published === false) continue;
      const slug = path.basename(filePath).replace(/\.(md|mdx)$/, "");
      if (!SLUG_REGEX.test(slug)) {
        throw new Error(`Published content filename must use lowercase kebab-case: ${path.relative(rootDir, filePath)}`);
      }
      contentIds.push(`${group}/${slug}`);
    }
  }

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

  return { bomAdded, contentIds, idsUpdated };
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await prepareContent();
  console.log(`Content ready: ${result.contentIds.length} published ID(s), ${result.bomAdded} BOM added, ID list ${result.idsUpdated ? "updated" : "unchanged"}.`);
}
