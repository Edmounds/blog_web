import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { createResponsiveImage } from "./image-optimization.mjs";

const DEFAULT_BUCKET = "blog-images";
const DEFAULT_PUBLIC_URL = "https://img.muelsyse.us";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const MANIFEST_FILE = ".blog-images-manifest.json";
const MANIFEST_VERSION = 3;
export const CONTENT_GROUPS = ["blog", "note", "project"];

const contentTypes = new Map([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);
const rasterExtensions = new Set([".jpeg", ".jpg", ".png", ".webp"]);

const isLocalAbsolutePath = (value) => {
  if (value.startsWith("file://")) return true;
  return path.isAbsolute(value) && !value.startsWith("/images/");
};

const toLocalPath = (value) => {
  if (value.startsWith("file://")) return fileURLToPath(value);
  return decodeURIComponent(value.replaceAll(/\\([\\ ()])/g, "$1"));
};

const splitMarkdownDestination = (destination) => {
  if (destination.startsWith("<")) {
    const close = destination.indexOf(">");
    if (close === -1) return undefined;
    return { before: "<", path: destination.slice(1, close), after: destination.slice(close) };
  }
  return { before: "", path: destination, after: "" };
};

const findMarkdownImageClose = (source, start) => {
  let depth = 0;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) { escaped = false; continue; }
    if (character === "\\") { escaped = true; continue; }
    if (character === "(") depth += 1;
    else if (character === ")") {
      if (depth === 0) return index;
      depth -= 1;
    }
    if (character === "\n") return -1;
  }
  return -1;
};

const splitDestinationAndTitle = (destination) => {
  if (destination.startsWith("<")) {
    const close = destination.indexOf(">");
    if (close === -1) return undefined;
    return { pathDestination: destination.slice(0, close + 1), title: destination.slice(close + 1) };
  }
  const titleMatch = destination.match(/[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^\)\n]*\))[ \t]*$/);
  return titleMatch
    ? { pathDestination: destination.slice(0, titleMatch.index), title: titleMatch[0] }
    : { pathDestination: destination, title: "" };
};

const collectBodyReferences = (source, offset, references) => {
  for (const match of source.matchAll(/!\[[^\]\n]*\]\(/g)) {
    const destinationStartInSource = match.index + match[0].length;
    const destinationEndInSource = findMarkdownImageClose(source, destinationStartInSource);
    if (destinationEndInSource === -1) continue;
    const destination = source.slice(destinationStartInSource, destinationEndInSource);
    const destinationParts = splitDestinationAndTitle(destination);
    if (!destinationParts) continue;
    const split = splitMarkdownDestination(destinationParts.pathDestination);
    if (!split) continue;
    const localPath = toLocalPath(split.path);
    if (!isLocalAbsolutePath(localPath)) continue;
    const destinationStart = offset + destinationStartInSource;
    references.push({
      start: destinationStart,
      end: destinationStart + destinationParts.pathDestination.length,
      localPath,
      render: (url) => `${split.before}${url}${split.after}`,
    });
  }
};

const collectReferences = (source) => {
  const references = [];
  const bomOffset = source.startsWith("\uFEFF") ? 1 : 0;
  const hasFrontmatter = source.slice(bomOffset).startsWith("---");
  const frontmatterEnd = hasFrontmatter ? source.indexOf("\n---", bomOffset + 3) : -1;
  const bodyStart = frontmatterEnd === -1 ? 0 : frontmatterEnd + 4;
  collectBodyReferences(source.slice(bodyStart), bodyStart, references);
  return references;
};

const atomicWrite = async (filePath, contents) => {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, contents, "utf8");
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
};

const emptyManifest = () => ({ version: MANIFEST_VERSION, assets: {}, keys: [], pendingDeletion: [] });

