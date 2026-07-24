import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { createGoogleTranslateClient } from "./lib/google-translate.mjs";
import { legacyArtItems } from "./lib/legacy-art-data.mjs";
import { createTranslationProvider } from "./lib/translation-provider.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REMOTE = process.argv.includes("--remote");
const BUCKET = process.env.ART_COVERS_BUCKET ?? "blog-art-covers";
const DATABASE = process.env.ART_DATABASE ?? "blog_web";
const TARGETS = [["zh-TW", "ZH-TW"], ["en", "EN"], ["ja", "JA"]];
const TYPE_GROUPS = ["book", "music", "movie", "series", "anime"];
const primary = createTranslationProvider();
const google = createGoogleTranslateClient({ retries: 1 });
const TRANSLATION_TIMEOUT_MS = Number.parseInt(process.env.ART_MIGRATION_TRANSLATION_TIMEOUT_MS ?? "20000", 10);
const USE_SOURCE_TRANSLATIONS = process.env.ART_MIGRATION_SOURCE_TRANSLATIONS === "1";
const SKIP_OBJECT_HEAD = process.env.ART_MIGRATION_SKIP_OBJECT_HEAD === "1";
const SKIP_OBJECT_UPLOAD = process.env.ART_MIGRATION_SKIP_OBJECT_UPLOAD === "1";

const workdir = await mkdtemp(path.join(os.tmpdir(), "blog-art-migrate-"));

try {
  const sql = [];
  let expectedObjects = 0;
  for (const type of TYPE_GROUPS) {
    const items = legacyArtItems.filter((item) => item.type === type);
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (await itemExists(item.id)) {
        console.log(`[skip] ${item.id} already exists in D1`);
        continue;
      }
      const coverDirectory = process.env.LEGACY_ART_COVERS_DIR ?? path.join(ROOT, "public/images/content/art");
      const candidates = item.coverFiles ?? [item.coverFile];
      let coverPath;
      let bytes;
      for (const coverFile of candidates) {
        try { coverPath = path.resolve(coverDirectory, coverFile); bytes = await readFile(coverPath); break; } catch {}
      }
      if (!bytes || !coverPath) throw new Error(`Missing legacy cover ${candidates.join(" or ")}. Set LEGACY_ART_COVERS_DIR to the archived cover directory.`);
      const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 24);
      const extension = path.extname(coverPath).slice(1).toLowerCase();
      const key = `art/${item.id}/${digest}.${extension}`;
      if (!SKIP_OBJECT_UPLOAD && !(await objectExists(key))) {
        await wrangler(["r2", "object", "put", `${BUCKET}/${key}`, "--file", coverPath, "--content-type", contentType(extension), ...(REMOTE ? ["--remote"] : ["--local"])]);
      }
      expectedObjects += 1;

      const globalIndex = legacyArtItems.findIndex((entry) => entry.id === item.id);
      const collectedOn = subtractDays(new Date(), index);
      const createdAt = new Date(Date.now() - globalIndex * 1000).toISOString();
      const translations = { "zh-CN": { title: item.title, creator: item.creator, extra: item.extra ?? "" } };
      for (const [locale, targetLang] of TARGETS) translations[locale] = await translateFields(translations["zh-CN"], targetLang);

      sql.push(`INSERT OR IGNORE INTO art_items (id, type, source, source_id, isbn, original_title, release_date, cover_key, cover_source_url, collected_on, is_visible, created_at, updated_at) VALUES (${values(
        item.id, item.type, "legacy", null, item.isbn ?? null, item.title, null, key, null, collectedOn, 1, createdAt, createdAt,
      )});`);
      for (const [locale, translation] of Object.entries(translations)) {
        sql.push(`INSERT OR IGNORE INTO art_item_translations (item_id, locale, title, creator, extra) VALUES (${values(item.id, locale, translation.title, translation.creator, translation.extra)});`);
      }
    }
  }

  if (sql.length) {
    const sqlFile = path.join(workdir, "art-import.sql");
    await writeFile(sqlFile, `PRAGMA foreign_keys = ON;\n${sql.join("\n")}\n`, "utf8");
    await wrangler(["d1", "execute", DATABASE, ...(REMOTE ? ["--remote"] : ["--local"]), "--file", sqlFile]);
  }

  const count = await queryJson("SELECT COUNT(*) AS items FROM art_items; SELECT COUNT(*) AS translations FROM art_item_translations;");
  console.log(`Migration complete. Expected legacy objects: ${expectedObjects}`);
  console.log(JSON.stringify(count, null, 2));
} finally {
  await rm(workdir, { recursive: true, force: true });
}

async function translateFields(fields, targetLang) {
  if (USE_SOURCE_TRANSLATIONS) return { ...fields };
  const translated = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!value) { translated[key] = ""; continue; }
    try { translated[key] = await withTimeout(primary.translate({ text: value, sourceLang: "ZH", targetLang }), TRANSLATION_TIMEOUT_MS); }
    catch {
      try { translated[key] = await withTimeout(google({ text: value, sourceLang: "ZH", targetLang }), TRANSLATION_TIMEOUT_MS); }
      catch (error) {
        console.warn(`[translate fallback] ${targetLang} ${key}: ${error.message}; keeping simplified Chinese draft`);
        translated[key] = value;
      }
    }
  }
  return translated;
}

async function itemExists(id) {
  const result = await queryJson(`SELECT id FROM art_items WHERE id = ${quote(id)} LIMIT 1;`);
  return Boolean(result?.[0]?.results?.[0]?.id);
}

async function objectExists(key) {
  if (SKIP_OBJECT_HEAD) return false;
  try {
    await wrangler(["r2", "object", "get", `${BUCKET}/${key}`, ...(REMOTE ? ["--remote"] : ["--local"]), "--file", path.join(workdir, "existing-cover")], { capture: true });
    return true;
  } catch { return false; }
}

async function queryJson(sql) {
  const output = await wrangler(["d1", "execute", DATABASE, ...(REMOTE ? ["--remote"] : ["--local"]), "--command", sql, "--json"], { capture: true });
  return JSON.parse(output);
}

function subtractDays(date, days) {
  const shanghaiDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(date);
  const value = new Date(`${shanghaiDate}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function values(...items) { return items.map((item) => item == null ? "NULL" : typeof item === "number" ? String(item) : quote(item)).join(", "); }
function quote(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function contentType(extension) { return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", svg: "image/svg+xml" }[extension] ?? "application/octet-stream"; }
function withTimeout(promise, timeoutMs) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Translation timed out.")), timeoutMs))]);
}

function wrangler(args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["wrangler", ...args], { cwd: ROOT, stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"] });
    let stdout = ""; let stderr = "";
    if (capture) { child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; }); }
    child.on("error", reject);
    child.on("exit", (code, signal) => code === 0 && !signal ? resolve(stdout) : reject(new Error(stderr || `wrangler exited with ${code ?? signal}`)));
  });
}
