import {
  appendFile,
  readFile,
  writeFile,
  mkdir,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { stringify as stringifyYaml } from "yaml";

import { createGoogleTranslateClient } from "./lib/google-translate.mjs";
import { createOpenAITranslateClient } from "./lib/openai-translate.mjs";
import {
  collectMarkdownSegments,
  parseTranslationJournal,
  replaceMarkdownSegments,
  TRANSLATION_ALGORITHM_VERSION,
  translationFingerprint,
} from "./lib/translate-content.mjs";

const ROOT = process.cwd();
const LOCALES = [
  ["en", "EN"],
  ["ja", "JA"],
  ["zh-TW", "ZH-TW"],
];
const CONTENT_GROUPS = ["blog", "note", "about"];
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
    reasoningEffort: process.env.REASONING_EFFORT,
  }),
};
const googleTranslate = createGoogleTranslateClient();
const translateMarkdownSegment = async ({ text, targetLang, context }) => {
  return provider.translate({
    text,
    sourceLang: "ZH",
    targetLang,
    format: "markdown-segment",
    context,
  });
};
const pendingByFingerprint = new Map();
const activeManifestKeys = new Set();
const waiters = [];
let activeRequests = 0;
const configuredConcurrency = Number.parseInt(
  process.env.TRANSLATION_CONCURRENCY ?? "4",
  10,
);
const concurrency = Number.isFinite(configuredConcurrency)
  ? Math.min(12, Math.max(1, configuredConcurrency))
  : 4;

const runLimited = async (task) => {
  if (activeRequests >= concurrency)
    await new Promise((resolve) => waiters.push(resolve));
  activeRequests += 1;
  try {
    return await task();
  } finally {
    activeRequests -= 1;
    waiters.shift()?.();
  }
};

const readJson = async (filePath, fallback) => {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
};

