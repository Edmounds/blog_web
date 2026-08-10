import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createSatteriMarkdownProcessor } from "@astrojs/markdown-satteri";
import sharp from "sharp";

import {
  createResponsiveImage,
  responsiveWidths,
} from "../scripts/lib/image-optimization.mjs";
import {
  ARTICLE_IMAGE_SIZES,
  createResponsiveImagePlugin,
} from "../src/lib/responsive-images.mjs";

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

test("responsive image plugin renders AVIF then WebP with a WebP fallback", async () => {
  const manifest = {
    version: 3,
    assets: {
      "https://img.muelsyse.us/blog/source.webp": {
        kind: "responsive",
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

  const processor = await createSatteriMarkdownProcessor({
    syntaxHighlight: false,
    hastPlugins: [createResponsiveImagePlugin({ manifest })],
  });
  const rendered = await processor.render(
    "![Diagram](https://img.muelsyse.us/blog/source.webp \"Caption\")",
  );

  assert.match(rendered.code, /<picture class="article-picture"><source type="image\/avif" srcset="https:\/\/img\.muelsyse\.us\/blog\/source-w640\.avif 640w, https:\/\/img\.muelsyse\.us\/blog\/source-w1280\.avif 1280w"/);
  assert.match(rendered.code, /<source type="image\/webp" srcset="https:\/\/img\.muelsyse\.us\/blog\/source-w640\.webp 640w, https:\/\/img\.muelsyse\.us\/blog\/source-w1280\.webp 1280w"/);
  assert.match(rendered.code, /<img src="https:\/\/img\.muelsyse\.us\/blog\/source-w1280\.webp" alt="Diagram" title="Caption" loading="eager" fetchpriority="high" decoding="async" width="1280" height="720">/);
  assert.match(rendered.code, new RegExp(`sizes="${ARTICLE_IMAGE_SIZES.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
});

test("unmanaged first images stay unchanged and receive high-priority native attributes", async () => {
  const processor = await createSatteriMarkdownProcessor({
    syntaxHighlight: false,
    hastPlugins: [createResponsiveImagePlugin({ manifest: { assets: {} } })],
  });
  const rendered = await processor.render(
    "![Screenshot](https://img.muelsyse.us/bed/20260728123332461.png)",
  );

  assert.doesNotMatch(rendered.code, /<picture>/);
  assert.match(
    rendered.code,
    /<img src="https:\/\/img\.muelsyse\.us\/bed\/20260728123332461\.png" alt="Screenshot" loading="eager" fetchpriority="high" decoding="async">/,
  );
});

test("repository image manifest uses the responsive v4 shape", async () => {
  const manifest = JSON.parse(await readFile(new URL("../.blog-images-manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, 4);
  assert.ok(manifest.assets && typeof manifest.assets === "object");
  assert.ok(manifest.vaultAssets && typeof manifest.vaultAssets === "object");
  assert.ok(Object.values(manifest.assets).every((asset) => ["responsive", "passthrough"].includes(asset.kind)));
  assert.ok(Array.isArray(manifest.pendingDeletion));
});
