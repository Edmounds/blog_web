import { appendFile, readFile, writeFile, mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { stringify as stringifyYaml } from "yaml";

import { createGoogleTranslateClient } from "./lib/google-translate.mjs";
import { createOpenAITranslateClient } from "./lib/openai-translate.mjs";
import {
  collectMarkdownSegments,
  replaceMarkdownSegments,
  TRANSLATION_ALGORITHM_VERSION,
  translationFingerprint,
} from "./lib/translate-content.mjs";

const ROOT = process.cwd();
const LOCALES = [
  ["en", "EN"], ["ja", "JA"], ["zh-TW", "ZH-TW"],
];
const CONTENT_GROUPS = ["blog", "note", "project", "about"];
const GENERATED_ROOT = path.join(ROOT, "src/i18n/content");
const MESSAGE_SOURCE = path.join(ROOT, "src/i18n/source.json");
const MESSAGE_OUTPUT = path.join(ROOT, "src/i18n/generated");
const MANIFEST_PATH = path.join(ROOT, "src/i18n/translation-manifest.json");
const JOURNAL_PATH = path.join(ROOT, "src/i18n/translation-journal.jsonl");

const provider = {
  name: "OpenAI",
  translate: createOpenAITranslateClient({
    baseUrl: process.env.OPENAI_BASE_URL,
    apiKey: process.env.API_KEY,
    model: process.env.MODEL,
  }),
};
const googleTranslate = createGoogleTranslateClient();
const translateMarkdownSegment = async ({ text, targetLang }) => {
  return provider.translate({ text, sourceLang: "ZH", targetLang });
};
const pendingByFingerprint = new Map();
const activeManifestKeys = new Set();
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
  "slug", "categorySlug", "cover", "portrait", "backgroundKeywords", "name", "href", "icon", "id", "type", "side",
  "projectUrl", "docUrl", "image", "createdAt", "updatedAt", "published",
  "publishedAt", "year", "archiveYear", "showOnHome", "showInArchive", "showInTimeline", "draft",
]).has(key);

const translateText = async ({ locale, targetLang, key, source, manifest, seed, format = "text", preserveFrontmatterKeys = [], translate }) => {
  if (!source.trim()) return source;
  const fingerprintSource = format === "markdown-document" ? `markdown-document-v1\0${source}` : source;
  const fingerprint = translationFingerprint(fingerprintSource);
  const manifestKey = `${locale}:${key}`;
  activeManifestKeys.add(manifestKey);
  const cached = manifest.entries[manifestKey];
  if (cached?.fingerprint === fingerprint && typeof cached.translation === "string") return cached.translation;

  console.log(`[translate] ${manifestKey} started.`);
  const seeded = seed?.[manifestKey];
  const translatorName = translate ? `${provider.name}-segment` : provider.name;
  const sharedKey = `${translatorName}:${locale}:${format}:${fingerprint}`;
  const existing = pendingByFingerprint.get(sharedKey);
  const translation = typeof seeded === "string"
    ? seeded
    : await (existing ?? (() => {
        const promise = runLimited(async () => {
          try {
            return await (translate ?? provider.translate)({ text: source, sourceLang: "ZH", targetLang, format, preserveFrontmatterKeys });
          } catch (error) {
            if (format === "markdown-document") throw error;
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
  console.log(`[translate] ${manifest.updated} updated: ${manifestKey}.`);
  return translation;
};

const translateValue = async ({ value, keyPath, fieldName, locale, targetLang, manifest, seed, translate }) => {
  if (typeof value === "string") {
    if (!shouldTranslateKey(fieldName)) return value;
    return translateText({ locale, targetLang, key: keyPath, source: value, manifest, seed, translate });
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
      translate,
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
        translate,
      });
    }));
    return translated;
  }
  return value;
};

const mergeTranslatedData = (source, translated, fieldName = "frontmatter") => {
  if (typeof source === "string") {
    if (!shouldTranslateKey(fieldName)) return source;
    if (typeof translated !== "string") throw new Error(`Translated frontmatter field "${fieldName}" is missing or invalid.`);
    return translated;
  }
  if (Array.isArray(source)) {
    if (!Array.isArray(translated) || translated.length !== source.length) {
      throw new Error(`Translated frontmatter field "${fieldName}" changed its structure.`);
    }
    return source.map((value, index) => mergeTranslatedData(value, translated[index], fieldName));
  }
  if (isPlainObject(source)) {
    if (!isPlainObject(translated)) throw new Error(`Translated frontmatter field "${fieldName}" changed its structure.`);
    return Object.fromEntries(Object.entries(source).map(([key, value]) => [
      key,
      mergeTranslatedData(value, translated[key], key),
    ]));
  }
  return source;
};

const unwrapMarkdownFence = (value) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return match?.[1] ?? trimmed;
};