const readJournal = async () => {
  try {
    const content = await readFile(JOURNAL_PATH, "utf8");
    return parseTranslationJournal(content);
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
};

const checkpointTranslation = async (manifestKey, entry) => {
  await appendFile(
    JOURNAL_PATH,
    `${JSON.stringify([manifestKey, entry])}\n`,
    "utf8",
  );
};

const isPlainObject = (value) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !(value instanceof Date);
const shouldTranslateKey = (key) =>
  !new Set([
    "slug",
    "categorySlug",
    "cover",
    "portrait",
    "backgroundKeywords",
    "name",
    "href",
    "icon",
    "id",
    "type",
    "side",
    "image",
    "createdAt",
    "updatedAt",
    "published",
    "publishedAt",
    "year",
    "archiveYear",
    "showOnHome",
    "showInArchive",
    "showInTimeline",
    "draft",
  ]).has(key);

// Full translations come from OpenAI. When OpenAI is unavailable the run is
// incremental instead: previously translated entries are kept as they are
// (even when the source changed), and only entries with no translation at all
// are gap-filled through Google Translate. Gap fills are marked with
// `fallback: true` so the next successful OpenAI run replaces them.
const translateText = async ({
  locale,
  targetLang,
  key,
  source,
  manifest,
  seed,
  format = "text",
  preserveFrontmatterKeys = [],
  context,
  translate,
}) => {
  if (!source.trim()) return source;
  const fingerprintSource =
    format === "markdown-document" ? `markdown-document-v1\0${source}` : source;
  const fingerprint = translationFingerprint(fingerprintSource);
  const manifestKey = `${locale}:${key}`;
  activeManifestKeys.add(manifestKey);
  const cached = manifest.entries[manifestKey];
  const cachedTranslation =
    typeof cached?.translation === "string" ? cached.translation : undefined;
  if (
    cached?.fingerprint === fingerprint &&
    cachedTranslation !== undefined &&
    cached.fallback !== true
  ) {
    return cachedTranslation;
  }

  console.log(`[translate] ${manifestKey} started.`);
  const seeded = seed?.[manifestKey];
  const translatorName = translate ? `${provider.name}-segment` : provider.name;
  const sharedKey = `${translatorName}:${locale}:${format}:${fingerprint}`;
  const existing = pendingByFingerprint.get(sharedKey);
  const result =
    typeof seeded === "string"
      ? { translation: seeded, mode: "fresh" }
      : await (existing ??
          (() => {
            const promise = runLimited(async () => {
              try {
                const translation = await (translate ?? provider.translate)({
                  text: source,
                  sourceLang: "ZH",
                  targetLang,
                  format,
                  preserveFrontmatterKeys,
                  context,
                });
                return { translation, mode: "fresh" };
              } catch (error) {
                if (cachedTranslation !== undefined) {
                  console.warn(
                    `${provider.name} unavailable for ${manifestKey}; keeping the previous translation (${error.message})`,
                  );
                  return { translation: cachedTranslation, mode: "reused" };
                }
                if (format === "markdown-document") throw error;
                console.warn(
                  `${provider.name} unavailable for ${manifestKey}; gap-filling with Google Translate (${error.message})`,
                );
                return {
                  translation: await googleTranslate({
                    text: source,
                    sourceLang: "ZH",
                    targetLang,
                  }),
                  mode: "fallback",
                };
              }
            });
            pendingByFingerprint.set(sharedKey, promise);
            return promise;
          })());
  // A reused translation keeps its old manifest entry untouched, so the next
  // run retries OpenAI for it.
  if (result.mode === "reused") return result.translation;
  const entry =
    result.mode === "fallback"
      ? { fingerprint, translation: result.translation, fallback: true }
      : { fingerprint, translation: result.translation };
  manifest.entries[manifestKey] = entry;
  await checkpointTranslation(manifestKey, entry);
  manifest.updated += 1;
  console.log(
    `[translate] ${manifest.updated} updated: ${manifestKey}${result.mode === "fallback" ? " (Google gap fill)" : ""}.`,
  );
  return result.translation;
};

const translateValue = async ({
  value,
  keyPath,
  fieldName,
  locale,
  targetLang,
  manifest,
  seed,
  context,
  translate,
}) => {
  if (typeof value === "string") {
    if (!shouldTranslateKey(fieldName)) return value;
    return translateText({
      locale,
      targetLang,
      key: keyPath,
      source: value,
      manifest,
      seed,
      context,
      translate,
    });
  }
  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item, index) =>
        translateValue({
          value: item,
          keyPath: `${keyPath}[${index}]`,
          fieldName,
          locale,
          targetLang,
          manifest,
          seed,
          context,
          translate,
        }),
      ),
    );
  }
  if (isPlainObject(value)) {
    const translated = {};
    await Promise.all(
      Object.entries(value).map(async ([key, child]) => {
        translated[key] = await translateValue({
          value: child,
          keyPath: `${keyPath}.${key}`,
          fieldName: key,
          locale,
          targetLang,
          manifest,
          seed,
          context,
          translate,
        });
      }),
    );
    return translated;
  }
  return value;
};

const mergeTranslatedData = (source, translated, fieldName = "frontmatter") => {
  if (!shouldTranslateKey(fieldName)) return source;
  if (typeof source === "string") {
    if (typeof translated !== "string")
      throw new Error(
        `Translated frontmatter field "${fieldName}" is missing or invalid.`,
      );
    return translated;
  }
  if (Array.isArray(source)) {
    if (!Array.isArray(translated) || translated.length !== source.length) {
      throw new Error(
        `Translated frontmatter field "${fieldName}" changed its structure.`,
      );
    }
    return source.map((value, index) =>
      mergeTranslatedData(value, translated[index], fieldName),
    );
  }
  if (isPlainObject(source)) {
    if (!isPlainObject(translated))
      throw new Error(
        `Translated frontmatter field "${fieldName}" changed its structure.`,
      );
    return Object.fromEntries(
      Object.entries(source).map(([key, value]) => [
        key,
        mergeTranslatedData(value, translated[key], key),
      ]),
    );
  }
  return source;
};

