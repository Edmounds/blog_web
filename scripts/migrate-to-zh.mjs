import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import matter from "gray-matter";
import { stringify as stringifyYaml } from "yaml";

import { createDeepLxClient } from "./lib/deeplx.mjs";
import { collectMarkdownSegments, replaceMarkdownSegments } from "./lib/translate-content.mjs";

const ROOT = process.cwd();
const GROUPS = process.env.MIGRATE_CONTENT_GROUPS?.split(",").filter(Boolean) ?? ["blog", "about"];
const translate = createDeepLxClient({ baseUrl: process.env.DEEPLX_BASE_URL, apiKey: process.env.DEEPLX_API_KEY });
let seed = {};
const execFileAsync = promisify(execFile);
const restoreFromHead = process.argv.includes("--from-git-head");

try {
  seed = JSON.parse(await readFile(path.join(ROOT, "src/i18n/english-seed.json"), "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const shouldTranslateKey = (key) => !new Set([
  "slug", "categorySlug", "cover", "portrait", "href", "icon", "id", "side",
  "publishedAt", "year", "archiveYear", "showOnHome", "showInArchive", "showInTimeline", "draft",
]).has(key);

const translateValue = async (value, keyPath, fieldName) => {
  if (typeof value === "string") {
    if (!shouldTranslateKey(fieldName) || !value.trim()) return value;
    seed[`en:${keyPath}`] = value;
    return translate({ text: value, sourceLang: "EN", targetLang: "ZH" });
  }
  if (Array.isArray(value)) return Promise.all(value.map((item, index) => translateValue(item, `${keyPath}[${index}]`, fieldName)));
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const output = {};
    for (const [key, child] of Object.entries(value)) output[key] = await translateValue(child, `${keyPath}.${key}`, key);
    return output;
  }
  return value;
};

const writeMarkdown = async (filePath, data, body) => {
  const yaml = stringifyYaml(data, { lineWidth: 0 }).trimEnd();
  const content = `\uFEFF---\n${yaml}\n---\n\n${body.trimStart()}`;
  await writeFile(filePath, content, "utf8");
};

for (const group of GROUPS) {
  const dir = path.join(ROOT, "src/content", group);
  await mkdir(dir, { recursive: true });
  const files = restoreFromHead
    ? (await execFileAsync("git", ["ls-tree", "--name-only", `HEAD:src/content/${group}`], { cwd: ROOT })).stdout.split("\n").filter((name) => name.endsWith(".md"))
    : (await readdir(dir)).filter((name) => name.endsWith(".md"));
  for (const fileName of files) {
    const filePath = path.join(dir, fileName);
    const relativePath = path.relative(ROOT, filePath).split(path.sep).join("/");
    const sourceText = restoreFromHead
      ? (await execFileAsync("git", ["show", `HEAD:${relativePath}`], { cwd: ROOT, maxBuffer: 10 * 1024 * 1024 })).stdout
      : await readFile(filePath, "utf8");
    const parsed = matter(sourceText);
    const prefix = `content.${group}.${fileName}`;
    const data = await translateValue(parsed.data, `${prefix}.frontmatter`, "frontmatter");
    const segments = collectMarkdownSegments(parsed.content);
    const translatedSegments = [];
    for (let index = 0; index < segments.length; index += 1) {
      const source = segments[index];
      seed[`en:${prefix}.body[${index}]`] = source;
      translatedSegments.push(await translate({ text: source, sourceLang: "EN", targetLang: "ZH" }));
    }
    await writeMarkdown(filePath, data, replaceMarkdownSegments(parsed.content, translatedSegments));
    console.log(`Migrated ${group}/${fileName}`);
  }
}

await mkdir(path.join(ROOT, "src/i18n"), { recursive: true });
await writeFile(path.join(ROOT, "src/i18n/english-seed.json"), `${JSON.stringify(seed, null, 2)}\n`, "utf8");
await writeFile(path.join(ROOT, "src/i18n/.zh-migration-complete"), `${new Date().toISOString()}\n`, "utf8");
console.log(`Chinese migration complete (${Object.keys(seed).length} English seed segments preserved).`);
