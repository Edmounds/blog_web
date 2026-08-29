import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { FALLBACK_SSIM, PRIMARY_SSIM } from "./lib/image-optimization.mjs";
import { readImageManifest } from "./lib/blog-images.mjs";
import { inspectWithWrangler } from "./lib/wrangler-r2.mjs";

const root = process.cwd();
const errors = [];
const requiredLocal = [
  "public/images/content/about/profile-f5f8abc7eda1-w160.avif",
  "public/images/content/about/profile-f5f8abc7eda1-w160.webp",
  "public/images/content/about/profile-f5f8abc7eda1-w320.avif",
  "public/images/content/about/profile-f5f8abc7eda1-w320.webp",
  "public/images/content/about/profile-f5f8abc7eda1-social.webp",
  "public/images/404-background-w1280.avif",
  "public/images/404-background-w1280.webp",
  "public/images/404-background-w1920.avif",
  "public/images/404-background-w1920.webp",
  "public/images/404-background-w3840.avif",
  "public/images/404-background-w3840.webp",
  "public/images/404-character-w768.avif",
  "public/images/404-character-w768.webp",
  "public/images/404-character-w802.avif",
  "public/images/404-character-w802.webp",
];

for (const relativePath of requiredLocal) {
  const filePath = path.join(root, relativePath);
  try {
    await access(filePath);
    const metadata = await sharp(filePath).metadata();
    if (!metadata.width || !metadata.height)
      errors.push(`${relativePath} has no dimensions`);
    if ((await stat(filePath)).size === 0)
      errors.push(`${relativePath} is empty`);
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
  }
}

const manifest = await readImageManifest(
  path.join(root, ".blog-images-manifest.json"),
);
const manifestKeys = new Set(manifest.keys);
for (const [fallback, asset] of Object.entries(manifest.assets)) {
  if (!/^https:\/\/img\.muelsyse\.us\/(?:bed|blog)\//.test(fallback)) {
    errors.push(`${fallback} is not a supported source URL`);
  }
  if (asset.kind === "passthrough") {
    if (!Number.isInteger(asset.width) || asset.width <= 0)
      errors.push(`${fallback} has invalid width`);
    if (!Number.isInteger(asset.height) || asset.height <= 0)
      errors.push(`${fallback} has invalid height`);
    const key = new URL(asset.fallback).pathname.slice(1);
    if (!manifestKeys.has(key))
      errors.push(`${asset.fallback} is not manifest-owned`);
    continue;
  }
  if (asset.kind !== "responsive")
    errors.push(`${fallback} has an invalid kind`);
  for (const format of ["avif", "webp"]) {
    const variants = asset.sources?.[format] ?? [];
    if (variants.length === 0)
      errors.push(`${fallback} has no ${format} variants`);
    for (const variant of variants) {
      const key = new URL(variant.url).pathname.slice(1);
      if (!manifestKeys.has(key))
        errors.push(`${variant.url} is not manifest-owned`);
      if (variant.ssim < FALLBACK_SSIM)
        errors.push(`${variant.url} has SSIM ${variant.ssim}`);
      if (variant.ssim < PRIMARY_SSIM)
        console.warn(`${variant.url} uses relaxed SSIM ${variant.ssim}`);
      if (!Number.isInteger(variant.width) || variant.width <= 0)
        errors.push(`${variant.url} has invalid width`);
      if (!Number.isInteger(variant.bytes) || variant.bytes <= 0)
        errors.push(`${variant.url} has invalid byte size`);
    }
  }
}

if (process.argv.includes("--remote")) {
  for (const key of manifest.keys) {
    try {
      await inspectWithWrangler({ bucket: "blog-images", key });
      const response = await fetch(`https://img.muelsyse.us/${key}`, {
        method: "HEAD",
        cache: "no-store",
      });
      if (!response.ok) errors.push(`${key} returned HTTP ${response.status}`);
      const extension = key.endsWith(".avif.webp")
        ? "avif"
        : path.extname(key).slice(1).replace("jpg", "jpeg");
      if (
        !new RegExp(`image/${extension}`, "i").test(
          response.headers.get("content-type") ?? "",
        )
      ) {
        errors.push(`${key} has an unexpected remote MIME type`);
      }
      if (!/immutable/i.test(response.headers.get("cache-control") ?? ""))
        errors.push(`${key} is not immutable`);
    } catch (error) {
      errors.push(error.message);
    }
  }
}

const contentFiles = [
  "src/content/about/profile.md",
  "src/i18n/content/en/about/profile.md",
  "src/i18n/content/ja/about/profile.md",
  "src/i18n/content/zh-TW/about/profile.md",
];
for (const relativePath of contentFiles) {
  const source = await readFile(path.join(root, relativePath), "utf8");
  if (!source.includes("profile-f5f8abc7eda1-w320.webp"))
    errors.push(`${relativePath} still uses the unoptimized portrait`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Image verification passed: ${requiredLocal.length} local files, ${Object.keys(manifest.assets).length} managed R2 assets.`,
  );
}
