import { appendFile, readFile, writeFile, mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { stringify as stringifyYaml } from "yaml";

import { createGoogleTranslateClient } from "./lib/google-translate.mjs";
import { createTranslationProvider } from "./lib/translation-provider.mjs";
import {
  TRANSLATION_ALGORITHM_VERSION,
  collectMarkdownSegments,
  replaceMarkdownSegments,
  translationFingerprint,
} from "./lib/translate-content.mjs";

const ROOT = process.cwd();
const LOCALES = [
  ["en", "EN"], ["ja", "JA"], ["zh-TW", "ZH-TW"],
];
const CONTENT_GROUPS = ["blog", "about"];
const GENERATED_ROOT = path.join(ROOT, "src/content/translations");
const MESSAGE_SOURCE = path.join(ROOT, "src/i18n/source.json");
const MESSAGE_OUTPUT = path.join(ROOT, "src/i18n/generated");
const MANIFEST_PATH = path.join(ROOT, "src/i18n/translation-manifest.json");
const JOURNAL_PATH = path.join(ROOT, "src/i18n/translation-journal.jsonl");

const provider = createTranslationProvider();
const googleTranslate = createGoogleTranslateClient();
const pendingByFingerprint = new Map();
const waiters = [];
let activeRequests = 0;
const configuredConcurrency = Number.parseInt(process.env.TRANSLATION_CONCURRENCY ?? "3", 10);
const concurrency = Number.isFinite(configuredConcurrency) ? Math.min(12, Math.max(1, configuredConcurrency)) : 3;

const runLimited = async (task) => {
  if (activeRequests >= concurrency) await new Promise((resolve) => waiters.push(resolve));
  activeRequests += 1;
  try {
    return await task();
  } finally {
    activeRequests -= 1;
    waiters.shift()?.();
  }
};

const readJson = async (filePath, fallback) => {
  try { return JSON.parse(await readFile(filePath, "utf8")); } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
};

const readJournal = async () => {
  try {
    const content = await readFile(JOURNAL_PATH, "utf8");
    const entries = {};
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      const [key, value] = JSON.parse(line);
      entries[key] = value;
    }
    return entries;
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
};

const checkpointTranslation = async (manifestKey, entry) => {
  await appendFile(JOURNAL_PATH, `${JSON.stringify([manifestKey, entry])}\n`, "utf8");
};

const isPlainObject = (value) => value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
const shouldTranslateKey = (key) => !new Set([
  "slug", "categorySlug", "cover", "portrait", "href", "icon", "id", "type", "side",
  "publishedAt", "year", "order", "archiveYear", "showOnHome", "showInArchive", "showInTimeline", "draft",
]).has(key);

const translateText = async ({ locale, targetLang, key, source, manifest, seed }) => {
  if (!source.trim()) return source;
  const fingerprint = translationFingerprint(source);
  const manifestKey = `${locale}:${key}`;
  const cached = manifest.entries[manifestKey];
  if (cached?.fingerprint === fingerprint && typeof cached.translation === "string") return cached.translation;

  const seeded = seed?.[manifestKey];
  const sharedKey = `${locale}:${fingerprint}`;
  const existing = pendingByFingerprint.get(sharedKey);
  const translation = typeof seeded === "string"
    ? seeded
    : await (existing ?? (() => {
        const promise = runLimited(async () => {
          try {
            return await provider.translate({ text: source, sourceLang: "ZH", targetLang });
          } catch (error) {
            console.warn(`${provider.name} unavailable for ${locale}; using Google Translate fallback (${error.message})`);
            return googleTranslate({ text: source, sourceLang: "ZH", targetLang });
          }
        });
        pendingByFingerprint.set(sharedKey, promise);
        return promise;
      })());
  const entry = { fingerprint, translation };
  manifest.entries[manifestKey] = entry;
  await checkpointTranslation(manifestKey, entry);
  manifest.updated += 1;
  if (manifest.updated % 25 === 0) console.log(`Translated ${manifest.updated} new segments...`);
  return translation;
};

const translateValue = async ({ value, keyPath, fieldName, locale, targetLang, manifest, seed }) => {
  if (typeof value === "string") {
    if (!shouldTranslateKey(fieldName)) return value;
    return translateText({ locale, targetLang, key: keyPath, source: value, manifest, seed });
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((item, index) => translateValue({
      value: item,
      keyPath: `${keyPath}[${index}]`,
      fieldName,
      locale,
      targetLang,
      manifest,
      seed,
    })));
  }
  if (isPlainObject(value)) {
    const translated = {};
    await Promise.all(Object.entries(value).map(async ([key, child]) => {
      translated[key] = await translateValue({
        value: child,
        keyPath: `${keyPath}.${key}`,
        fieldName: key,
        locale,
        targetLang,
        manifest,
        seed,
      });
    }));
    return translated;
  }
  return value;
};

