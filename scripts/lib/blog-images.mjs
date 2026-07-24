import { createHash } from "node:crypto";
import { access, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BUCKET = "blog-images";
const DEFAULT_PUBLIC_URL = "https://img.muelsyse.us";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const MANIFEST_FILE = ".blog-images-manifest.json";
const MANIFEST_VERSION = 1;
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
    return {
      before: "<",
      path: destination.slice(1, close),
      after: destination.slice(close),
    };
  }

  return { before: "", path: destination, after: "" };
};

const findMarkdownImageClose = (source, start) => {
  let depth = 0;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
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
    return {
      pathDestination: destination.slice(0, close + 1),
      title: destination.slice(close + 1),
    };
  }

  const titleMatch = destination.match(/[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^\)\n]*\))[ \t]*$/);
  return titleMatch
    ? { pathDestination: destination.slice(0, titleMatch.index), title: titleMatch[0] }
    : { pathDestination: destination, title: "" };
};

const collectBodyReferences = (source, offset, references) => {
  const imageStartPattern = /!\[[^\]\n]*\]\(/g;
  for (const match of source.matchAll(imageStartPattern)) {
    const destinationStartInSource = match.index + match[0].length;
    const destinationEndInSource = findMarkdownImageClose(source, destinationStartInSource);
    if (destinationEndInSource === -1) continue;
    const destination = source.slice(destinationStartInSource, destinationEndInSource);
    const destinationParts = splitDestinationAndTitle(destination);
    if (!destinationParts) continue;
    const { pathDestination } = destinationParts;
    const split = splitMarkdownDestination(pathDestination);
    if (!split) continue;
    const localPath = toLocalPath(split.path);
    if (!isLocalAbsolutePath(localPath)) continue;

    const destinationStart = offset + destinationStartInSource;
    references.push({
      start: destinationStart,
      end: destinationStart + pathDestination.length,
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

const describeImage = async (filePath, publicUrl) => {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${filePath} does not exist`);
  }

  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) throw new Error(`${filePath} is not a file`);

  const extension = path.extname(filePath).toLowerCase();
  const contentType = contentTypes.get(extension);
  if (!contentType) throw new Error(`${filePath} uses an unsupported image type`);

  const digest = createHash("sha256").update(await readFile(filePath)).digest("hex");
  const key = `blog/${digest}${extension}`;
  return {
    filePath,
    key,
    url: `${publicUrl.replace(/\/$/, "")}/${key}`,
    contentType,
    cacheControl: CACHE_CONTROL,
  };
};

const rewriteSource = (source, references, imagesByPath) => {
  let output = source;
  for (const reference of [...references].sort((a, b) => b.start - a.start)) {
    const image = imagesByPath.get(reference.localPath);
    output = `${output.slice(0, reference.start)}${reference.render(image.url)}${output.slice(reference.end)}`;
  }
  return output;
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

const readManifest = async (manifestPath) => {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.version !== MANIFEST_VERSION || !Array.isArray(manifest.keys)) {
      throw new Error(`${manifestPath} has an unsupported format`);
    }
    return new Set(manifest.keys.filter((key) => typeof key === "string" && key.startsWith("blog/")));
  } catch (error) {
    if (error?.code === "ENOENT") return new Set();
    throw error;
  }
};

const collectManagedKeys = (source, publicUrl) => {
  const keys = new Set();
  const escapedBase = publicUrl.replace(/\/$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escapedBase}/(blog/[a-f0-9]{64}\\.(?:avif|gif|jpe?g|png|svg|webp))`, "gi");
  for (const match of source.matchAll(pattern)) keys.add(match[1]);
  return keys;
};

export const syncBlogImages = async ({
  root = process.cwd(),
  bucket = DEFAULT_BUCKET,
  publicUrl = DEFAULT_PUBLIC_URL,
  upload,
  deleteObject,
} = {}) => {
  if (typeof upload !== "function") throw new Error("syncBlogImages requires an upload function");

  const manifestPath = path.join(root, MANIFEST_FILE);
  const previousKeys = await readManifest(manifestPath);
  const articles = [];
  const localPaths = new Set();
  const referencedKeys = new Set();

  for (const group of CONTENT_GROUPS) {
    const contentDir = path.join(root, "src/content", group);
    const filePaths = await walkContentFiles(contentDir);
    for (const filePath of filePaths) {
    const source = await readFile(filePath, "utf8");
    const references = collectReferences(source);
    for (const reference of references) localPaths.add(reference.localPath);
    for (const key of collectManagedKeys(source, publicUrl)) referencedKeys.add(key);
    articles.push({ filePath, source, references });
    }
  }

  const imagesByPath = new Map();
  const validationErrors = [];
  for (const filePath of [...localPaths].sort()) {
    try {
      imagesByPath.set(filePath, await describeImage(filePath, publicUrl));
    } catch (error) {
      const articleNames = articles
        .filter((article) => article.references.some((reference) => reference.localPath === filePath))
        .map((article) => path.relative(root, article.filePath))
        .join(", ");
      validationErrors.push(`${articleNames}: ${error.message}`);
    }
  }
  if (validationErrors.length > 0) throw new Error(validationErrors.join("\n"));

  const imagesByKey = new Map();
  for (const image of imagesByPath.values()) imagesByKey.set(image.key, image);
  const uploadErrors = [];
  for (const image of imagesByKey.values()) {
    try {
      await upload({ ...image, bucket });
    } catch (error) {
      uploadErrors.push(`${image.filePath}: ${error.message}`);
    }
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

  for (const image of imagesByKey.values()) referencedKeys.add(image.key);

  const staleKeys = [...previousKeys].filter((key) => !referencedKeys.has(key)).sort();
  if (staleKeys.length > 0 && typeof deleteObject !== "function") {
    throw new Error("syncBlogImages requires a deleteObject function to remove stale images");
  }
  const deleteErrors = [];
  for (const key of staleKeys) {
    try {
      await deleteObject({ bucket, key });
    } catch (error) {
      deleteErrors.push(`${key}: ${error.message}`);
    }
  }
  if (deleteErrors.length > 0) throw new Error(deleteErrors.join("\n"));

  const manifestKeys = [...new Set([...previousKeys, ...referencedKeys])]
    .filter((key) => !staleKeys.includes(key))
    .sort();
  await atomicWrite(
    manifestPath,
    `${JSON.stringify({ version: MANIFEST_VERSION, keys: manifestKeys }, null, 2)}\n`,
  );

  return {
    scannedFiles: articles.length,
    uploaded: imagesByKey.size,
    rewrittenFiles,
    deleted: staleKeys.length,
  };
};

const walkContentFiles = async (directory) => {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return files;
    throw error;
  }
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkContentFiles(fullPath));
    else if (/\.(md|mdx)$/.test(entry.name)) files.push(fullPath);
  }
  return files.sort();
};