const translateDocument = async ({ raw, keyPrefix, locale, targetLang, manifest }) => {
  const sourceDocument = raw.replace(/^\uFEFF/, "");
  const source = matter(sourceDocument);
  const preserveFrontmatterKeys = Object.keys(source.data).filter((key) => !shouldTranslateKey(key));
  let translation;
  let usedFallback = false;
  try {
    translation = await translateText({
      locale,
      targetLang,
      key: `${keyPrefix}.document`,
      source: sourceDocument,
      manifest,
      format: "markdown-document",
      preserveFrontmatterKeys,
    });
  } catch (error) {
    usedFallback = true;
    console.warn(`${provider.name} document translation failed for ${locale}; using segment fallback (${error.message})`);
    const translatedData = await translateValue({
      value: source.data,
      keyPath: `${keyPrefix}.frontmatter`,
      fieldName: "frontmatter",
      locale,
      targetLang,
      manifest,
      translate: translateMarkdownSegment,
    });
    const segments = collectMarkdownSegments(source.content);
    const translatedSegments = await Promise.all(segments.map((text, index) => translateText({
      locale,
      targetLang,
      key: `${keyPrefix}.body[${index}]`,
      source: text,
      manifest,
      format: "markdown-segment",
      translate: translateMarkdownSegment,
    })));
    const imageLabels = [...source.content.matchAll(/!\[([^\]]*)\]\(/g)].map((match) => match[1]);
    const translatedBody = replaceMarkdownSegments(source.content, translatedSegments);
    let imageIndex = 0;
    const preservedBody = translatedBody.replace(/!\[([^\]]*)\]\(/g, () => `![${imageLabels[imageIndex++] ?? ""}](`);
    const yaml = stringifyYaml(mergeTranslatedData(source.data, translatedData), { lineWidth: 0 }).trimEnd();
    translation = `---\n${yaml}\n---\n\n${preservedBody}`;
  }
  const translated = matter(unwrapMarkdownFence(translation));
  if (source.content.trim() && !translated.content.trim()) {
    throw new Error(`Translated document "${keyPrefix}" is missing its Markdown body.`);
  }
  if (usedFallback) {
    const manifestKey = `${locale}:${keyPrefix}.document`;
    const entry = {
      fingerprint: translationFingerprint(`markdown-document-v1\0${sourceDocument}`),
      translation,
    };
    manifest.entries[manifestKey] = entry;
    await checkpointTranslation(manifestKey, entry);
    manifest.updated += 1;
    console.log(`[translate] ${manifest.updated} updated: ${manifestKey} (segment fallback).`);
  }
  return {
    data: mergeTranslatedData(source.data, translated.data),
    body: translated.content,
  };
};

const writeMarkdown = async (filePath, data, body) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const yaml = stringifyYaml(data, { lineWidth: 0 }).trimEnd();
  const normalizedBody = body.trimStart().replace(/[ \t]+$/gm, "");
  await writeFile(filePath, `\uFEFF---\n${yaml}\n---\n\n${normalizedBody}`, "utf8");
};

const translateContentFiles = async ({ locale, targetLang, manifest }) => {
  for (const group of CONTENT_GROUPS) {
    const sourceDir = path.join(ROOT, "src/content", group);
    const outputDir = path.join(GENERATED_ROOT, locale, group);
    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });
    const fileNames = await walkContentFiles(sourceDir);
    await Promise.all(fileNames.map(async (fileName) => {
      const raw = await readFile(path.join(sourceDir, fileName), "utf8");
      if (matter(raw.replace(/^\uFEFF/, "")).data.published === false) return;
      const keyPrefix = `content.${group}.${fileName.replaceAll(path.sep, ".")}`;
      const { data, body } = await translateDocument({ raw, keyPrefix, locale, targetLang, manifest });
      await writeMarkdown(path.join(outputDir, fileName), data, body);
    }));
  }
};

const walkContentFiles = async (directory, prefix = "") => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await walkContentFiles(path.join(directory, entry.name), relative));
    else if (/\.(md|mdx)$/.test(entry.name) && entry.name !== "_empty.md" && entry.name !== "_empty.mdx") files.push(relative);
  }
  return files.sort();
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

  const progressTimer = setInterval(() => {
    console.log(`[translate] Still working: ${manifest.updated} updated, ${activeRequests} active, ${waiters.length} queued.`);
  }, 15_000);
  progressTimer.unref();

  try {
    for (const [locale, targetLang] of LOCALES) {
      console.log(`[translate] ${locale} started.`);
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
      await translateContentFiles({ locale, targetLang, manifest });
      console.log(`[translate] ${locale} complete.`);
    }
  } finally {
    clearInterval(progressTimer);
  }

  const validPrefixes = new Set(LOCALES.map(([locale]) => `${locale}:`));
  manifest.entries = Object.fromEntries(Object.entries(manifest.entries).filter(([key]) =>
    activeManifestKeys.has(key) && [...validPrefixes].some((prefix) => key.startsWith(prefix))));
  const temporaryManifestPath = `${MANIFEST_PATH}.tmp`;
  await writeFile(temporaryManifestPath, `${JSON.stringify({ version: manifest.version, entries: manifest.entries }, null, 2)}\n`, "utf8");
  await rename(temporaryManifestPath, MANIFEST_PATH);
  await writeFile(JOURNAL_PATH, "", "utf8");
  console.log(`Translations ready for ${LOCALES.length} locales (${manifest.updated} updated segments).`);
};

await main();