const translateMarkdown = async ({ markdown, keyPrefix, locale, targetLang, manifest, seed }) => {
  const segments = collectMarkdownSegments(markdown);
  const translated = await Promise.all(segments.map((source, index) => translateText({
      locale,
      targetLang,
      key: `${keyPrefix}.body[${index}]`,
      source,
      manifest,
      seed,
    })));
  return replaceMarkdownSegments(markdown, translated);
};

const writeMarkdown = async (filePath, data, body) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const yaml = stringifyYaml(data, { lineWidth: 0 }).trimEnd();
  await writeFile(filePath, `\uFEFF---\n${yaml}\n---\n\n${body.trimStart()}`, "utf8");
};

const translateContentFiles = async ({ locale, targetLang, manifest, seed }) => {
  for (const group of CONTENT_GROUPS) {
    const sourceDir = path.join(ROOT, "src/content", group);
    const outputDir = path.join(GENERATED_ROOT, locale, group);
    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });
    const fileNames = (await readdir(sourceDir)).filter((name) => name.endsWith(".md"));
    await Promise.all(fileNames.map(async (fileName) => {
      const source = matter(await readFile(path.join(sourceDir, fileName), "utf8"));
      const keyPrefix = `content.${group}.${fileName}`;
      const data = await translateValue({
        value: source.data,
        keyPath: `${keyPrefix}.frontmatter`,
        fieldName: "frontmatter",
        locale,
        targetLang,
        manifest,
        seed,
      });
      const body = await translateMarkdown({ markdown: source.content, keyPrefix, locale, targetLang, manifest, seed });
      await writeMarkdown(path.join(outputDir, fileName), data, body);
    }));
  }
};

const main = async () => {
  console.log(`Translation service: ${provider.name}`);
  const previous = await readJson(MANIFEST_PATH, { version: TRANSLATION_ALGORITHM_VERSION, entries: {} });
  const journalEntries = await readJournal();
  const manifest = {
    version: TRANSLATION_ALGORITHM_VERSION,
    entries: previous.version === TRANSLATION_ALGORITHM_VERSION ? { ...(previous.entries ?? {}), ...journalEntries } : journalEntries,
    updated: 0,
  };
  const seed = await readJson(path.join(ROOT, "src/i18n/english-seed.json"), {});
  const messages = JSON.parse(await readFile(MESSAGE_SOURCE, "utf8"));
  await mkdir(MESSAGE_OUTPUT, { recursive: true });

  for (const [locale, targetLang] of LOCALES) {
    const translatedMessages = await translateValue({
      value: messages,
      keyPath: "messages",
      fieldName: "messages",
      locale,
      targetLang,
      manifest,
      seed,
    });
    await writeFile(path.join(MESSAGE_OUTPUT, `${locale}.json`), `${JSON.stringify(translatedMessages, null, 2)}\n`, "utf8");
    await translateContentFiles({ locale, targetLang, manifest, seed });
  }

  const validPrefixes = new Set(LOCALES.map(([locale]) => `${locale}:`));
  manifest.entries = Object.fromEntries(Object.entries(manifest.entries).filter(([key]) => [...validPrefixes].some((prefix) => key.startsWith(prefix))));
  const temporaryManifestPath = `${MANIFEST_PATH}.tmp`;
  await writeFile(temporaryManifestPath, `${JSON.stringify({ version: manifest.version, entries: manifest.entries }, null, 2)}\n`, "utf8");
  await rename(temporaryManifestPath, MANIFEST_PATH);
  await writeFile(JOURNAL_PATH, "", "utf8");
  console.log(`Translations ready for ${LOCALES.length} locales (${manifest.updated} updated segments).`);
};

await main();