export const readImageManifest = async (manifestPath) => {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.version === 1 && Array.isArray(manifest.keys)) {
      return { ...emptyManifest(), keys: manifest.keys.filter((key) => typeof key === "string" && key.startsWith("blog/")) };
    }
    if (manifest.version !== MANIFEST_VERSION || !manifest.assets || !Array.isArray(manifest.keys) || !Array.isArray(manifest.pendingDeletion)) {
      throw new Error(`${manifestPath} has an unsupported format`);
    }
    return manifest;
  } catch (error) {
    if (error?.code === "ENOENT") return emptyManifest();
    throw error;
  }
};

export const writeImageManifest = (manifestPath, manifest) => atomicWrite(
  manifestPath,
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const assetUrl = (publicUrl, key) => `${publicUrl.replace(/\/$/, "")}/${key}`;

const readSvgDimensions = (source) => {
  const width = source.match(/\bwidth=["']([\d.]+)(?:px)?["']/i)?.[1];
  const height = source.match(/\bheight=["']([\d.]+)(?:px)?["']/i)?.[1];
  if (width && height) return { width: Math.round(Number(width)), height: Math.round(Number(height)) };
  const viewBox = source.match(/\bviewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  return viewBox ? { width: Math.round(Number(viewBox[1])), height: Math.round(Number(viewBox[2])) } : {};
};

export const createManagedImage = async ({
  filePath,
  publicUrl = DEFAULT_PUBLIC_URL,
  temporaryRoot,
  objectBaseKey,
}) => {
  try { await access(filePath); } catch { throw new Error(`${filePath} does not exist`); }
  if (!(await stat(filePath)).isFile()) throw new Error(`${filePath} is not a file`);
  const extension = path.extname(filePath).toLowerCase();
  const contentType = contentTypes.get(extension);
  if (!contentType) throw new Error(`${filePath} uses an unsupported image type`);
  const bytes = await readFile(filePath);
  const digest = createHash("sha256").update(bytes).digest("hex");

  if (!rasterExtensions.has(extension)) {
    const key = `blog/${digest}${extension}`;
    const dimensions = extension === ".svg"
      ? readSvgDimensions(bytes.toString("utf8"))
      : await sharp(filePath, { animated: true }).metadata();
    const url = assetUrl(publicUrl, key);
    return {
      sourceUrl: url,
      fallbackUrl: url,
      manifestAsset: {
        kind: "passthrough",
        width: dimensions.width,
        height: dimensions.height,
        fallback: url,
      },
      uploads: [{ filePath, key, contentType, cacheControl: CACHE_CONTROL }],
    };
  }

  const frameCount = (await sharp(filePath, { animated: true }).metadata()).pages ?? 1;
  if (frameCount > 1) {
    const key = `blog/${digest}${extension}`;
    const metadata = await sharp(filePath, { animated: true }).metadata();
    const url = assetUrl(publicUrl, key);
    return {
      sourceUrl: url,
      fallbackUrl: url,
      manifestAsset: {
        kind: "passthrough",
        width: metadata.width,
        height: metadata.pageHeight ?? metadata.height,
        fallback: url,
      },
      uploads: [{ filePath, key, contentType, cacheControl: CACHE_CONTROL }],
    };
  }

  const baseKey = objectBaseKey ?? `blog/${digest}`;
  const objectDirectory = path.posix.dirname(baseKey);
  const objectStem = path.posix.basename(baseKey);
  const outputDirectory = path.join(temporaryRoot, digest);
  const responsive = await createResponsiveImage({ sourcePath: filePath, outputDirectory, stem: objectStem });
  const uploads = responsive.variants.map((variant) => ({
    filePath: variant.filePath,
    key: path.posix.join(
      objectDirectory,
      `${path.basename(variant.filePath)}${variant.format === "avif" ? ".webp" : ""}`,
    ),
    contentType: `image/${variant.format}`,
    cacheControl: CACHE_CONTROL,
  }));
  const sources = Object.fromEntries(["avif", "webp"].map((format) => [
    format,
    responsive.variants.filter((variant) => variant.format === format).map((variant) => ({
      width: variant.width,
      url: assetUrl(publicUrl, path.posix.join(
        objectDirectory,
        `${path.basename(variant.filePath)}${variant.format === "avif" ? ".webp" : ""}`,
      )),
      quality: variant.quality,
      ssim: Number(variant.ssim.toFixed(6)),
      bytes: variant.size,
    })),
  ]));
  const fallback = sources.webp.at(-1).url;
  return {
    sourceUrl: fallback,
    fallbackUrl: fallback,
    manifestAsset: {
      kind: "responsive",
      sourceDigest: responsive.digest,
      width: responsive.width,
      height: responsive.height,
      fallback,
      sources,
    },
    uploads,
  };
};

const rewriteSource = (source, references, imagesByPath) => {
  let output = source;
  for (const reference of [...references].sort((a, b) => b.start - a.start)) {
    const image = imagesByPath.get(reference.localPath);
    output = `${output.slice(0, reference.start)}${reference.render(image.fallbackUrl)}${output.slice(reference.end)}`;
  }
  return output;
};

const managedKeyPattern = (publicUrl) => new RegExp(
  `${publicUrl.replace(/\/$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(blog/[a-f0-9]{64}(?:-w\d+)?\\.(?:avif|gif|jpe?g|png|svg|webp))`,
  "gi",
);

const collectRemoteRasterReferences = (source, publicUrl) => {
  const references = new Map();
  const baseUrl = `${publicUrl.replace(/\/$/, "")}/`;
  for (const match of source.matchAll(/!\[[^\]\n]*\]\(/g)) {
    const destinationStart = match.index + match[0].length;
    const destinationEnd = findMarkdownImageClose(source, destinationStart);
    if (destinationEnd === -1) continue;
    const parts = splitDestinationAndTitle(source.slice(destinationStart, destinationEnd));
    if (!parts) continue;
    const split = splitMarkdownDestination(parts.pathDestination);
    if (!split?.path.startsWith(baseUrl)) continue;
    let url;
    try { url = new URL(split.path); } catch { continue; }
    const key = decodeURIComponent(url.pathname.slice(1));
    if (!/^(?:bed|blog)\/.+\.(?:jpe?g|png|webp)$/i.test(key)) continue;
    references.set(url.href, { url: url.href, key });
  }
  return references;
};

const collectRemotePassthroughReferences = (source, publicUrl) => {
  const references = new Map();
  const baseUrl = `${publicUrl.replace(/\/$/, "")}/`;
  for (const match of source.matchAll(/!\[[^\]\n]*\]\(/g)) {
    const destinationStart = match.index + match[0].length;
    const destinationEnd = findMarkdownImageClose(source, destinationStart);
    if (destinationEnd === -1) continue;
    const parts = splitDestinationAndTitle(source.slice(destinationStart, destinationEnd));
    const split = parts && splitMarkdownDestination(parts.pathDestination);
    if (!split?.path.startsWith(baseUrl)) continue;
    let url;
    try { url = new URL(split.path); } catch { continue; }
    const key = decodeURIComponent(url.pathname.slice(1));
    if (!/^(?:bed|blog)\/.+\.(?:gif|svg)$/i.test(key)) continue;
    references.set(url.href, { url: url.href, key });
  }
  return references;
};

const responsiveBaseKey = (key) => {
  const extension = path.posix.extname(key);
  return key.slice(0, -extension.length).replace(/-w\d+$/i, "");
};

const collectManagedKeys = (source, publicUrl) => {
  const keys = new Set();
  for (const match of source.matchAll(managedKeyPattern(publicUrl))) keys.add(match[1]);
  return keys;
};

export const syncBlogImages = async ({
  root = process.cwd(),
  bucket = DEFAULT_BUCKET,
  publicUrl = DEFAULT_PUBLIC_URL,
  upload,
} = {}) => {
  if (typeof upload !== "function") throw new Error("syncBlogImages requires an upload function");
  const manifestPath = path.join(root, MANIFEST_FILE);
  const previous = await readImageManifest(manifestPath);
  const articles = [];
  const localPaths = new Set();
  const referencedKeys = new Set();
  const referencedSourceUrls = new Set();
  for (const group of CONTENT_GROUPS) {
    for (const filePath of await walkContentFiles(path.join(root, "src/content", group))) {
      const source = await readFile(filePath, "utf8");
      const references = collectReferences(source);
      for (const reference of references) localPaths.add(reference.localPath);
      for (const key of collectManagedKeys(source, publicUrl)) referencedKeys.add(key);
      for (const reference of collectRemoteRasterReferences(source, publicUrl).values()) {
        referencedSourceUrls.add(reference.url);
      }
      for (const reference of collectRemotePassthroughReferences(source, publicUrl).values()) {
        referencedSourceUrls.add(reference.url);
      }
      articles.push({ filePath, source, references });
    }
  }

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "blog-images-"));
  const imagesByPath = new Map();
  const validationErrors = [];
  try {
    for (const filePath of [...localPaths].sort()) {
      try { imagesByPath.set(filePath, await createManagedImage({ filePath, publicUrl, temporaryRoot })); }
      catch (error) {
        const articleNames = articles.filter((article) => article.references.some((reference) => reference.localPath === filePath))
          .map((article) => path.relative(root, article.filePath)).join(", ");
        validationErrors.push(`${articleNames}: ${error.message}`);
      }
    }
    if (validationErrors.length > 0) throw new Error(validationErrors.join("\n"));

    const uploadsByKey = new Map();
    for (const image of imagesByPath.values()) for (const object of image.uploads) uploadsByKey.set(object.key, object);
    const uploadErrors = [];
    for (const object of uploadsByKey.values()) {
      try { await upload({ ...object, bucket }); }
      catch (error) { uploadErrors.push(`${object.filePath}: ${error.message}`); }
    }
    if (uploadErrors.length > 0) throw new Error(uploadErrors.join("\n"));

    let rewrittenFiles = 0;
    for (const article of articles) {
      if (article.references.length === 0) continue;
      const rewritten = rewriteSource(article.source, article.references, imagesByPath);
      if (rewritten === article.source) continue;
      await atomicWrite(article.filePath, rewritten);
      rewrittenFiles += 1;
    }

    const uploadedKeys = new Set(uploadsByKey.keys());
    const assets = {};
    for (const [fallbackUrl, asset] of Object.entries(previous.assets)) {
      const assetKeys = asset.kind === "responsive"
        ? Object.values(asset.sources ?? {}).flat().map((variant) => new URL(variant.url).pathname.slice(1))
        : [new URL(asset.fallback ?? fallbackUrl).pathname.slice(1)];
      if (
        referencedSourceUrls.has(fallbackUrl)
        || assetKeys.some((key) => (referencedKeys.has(key) || uploadedKeys.has(key)) && !key.endsWith(".avif"))
      ) {
        assets[fallbackUrl] = asset;
        for (const key of assetKeys) referencedKeys.add(key);
      }
    }
    for (const image of imagesByPath.values()) {
      for (const object of image.uploads) referencedKeys.add(object.key);
      if (image.manifestAsset) assets[image.fallbackUrl] = image.manifestAsset;
    }
    const activeKeys = [...new Set([...referencedKeys, ...uploadedKeys])].sort();
    const pendingDeletion = [...new Set([
      ...previous.pendingDeletion,
      ...previous.keys.filter((key) => !activeKeys.includes(key)),
    ])].filter((key) => !activeKeys.includes(key)).sort();
    await writeImageManifest(manifestPath, {
      version: MANIFEST_VERSION,
      assets,
      keys: activeKeys,
      pendingDeletion,
    });
    return {
      scannedFiles: articles.length,
      uploaded: uploadsByKey.size,
      rewrittenFiles,
      pendingDeletion: pendingDeletion.length,
    };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
};

export const cleanupBlogImages = async ({
  root = process.cwd(),
  bucket = DEFAULT_BUCKET,
  deleteObject,
  verifyDeleted,
} = {}) => {
  if (typeof deleteObject !== "function") throw new Error("cleanupBlogImages requires a deleteObject function");
  if (typeof verifyDeleted !== "function") throw new Error("cleanupBlogImages requires a verifyDeleted function");
  const manifestPath = path.join(root, MANIFEST_FILE);
  const manifest = await readImageManifest(manifestPath);
  const deleted = [];
  for (const key of manifest.pendingDeletion) {
    await deleteObject({ bucket, key });
    await verifyDeleted({ bucket, key });
    deleted.push(key);
  }
  await writeImageManifest(manifestPath, { ...manifest, pendingDeletion: [] });
  return { deleted: deleted.length };
};

export const migrateBlogImages = async ({
  root = process.cwd(),
  bucket = DEFAULT_BUCKET,
  publicUrl = DEFAULT_PUBLIC_URL,
  upload,
  download,
} = {}) => {
  if (typeof upload !== "function") throw new Error("migrateBlogImages requires an upload function");
  if (typeof download !== "function") throw new Error("migrateBlogImages requires a download function");
  const manifestPath = path.join(root, MANIFEST_FILE);
  const previous = await readImageManifest(manifestPath);
  const urls = new Map();
  for (const group of CONTENT_GROUPS) {
    for (const filePath of await walkContentFiles(path.join(root, "src/content", group))) {
      const source = await readFile(filePath, "utf8");
      for (const reference of collectRemoteRasterReferences(source, publicUrl).values()) {
        if (!previous.assets[reference.url]) urls.set(reference.url, reference.key);
      }
      for (const reference of collectRemotePassthroughReferences(source, publicUrl).values()) {
        if (!previous.assets[reference.url]) urls.set(reference.url, reference.key);
      }
    }
  }
  if (urls.size === 0) {
    return { migrated: 0, uploaded: 0, rewrittenFiles: 0, pendingDeletion: previous.pendingDeletion.length };
  }

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "blog-images-migrate-"));
  try {
    const migratedByUrl = new Map();
    for (const [url, key] of urls) {
      const sourceDirectory = path.join(temporaryRoot, "sources");
      await mkdir(sourceDirectory, { recursive: true });
      const filePath = path.join(sourceDirectory, path.basename(key));
      await download({ url, key, filePath, bucket });
      migratedByUrl.set(url, await createManagedImage({
        filePath,
        publicUrl,
        temporaryRoot,
        objectBaseKey: responsiveBaseKey(key),
      }));
    }

    const uploadsByKey = new Map();
    for (const image of migratedByUrl.values()) for (const object of image.uploads) uploadsByKey.set(object.key, object);
    for (const object of uploadsByKey.values()) await upload({ ...object, bucket });

    const activeKeys = [...new Set([...previous.keys, ...uploadsByKey.keys()])].sort();
    const assets = { ...previous.assets };
    for (const [sourceUrl, image] of migratedByUrl) assets[sourceUrl] = image.manifestAsset;
    const pendingDeletion = [...new Set(previous.pendingDeletion)].filter((key) => !activeKeys.includes(key)).sort();
    await writeImageManifest(manifestPath, { version: MANIFEST_VERSION, assets, keys: activeKeys, pendingDeletion });
    return { migrated: migratedByUrl.size, uploaded: uploadsByKey.size, rewrittenFiles: 0, pendingDeletion: pendingDeletion.length };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
};

const walkContentFiles = async (directory) => {
  const files = [];
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error?.code === "ENOENT") return files; throw error; }
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkContentFiles(fullPath));
    else if (/\.(md|mdx)$/.test(entry.name)) files.push(fullPath);
  }
  return files.sort();
};
