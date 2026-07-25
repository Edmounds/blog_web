import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { ssim } from "ssim.js";

export const RESPONSIVE_WIDTHS = [640, 1280, 1920];
export const PRIMARY_SSIM = 0.985;
export const FALLBACK_SSIM = 0.975;

const QUALITY_RANGES = {
  avif: [40, 100],
  webp: [70, 100],
};

export const responsiveWidths = (sourceWidth, requested = RESPONSIVE_WIDTHS, retainSourceWidth = true) => [
  ...new Set([
    ...requested.filter((width) => width <= sourceWidth),
    ...(retainSourceWidth ? [sourceWidth] : []),
  ]),
].sort((a, b) => a - b);

const pixelsFor = async (input, background) => {
  let pipeline = sharp(input).rotate().toColourspace("srgb");
  if (background) pipeline = pipeline.flatten({ background });
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
  };
};

const scorePair = async (reference, candidate, hasAlpha) => {
  const backgrounds = hasAlpha ? ["#ffffff", "#000000"] : [undefined];
  const scores = [];
  for (const background of backgrounds) {
    const [referencePixels, candidatePixels] = await Promise.all([
      pixelsFor(reference, background),
      pixelsFor(candidate, background),
    ]);
    scores.push(ssim(referencePixels, candidatePixels, { downsample: "original" }).mssim);
  }
  return Math.min(...scores);
};

const encode = async ({ input, output, format, quality }) => {
  let pipeline = sharp(input).rotate().toColourspace("srgb");
  pipeline = format === "avif"
    ? pipeline.avif({ quality, effort: 6, chromaSubsampling: "4:4:4" })
    : pipeline.webp({ quality, effort: 6, smartSubsample: true, alphaQuality: 100 });
  await pipeline.toFile(output);
};

const findCandidate = async ({ reference, directory, stem, width, format, hasAlpha }) => {
  const candidates = new Map();
  const evaluate = async (quality) => {
    if (candidates.has(quality)) return candidates.get(quality);
    const temporary = path.join(directory, `.${stem}-w${width}-q${quality}.${format}`);
    await encode({ input: reference, output: temporary, format, quality });
    const score = await scorePair(reference, temporary, hasAlpha);
    const candidate = { temporary, quality, ssim: score, size: (await stat(temporary)).size };
    candidates.set(quality, candidate);
    return candidate;
  };

  const findMinimumQuality = async (threshold) => {
    let [low, high] = QUALITY_RANGES[format];
    if ((await evaluate(high)).ssim < threshold) return undefined;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if ((await evaluate(middle)).ssim >= threshold) high = middle;
      else low = middle + 1;
    }
    return evaluate(low);
  };

  let selected = await findMinimumQuality(PRIMARY_SSIM);
  if (!selected) selected = await findMinimumQuality(FALLBACK_SSIM);
  if (!selected) {
    await Promise.all([...candidates.values()].map((candidate) => rm(candidate.temporary, { force: true })));
    throw new Error(`${stem} ${width}px ${format} did not reach SSIM ${FALLBACK_SSIM}`);
  }

  const output = path.join(directory, `${stem}-w${width}.${format}`);
  await rm(output, { force: true });
  await rename(selected.temporary, output);
  await Promise.all([...candidates.values()].map((candidate) => rm(candidate.temporary, { force: true })));
  return { format, width, quality: selected.quality, ssim: selected.ssim, size: selected.size, filePath: output };
};

export const createResponsiveImage = async ({
  sourcePath,
  outputDirectory,
  widths,
  stem: requestedStem,
  retainSourceWidth = true,
}) => {
  const metadata = await sharp(sourcePath).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Unable to read dimensions for ${sourcePath}`);
  const sourceBytes = await readFile(sourcePath);
  const digest = createHash("sha256").update(sourceBytes).digest("hex");
  const stem = requestedStem ?? digest;
  const targetWidths = responsiveWidths(metadata.width, widths, retainSourceWidth);
  await mkdir(outputDirectory, { recursive: true });
  const variants = [];
  try {
    for (const width of targetWidths) {
      const height = Math.round(metadata.height * width / metadata.width);
      const reference = await sharp(sourcePath)
        .rotate()
        .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
        .toColourspace("srgb")
        .png({ compressionLevel: 1 })
        .toBuffer();
      for (const format of ["avif", "webp"]) {
        variants.push(await findCandidate({
          reference,
          directory: outputDirectory,
          stem,
          width,
          format,
          hasAlpha: Boolean(metadata.hasAlpha),
        }));
      }
    }
  } catch (error) {
    await Promise.all(variants.map((variant) => rm(variant.filePath, { force: true })));
    throw error;
  }
  return {
    digest,
    width: metadata.width,
    height: metadata.height,
    widths: targetWidths,
    variants,
  };
};