const unwrapMarkdownFence = (value) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return match?.[1] ?? trimmed;
};

const parseTranslatedDocument = (source, translation, keyPrefix) => {
  const translated = matter(unwrapMarkdownFence(translation));
  if (source.content.trim() && !translated.content.trim()) {
    throw new Error(
      `Translated document "${keyPrefix}" is missing its Markdown body.`,
    );
  }
  return {
    data: mergeTranslatedData(source.data, translated.data),
    body: translated.content,
  };
};

const indexDocumentSegments = (keyPrefix, locale, source, parsed, manifest) => {
  const sourceSegments = collectMarkdownSegments(source.content);
  const translatedSegments = collectMarkdownSegments(parsed.body);
  if (sourceSegments.length === translatedSegments.length) {
    for (let i = 0; i < sourceSegments.length; i += 1) {
      const fingerprint = translationFingerprint(sourceSegments[i]);
      const segmentKey = `${locale}:${keyPrefix}.segment:${fingerprint}`;
      activeManifestKeys.add(segmentKey);
      if (
        !manifest.entries[segmentKey] ||
        manifest.entries[segmentKey].fingerprint !== fingerprint
      ) {
        manifest.entries[segmentKey] = {
          fingerprint,
          translation: translatedSegments[i],
        };
      }
    }
  }
};

