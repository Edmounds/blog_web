import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import sharp from "sharp";

import {
  LIFE_COVER_BOXES,
  LIFE_COVER_QUERIES,
  LIFE_COVER_SECTIONS,
  selectLifeCoverSources,
} from "./lib/life-covers.mjs";

const OUTPUT_PATH = new URL("../src/data/life-covers.json", import.meta.url);
const PLACEHOLDER_PATH = new URL("../public/images/placeholders/default-cover.webp", import.meta.url);
const USER_AGENT = "blog-web-life-cover-snapshot/1.0";
const FETCH_TIMEOUT_MS = 15_000;

const { values } = parseArgs({
  options: { local: { type: "boolean", default: false } },
  strict: true,
});

const rowsBySection = readSectionRows();
if (!rowsBySection) {
  console.warn("Could not read Life covers from D1; keeping the committed snapshot.");
  process.exit(0);
}

const sources = selectLifeCoverSources(rowsBySection);
const sections = {};
for (const section of LIFE_COVER_SECTIONS) {
  const box = LIFE_COVER_BOXES[section];
  sections[section] = [];
  for (const source of sources[section]) {
    sections[section].push({
      id: source.id,
      width: box.width,
      height: box.height,
      thumbnail: await renderThumbnail(source, box),
    });
  }
}

const snapshot = { generatedAt: new Date().toISOString(), sections };
await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(
  `Snapshotted Life covers: ${LIFE_COVER_SECTIONS.map((section) => `${section} ${sections[section].length}`).join(", ")}.`,
);

function readSectionRows() {
  const command = LIFE_COVER_SECTIONS.map((section) => LIFE_COVER_QUERIES[section]).join(";\n");
  const child = spawnSync(
    process.execPath,
    [
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "blog_web",
      "--config",
      "./wrangler.astro.jsonc",
      values.local ? "--local" : "--remote",
      "--json",
      "--command",
      `${command};`,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  if (child.status !== 0) {
    if (child.stderr) console.warn(child.stderr.trim());
    return undefined;
  }
  const payload = parseWranglerJson(child.stdout);
  if (!Array.isArray(payload) || payload.length !== LIFE_COVER_SECTIONS.length) {
    console.warn("Unexpected wrangler d1 output shape.");
    return undefined;
  }
  return Object.fromEntries(
    LIFE_COVER_SECTIONS.map((section, index) => [section, payload[index]?.results ?? []]),
  );
}

function parseWranglerJson(stdout) {
  const start = stdout.indexOf("[");
  if (start < 0) return undefined;
  try {
    return JSON.parse(stdout.slice(start));
  } catch {
    return undefined;
  }
}

async function renderThumbnail(source, box) {
  const bytes = (await downloadCover(source)) ?? (await readFile(PLACEHOLDER_PATH));
  const webp = await sharp(bytes)
    .resize(box.width, box.height, { fit: "cover" })
    .webp({ quality: 52, effort: 6 })
    .toBuffer();
  return `data:image/webp;base64,${webp.toString("base64")}`;
}

async function downloadCover({ url, referer }) {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, ...(referer ? { referer } : {}) },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.warn(`Falling back to the placeholder for ${url}: ${error instanceof Error ? error.message : error}`);
    return undefined;
  }
}
