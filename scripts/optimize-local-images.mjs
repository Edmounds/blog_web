import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { createResponsiveImage } from "./lib/image-optimization.mjs";

const root = process.cwd();
const publicImages = path.join(root, "public/images");

const replaceVariants = async ({
  sourcePath,
  outputDirectory,
  widths,
  stem,
  retainSourceWidth = false,
}) => {
  const asset = await createResponsiveImage({
    sourcePath,
    outputDirectory,
    widths,
    stem,
    retainSourceWidth,
  });
  return asset.variants;
};

const optimizeProfile = async () => {
  const sourcePath = path.join(
    publicImages,
    "content/about/profile-f5f8abc7eda1.png",
  );
  const outputDirectory = path.dirname(sourcePath);
  const variants = await replaceVariants({
    sourcePath,
    outputDirectory,
    widths: [160, 320],
    stem: "profile-f5f8abc7eda1",
  });
  const socialPath = path.join(
    outputDirectory,
    "profile-f5f8abc7eda1-social.webp",
  );
  await sharp(sourcePath)
    .rotate()
    .resize(1200, 1200, { fit: "cover" })
    .toColourspace("srgb")
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile(socialPath);
  const avatarPath = path.join(root, "public/avatar.webp");
  const w320Variant = variants.find(
    (variant) => variant.width === 320 && variant.format === "webp",
  );
  if (w320Variant) {
    await sharp(w320Variant.filePath).toFile(avatarPath);
  }
  return [
    ...variants.map((variant) => variant.filePath),
    socialPath,
    avatarPath,
  ];
};

const optimize404Asset = async (name, widths) => {
  const sourcePath = path.join(publicImages, `${name}.png`);
  const variants = await replaceVariants({
    sourcePath,
    outputDirectory: publicImages,
    widths,
    stem: name,
    retainSourceWidth: true,
  });
  return variants.map((variant) => variant.filePath);
};

const generated = [
  ...(await optimizeProfile()),
  ...(await optimize404Asset("404-background", [1280, 1920, 3840])),
  ...(await optimize404Asset("404-character", [768, 802])),
];

await mkdir(publicImages, { recursive: true });
console.log(`Optimized ${generated.length} local AVIF/WebP image variants.`);