const translateDocument = async ({
  raw,
  keyPrefix,
  locale,
  targetLang,
  manifest,
  seed,
}) => {
  const sourceDocument = raw.replace(/^\uFEFF/, "");
  const source = matter(sourceDocument);
  const preserveFrontmatterKeys = Object.keys(source.data).filter(
    (key) => !shouldTranslateKey(key),
  );
  const docFingerprint = translationFingerprint(
    `markdown-document-v1\0${sourceDocument}`,
  );
  const docManifestKey = `${locale}:${keyPrefix}.document`;
  activeManifestKeys.add(docManifestKey);

  const cachedDoc = manifest.entries[docManifestKey];
  const hasValidCachedDoc =
    cachedDoc?.fingerprint === docFingerprint &&
    typeof cachedDoc?.translation === "string" &&
    cachedDoc.fallback !== true;

  if (hasValidCachedDoc) {
    const parsed = parseTranslatedDocument(
      source,
      cachedDoc.translation,
      keyPrefix,
    );
    indexDocumentSegments(keyPrefix, locale, source, parsed, manifest);
    return parsed;
  }

  // If we have an existing translation for this document from a prior run,
  // seed the segment cache so unchanged segments and invariant edits require 0 API calls
  if (cachedDoc?.translation && typeof cachedDoc.translation === "string") {
    try {
      const prevParsed = matter(unwrapMarkdownFence(cachedDoc.translation));
      const prevSegments = collectMarkdownSegments(prevParsed.content);
      const currentSegments = collectMarkdownSegments(source.content);
      if (prevSegments.length === currentSegments.length) {
        for (let i = 0; i < currentSegments.length; i += 1) {
          const fingerprint = translationFingerprint(currentSegments[i]);
          const segmentKey = `${locale}:${keyPrefix}.segment:${fingerprint}`;
          if (!manifest.entries[segmentKey]) {
            manifest.entries[segmentKey] = {
              fingerprint,
              translation: prevSegments[i],
            };
          }
        }
      }
    } catch {
      // Ignore parse failure of stale translation
    }
  }

  // Check individual translatable segments
  const sourceSegments = collectMarkdownSegments(source.content);
  const segmentEntries = sourceSegments.map((text) => {
    const fingerprint = translationFingerprint(text);
    const segmentKey = `${locale}:${keyPrefix}.segment:${fingerprint}`;
    activeManifestKeys.add(segmentKey);
    const cached = manifest.entries[segmentKey];
    const cachedTranslation =
      typeof cached?.translation === "string" && cached.fallback !== true
        ? cached.translation
        : undefined;
    return {
      text,
      fingerprint,
      segmentKey,
      cachedTranslation,
    };
  });

  const dirtySegments = segmentEntries.filter((s) => !s.cachedTranslation);
  const dirtyRatio =
    sourceSegments.length > 0
      ? dirtySegments.length / sourceSegments.length
      : 0;
  const isFreshDocument = !cachedDoc?.translation;

  // Fresh document with major changes (>60% dirty): use full document translation for best fluency
  if (isFreshDocument && (dirtyRatio > 0.6 || sourceSegments.length === 0)) {
    try {
      const translation = await translateText({
        locale,
        targetLang,
        key: `${keyPrefix}.document`,
        source: sourceDocument,
        manifest,
        seed,
        format: "markdown-document",
        preserveFrontmatterKeys,
      });
      const parsed = parseTranslatedDocument(source, translation, keyPrefix);
      indexDocumentSegments(keyPrefix, locale, source, parsed, manifest);
      return parsed;
    } catch (error) {
      console.warn(
        `${provider.name} full document translation failed for ${locale}; falling back to segment mode (${error.message})`,
      );
    }
  }

  // Incremental / Invariant Passthrough mode:
  const documentContext = [
    source.data.title ? `Title: ${source.data.title}` : "",
    source.data.summary ? `Summary: ${source.data.summary}` : "",
    source.data.description ? `Description: ${source.data.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const translatedData = await translateValue({
    value: source.data,
    keyPath: `${keyPrefix}.frontmatter`,
    fieldName: "frontmatter",
    locale,
    targetLang,
    manifest,
    seed,
    context: documentContext,
    translate: translateMarkdownSegment,
  });

  if (dirtySegments.length > 0) {
    await Promise.all(
      dirtySegments.map(async (segment) => {
        segment.cachedTranslation = await translateText({
          locale,
          targetLang,
          key: `${keyPrefix}.segment:${segment.fingerprint}`,
          source: segment.text,
          manifest,
          seed,
          format: "markdown-segment",
          context: documentContext,
          translate: translateMarkdownSegment,
        });
      }),
    );
  }

  const allTranslatedSegments = segmentEntries.map((s) => s.cachedTranslation);
  const translatedBody = replaceMarkdownSegments(
    source.content,
    allTranslatedSegments,
  );
  const mergedData = mergeTranslatedData(source.data, translatedData);
  const yaml = stringifyYaml(mergedData, { lineWidth: 0 }).trimEnd();
  const translation = `---\n${yaml}\n---\n\n${translatedBody}`;
  const parsed = parseTranslatedDocument(source, translation, keyPrefix);

  const docEntry = {
    fingerprint: docFingerprint,
    translation,
    ...(dirtySegments.some((s) => manifest.entries[s.segmentKey]?.fallback)
      ? { fallback: true }
      : {}),
  };
  manifest.entries[docManifestKey] = docEntry;
  await checkpointTranslation(docManifestKey, docEntry);
  manifest.updated += 1;
  console.log(
    `[translate] ${manifest.updated} updated: ${docManifestKey} (${dirtySegments.length === 0 ? "invariant passthrough / 0 API calls" : `incremental: ${dirtySegments.length}/${sourceSegments.length} segments translated`}).`,
  );
  return parsed;
};

const writeMarkdown = async (filePath, data, body) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const yaml = stringifyYaml(data, { lineWidth: 0 }).trimEnd();
  const normalizedBody = body.trimStart().replace(/[ \t]+$/gm, "");
  await writeFile(
    filePath,
    `\uFEFF---\n${yaml}\n---\n\n${normalizedBody}`,
    "utf8",
  );
};

const translateContentFiles = async ({
  locale,
  targetLang,
  manifest,
  seed,
}) => {
  for (const group of CONTENT_GROUPS) {
    const sourceDir = path.join(ROOT, "src/content", group);
    const outputDir = path.join(GENERATED_ROOT, locale, group);
    await mkdir(outputDir, { recursive: true });
    const fileNames = await walkContentFiles(sourceDir);
    const written = new Set();
    await Promise.all(
      fileNames.map(async (fileName) => {
        const raw = await readFile(path.join(sourceDir, fileName), "utf8");
        if (matter(raw.replace(/^\uFEFF/, "")).data.published === false) return;
        const keyPrefix = `content.${group}.${fileName.replaceAll(path.sep, ".")}`;
        const { data, body } = await translateDocument({
          raw,
          keyPrefix,
          locale,
          targetLang,
          manifest,
          seed,
        });
        await writeMarkdown(path.join(outputDir, fileName), data, body);
        written.add(fileName);
      }),
    );
    // Prune stale outputs only after successful writes so an interrupted run
    // never deletes previously generated translations.
    for (const staleFile of await walkContentFiles(outputDir)) {
      if (!written.has(staleFile))
        await rm(path.join(outputDir, staleFile), { force: true });
    }
  }
};

const walkContentFiles = async (directory, prefix = "") => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory())
      files.push(
        ...(await walkContentFiles(path.join(directory, entry.name), relative)),
      );
    else if (
      /\.(md|mdx)$/.test(entry.name) &&
      entry.name !== "_empty.md" &&
      entry.name !== "_empty.mdx"
    )
      files.push(relative);
  }
  return files.sort();
};

const main = async () => {
  console.log(`Translation service: ${provider.name}`);
  const previous = await readJson(MANIFEST_PATH, {
    version: TRANSLATION_ALGORITHM_VERSION,
    entries: {},
  });
  const journalEntries = await readJournal();
  const manifest = {
    version: TRANSLATION_ALGORITHM_VERSION,
    entries:
      previous.version === TRANSLATION_ALGORITHM_VERSION
        ? { ...(previous.entries ?? {}), ...journalEntries }
        : journalEntries,
    updated: 0,
  };
  const seed = await readJson(
    path.join(ROOT, "src/i18n/english-seed.json"),
    {},
  );
  const messages = JSON.parse(await readFile(MESSAGE_SOURCE, "utf8"));
  await mkdir(MESSAGE_OUTPUT, { recursive: true });

  const progressTimer = setInterval(() => {
    console.log(
      `[translate] Still working: ${manifest.updated} updated, ${activeRequests} active, ${waiters.length} queued.`,
    );
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
      await writeFile(
        path.join(MESSAGE_OUTPUT, `${locale}.json`),
        `${JSON.stringify(translatedMessages, null, 2)}\n`,
        "utf8",
      );
      await translateContentFiles({ locale, targetLang, manifest, seed });
      console.log(`[translate] ${locale} complete.`);
    }
  } finally {
    clearInterval(progressTimer);
  }

  const validPrefixes = new Set(LOCALES.map(([locale]) => `${locale}:`));
  manifest.entries = Object.fromEntries(
    Object.entries(manifest.entries).filter(
      ([key]) =>
        activeManifestKeys.has(key) &&
        [...validPrefixes].some((prefix) => key.startsWith(prefix)),
    ),
  );
  const temporaryManifestPath = `${MANIFEST_PATH}.tmp`;
  await writeFile(
    temporaryManifestPath,
    `${JSON.stringify({ version: manifest.version, entries: manifest.entries }, null, 2)}\n`,
    "utf8",
  );
  await rename(temporaryManifestPath, MANIFEST_PATH);
  await writeFile(JOURNAL_PATH, "", "utf8");
  console.log(
    `Translations ready for ${LOCALES.length} locales (${manifest.updated} updated segments).`,
  );
};

await main();
