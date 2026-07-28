import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { cleanupBlogImages, readImageManifest, syncBlogImages } from "../scripts/lib/blog-images.mjs";

const bom = "\uFEFF";

const createFixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-images-"));
  const contentDir = path.join(root, "src/content/blog");
  const imageDir = path.join(root, "Typora Images");
  await mkdir(contentDir, { recursive: true });
  await mkdir(imageDir, { recursive: true });
  return { root, contentDir, imageDir };
};

const writeRaster = (filePath, format = path.extname(filePath).slice(1)) => sharp({
  create: { width: 96, height: 64, channels: 4, background: { r: 37, g: 142, b: 211, alpha: 0.85 } },
}).composite([{ input: Buffer.from('<svg width="96" height="64"><circle cx="48" cy="32" r="22" fill="#f6b73c"/></svg>') }])
  .toFormat(format === "jpg" ? "jpeg" : format)
  .toFile(filePath);

const writeManifest = (root, manifest) => writeFile(
  path.join(root, ".blog-images-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const readManifest = async (root) => JSON.parse(await readFile(path.join(root, ".blog-images-manifest.json"), "utf8"));

test("uploads AVIF/WebP variants and rewrites Typora paths to the largest WebP", async () => {
  const { root, contentDir, imageDir } = await createFixture();
  const imagePath = path.join(imageDir, "body image.jpg");
  await writeRaster(imagePath, "jpg");
  const postPath = path.join(contentDir, "post.md");
  await writeFile(postPath, `${bom}---\ntitle: Test\n---\n\n![Alt](<${imagePath}> "Caption")\n![Same](file://${encodeURI(imagePath)})\n`);

  const uploads = [];
  const result = await syncBlogImages({ root, upload: async (image) => uploads.push(image) });
  const rewritten = await readFile(postPath, "utf8");
  const manifest = await readManifest(root);

  assert.equal(result.uploaded, 2);
  assert.equal(result.rewrittenFiles, 1);
  assert.equal(uploads.length, 2);
  assert.deepEqual(new Set(uploads.map((image) => image.contentType)), new Set(["image/avif", "image/webp"]));
  assert.ok(uploads.every((image) => image.cacheControl === "public, max-age=31536000, immutable"));
  assert.match(rewritten, /https:\/\/img\.muelsyse\.us\/blog\/[a-f0-9]{64}-w96\.webp/);
  assert.ok(rewritten.startsWith(bom));
  const asset = Object.values(manifest.assets)[0];
  assert.equal(asset.kind, "responsive");
  assert.equal(asset.width, 96);
  assert.equal(asset.height, 64);
  assert.equal(asset.sources.avif.length, 1);
  assert.equal(asset.sources.webp.length, 1);
  assert.equal(asset.fallback, asset.sources.webp[0].url);
});

test("supports Typora paths with parentheses and escaped spaces", async () => {
  const { root, contentDir, imageDir } = await createFixture();
  const nestedDir = path.join(imageDir, "export (final)");
  await mkdir(nestedDir, { recursive: true });
  const imagePath = path.join(nestedDir, "screen shot.png");
  await writeRaster(imagePath);
  const escapedPath = imagePath.replaceAll(" ", "\\ ");
  const postPath = path.join(contentDir, "post.md");
  await writeFile(postPath, `${bom}---\ncover: /images/default.png\n---\n\n![Screenshot](${escapedPath})\n`);

  await syncBlogImages({ root, upload: async () => {} });
  assert.match(await readFile(postPath, "utf8"), /-w96\.webp/);
});

test("ignores remote, site-root, and relative image references", async () => {
  const { root, contentDir } = await createFixture();
  const postPath = path.join(contentDir, "post.md");
  const source = `${bom}---\ncover: /images/local.png\n---\n\n![Remote](https://example.com/a.png)\n![Site](/images/a.png)\n![Relative](./a.png)\n`;
  await writeFile(postPath, source);

  const result = await syncBlogImages({ root, upload: async () => assert.fail("no upload expected") });
  assert.deepEqual(result, { scannedFiles: 1, uploaded: 0, rewrittenFiles: 0, pendingDeletion: 0 });
  assert.equal(await readFile(postPath, "utf8"), source);
});

test("does not modify articles or the manifest when validation fails", async () => {
  const { root, contentDir, imageDir } = await createFixture();
  const validPath = path.join(imageDir, "valid.png");
  const missingPath = path.join(imageDir, "missing.png");
  await writeRaster(validPath);
  const firstPath = path.join(contentDir, "first.md");
  const secondPath = path.join(contentDir, "second.md");
  const firstSource = `${bom}---\n---\n\n![Valid](<${validPath}>)\n`;
  const secondSource = `${bom}---\n---\n\n![Missing](<${missingPath}>)\n`;
  await writeFile(firstPath, firstSource);
  await writeFile(secondPath, secondSource);

  await assert.rejects(syncBlogImages({ root, upload: async () => assert.fail("no upload expected") }), /missing\.png.*does not exist/s);
  assert.equal(await readFile(firstPath, "utf8"), firstSource);
  assert.equal(await readFile(secondPath, "utf8"), secondSource);
  await assert.rejects(readFile(path.join(root, ".blog-images-manifest.json")), /ENOENT/);
});

test("does not rewrite articles or the manifest when an upload fails", async () => {
  const { root, contentDir, imageDir } = await createFixture();
  const imagePath = path.join(imageDir, "image.png");
  await writeRaster(imagePath);
  const postPath = path.join(contentDir, "post.md");
  const source = `${bom}---\n---\n\n![Image](<${imagePath}>)\n`;
  await writeFile(postPath, source);

  await assert.rejects(syncBlogImages({ root, upload: async () => { throw new Error("R2 unavailable"); } }), /R2 unavailable/);
  assert.equal(await readFile(postPath, "utf8"), source);
  await assert.rejects(readFile(path.join(root, ".blog-images-manifest.json")), /ENOENT/);
});

test("deduplicates identical source bytes across different local paths", async () => {
  const { root, contentDir, imageDir } = await createFixture();
  const firstImage = path.join(imageDir, "first.png");
  const secondImage = path.join(imageDir, "second.png");
  await writeRaster(firstImage);
  await writeFile(secondImage, await readFile(firstImage));
  const postPath = path.join(contentDir, "post.md");
  await writeFile(postPath, `${bom}---\n---\n\n![One](<${firstImage}>)\n![Two](<${secondImage}>)\n`);

  const uploads = [];
  const result = await syncBlogImages({ root, upload: async (image) => uploads.push(image) });
  const urls = [...(await readFile(postPath, "utf8")).matchAll(/https:\/\/img\.muelsyse\.us\/blog\/[a-f0-9]{64}-w96\.webp/g)].map((match) => match[0]);
  assert.equal(result.uploaded, 2);
  assert.equal(uploads.length, 2);
  assert.equal(urls.length, 2);
  assert.equal(urls[0], urls[1]);
});

test("migrates a v1 manifest and defers stale object deletion", async () => {
  const { root, contentDir } = await createFixture();
  const keptKey = `blog/${"a".repeat(64)}.png`;
  const staleKey = `blog/${"b".repeat(64)}.jpg`;
  await writeManifest(root, { version: 1, keys: [keptKey, staleKey] });
  await writeFile(path.join(contentDir, "post.md"), `${bom}---\ncover: https://img.muelsyse.us/${keptKey}\n---\n`);

  const result = await syncBlogImages({ root, upload: async () => assert.fail("no upload expected") });
  assert.equal(result.pendingDeletion, 1);
  assert.deepEqual(await readManifest(root), { version: 3, assets: {}, keys: [keptKey], pendingDeletion: [staleKey] });
});

test("cleanup deletes only pending manifest-owned keys", async () => {
  const { root } = await createFixture();
  const activeKey = `blog/${"a".repeat(64)}.webp`;
  const staleKey = `blog/${"b".repeat(64)}.png`;
  await writeManifest(root, { version: 3, assets: {}, keys: [activeKey], pendingDeletion: [staleKey] });
  const deleted = [];
  const verified = [];

  const result = await cleanupBlogImages({
    root,
    deleteObject: async (object) => deleted.push(object),
    verifyDeleted: async (object) => verified.push(object),
  });
  assert.equal(result.deleted, 1);
  assert.deepEqual(deleted, [{ bucket: "blog-images", key: staleKey }]);
  assert.deepEqual(verified, deleted);
  assert.deepEqual(await readManifest(root), { version: 3, assets: {}, keys: [activeKey], pendingDeletion: [] });
});

test("reads v2 responsive manifests into the v3 discriminated shape", async () => {
  const { root } = await createFixture();
  const sourceUrl = "https://img.muelsyse.us/blog/source.webp";
  await writeManifest(root, {
    version: 2,
    assets: {
      [sourceUrl]: {
        width: 96,
        height: 64,
        fallback: sourceUrl,
        sources: { avif: [], webp: [] },
      },
    },
    keys: [],
    pendingDeletion: [],
  });

  const manifest = await readImageManifest(path.join(root, ".blog-images-manifest.json"));
  assert.equal(manifest.version, 3);
  assert.equal(manifest.assets[sourceUrl].kind, "responsive");
  const result = await syncBlogImages({ root, upload: async () => {} });
  assert.equal(result.scannedFiles, 0);
  assert.equal((await readManifest(root)).version, 3);
});

test("sync keeps responsive variants for still-referenced Obsidian URLs", async () => {
  const { root, contentDir } = await createFixture();
  const sourceUrl = "https://img.muelsyse.us/bed/source.png";
  const avifKey = "bed/source-w96.avif.webp";
  const webpKey = "bed/source-w96.webp";
  await writeFile(path.join(contentDir, "post.md"), `${bom}---\n---\n\n![Remote](${sourceUrl})\n`);
  await writeManifest(root, {
    version: 3,
    assets: {
      [sourceUrl]: {
        kind: "responsive",
        width: 96,
        height: 64,
        fallback: `https://img.muelsyse.us/${webpKey}`,
        sources: {
          avif: [{ width: 96, url: `https://img.muelsyse.us/${avifKey}` }],
          webp: [{ width: 96, url: `https://img.muelsyse.us/${webpKey}` }],
        },
      },
    },
    keys: [avifKey, webpKey],
    pendingDeletion: [],
  });

  const result = await syncBlogImages({ root, upload: async () => assert.fail("no upload expected") });
  const manifest = await readManifest(root);

  assert.equal(result.pendingDeletion, 0);
  assert.deepEqual(manifest.keys, [avifKey, webpKey]);
  assert.ok(manifest.assets[sourceUrl]);
});

test("SVG and animated GIF images pass through unchanged", async () => {
  const { root, contentDir, imageDir } = await createFixture();
  const svgPath = path.join(imageDir, "diagram.svg");
  const gifPath = path.join(imageDir, "motion.gif");
  await writeFile(svgPath, '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10"/></svg>');
  await sharp({ create: { width: 8, height: 16, channels: 4, background: "red", pageHeight: 8, pages: 2 } })
    .gif({ pageHeight: 8, loop: 0, delay: [100, 100] })
    .toFile(gifPath);
  const postPath = path.join(contentDir, "post.md");
  await writeFile(postPath, `${bom}---\n---\n\n![SVG](<${svgPath}>)\n![GIF](<${gifPath}>)\n`);
  const uploads = [];

  const result = await syncBlogImages({ root, upload: async (image) => uploads.push(image) });
  const rewritten = await readFile(postPath, "utf8");
  assert.equal(result.uploaded, 2);
  assert.deepEqual(new Set(uploads.map((image) => image.contentType)), new Set(["image/svg+xml", "image/gif"]));
  assert.match(rewritten, /[a-f0-9]{64}\.svg/);
  assert.match(rewritten, /[a-f0-9]{64}\.gif/);
  const assets = Object.values((await readManifest(root)).assets);
  assert.equal(assets.length, 2);
  assert.ok(assets.every((asset) => asset.kind === "passthrough"));
  assert.deepEqual(assets.map(({ width, height }) => [width, height]).sort((a, b) => a[0] - b[0]), [[8, 8], [20, 10]]);
});

test("rejects unsupported local image types before upload", async () => {
  const { root, contentDir, imageDir } = await createFixture();
  const imagePath = path.join(imageDir, "image.bmp");
  await writeFile(imagePath, Buffer.from("bitmap"));
  await writeFile(path.join(contentDir, "post.md"), `${bom}---\n---\n\n![Image](<${imagePath}>)\n`);
  await assert.rejects(syncBlogImages({ root, upload: async () => assert.fail("no upload expected") }), /unsupported image type/);
});
