import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  createResponsiveImage,
  responsiveWidths,
} from "../scripts/lib/image-optimization.mjs";
import { createResponsiveImagePlugin } from "../src/lib/responsive-images.mjs";

test("responsive widths never upscale and retain the source width", () => {
  assert.deepEqual(responsiveWidths(512), [512]);
  assert.deepEqual(responsiveWidths(900), [640, 900]);
  assert.deepEqual(responsiveWidths(2500), [640, 1280, 1920, 2500]);
  assert.deepEqual(responsiveWidths(2500, [160, 320], false), [160, 320]);
});

test("responsive image encoding writes AVIF and WebP variants that pass the quality floor", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "image-optimization-"));
  const sourcePath = path.join(root, "source.png");
  await sharp({
    create: { width: 900, height: 600, channels: 3, background: { r: 36, g: 142, b: 196 } },
  }).png().toFile(sourcePath);

  const asset = await createResponsiveImage({ sourcePath, outputDirectory: root });

  assert.equal(asset.width, 900);
  assert.equal(asset.height, 600);
  assert.deepEqual(asset.widths, [640, 900]);
  assert.equal(asset.variants.length, 4);
  assert.ok(asset.variants.every((variant) => variant.ssim >= 0.975));
  assert.ok(asset.variants.some((variant) => variant.format === "avif"));
  assert.ok(asset.variants.some((variant) => variant.format === "webp"));
  for (const variant of asset.variants) assert.ok((await stat(variant.filePath)).size > 0);
});

test("responsive image plugin renders AVIF then WebP with a WebP fallback", () => {
  const tree = {
    type: "root",
    children: [{
      type: "element",
      tagName: "img",
      properties: { src: "https://img.muelsyse.us/blog/source.webp", alt: "Diagram", title: "Caption" },
      children: [],
    }],
  };
  const manifest = {
    version: 2,
    assets: {
      "https://img.muelsyse.us/blog/source.webp": {
        width: 1280,
        height: 720,
        fallback: "https://img.muelsyse.us/blog/source-w1280.webp",
        sources: {
          avif: [
            { width: 640, url: "https://img.muelsyse.us/blog/source-w640.avif" },
            { width: 1280, url: "https://img.muelsyse.us/blog/source-w1280.avif" },
          ],
          webp: [
            { width: 640, url: "https://img.muelsyse.us/blog/source-w640.webp" },
            { width: 1280, url: "https://img.muelsyse.us/blog/source-w1280.webp" },
          ],
        },
      },
    },
  };

  createResponsiveImagePlugin({ manifest })(tree);

  const picture = tree.children[0];
  assert.equal(picture.tagName, "picture");
  assert.equal(picture.children[0].properties.type, "image/avif");
  assert.equal(picture.children[1].properties.type, "image/webp");
  assert.equal(picture.children[2].properties.src, "https://img.muelsyse.us/blog/source-w1280.webp");
  assert.equal(picture.children[2].properties.loading, "lazy");
  assert.equal(picture.children[2].properties.decoding, "async");
  assert.equal(picture.children[2].properties.width, 1280);
  assert.equal(picture.children[2].properties.height, 720);
  assert.equal(picture.children[2].properties.alt, "Diagram");
  assert.equal(picture.children[2].properties.title, "Caption");
});

test("repository image manifest uses the responsive v2 shape", async () => {
  const manifest = JSON.parse(await readFile(new URL("../.blog-images-manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, 2);
  assert.ok(manifest.assets && typeof manifest.assets === "object");
  assert.ok(Array.isArray(manifest.pendingDeletion));
});
