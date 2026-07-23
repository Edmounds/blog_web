import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { syncBlogImages } from "../scripts/lib/blog-images.mjs";

const bom = "\uFEFF";

const createFixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-images-"));
  const contentDir = path.join(root, "src/content/blog");
  const imageDir = path.join(root, "Typora Images");
  await mkdir(contentDir, { recursive: true });
  await mkdir(imageDir, { recursive: true });
  return { root, contentDir, imageDir };
};

test("uploads Typora absolute images and rewrites body and cover URLs", async () => {
  const { root, contentDir, imageDir } = await createFixture();
  const coverPath = path.join(imageDir, "cover image.png");
  const bodyPath = path.join(imageDir, "body image.jpg");
  await writeFile(coverPath, Buffer.from("cover bytes"));
  await writeFile(bodyPath, Buffer.from("body bytes"));

  const postPath = path.join(contentDir, "post.md");
  const source = `${bom}---\ntitle: Test\ncover: ${coverPath}\n---\n\nBefore\n\n![Alt text](<${bodyPath}> \"Caption\")\n\n![Same](file://${encodeURI(bodyPath)})\n\nAfter\n`;
  await writeFile(postPath, source);

  const uploads = [];
  const result = await syncBlogImages({
    root,
    upload: async (image) => uploads.push(image),
  });

  const rewritten = await readFile(postPath, "utf8");
  assert.equal(result.uploaded, 2);
  assert.equal(result.rewrittenFiles, 1);
  assert.equal(uploads.length, 2);
  assert.ok(uploads.every((image) => image.bucket === "blog-images"));
  assert.ok(uploads.every((image) => image.key.startsWith("blog/")));
  assert.ok(rewritten.startsWith(bom));
  assert.match(rewritten, /^\uFEFF---\ntitle: Test\ncover: https:\/\/img\.muelsyse\.us\/blog\/[a-f0-9]{64}\.png\n---/);
  assert.match(rewritten, /!\[Alt text\]\(<https:\/\/img\.muelsyse\.us\/blog\/[a-f0-9]{64}\.jpg> "Caption"\)/);
  assert.match(rewritten, /!\[Same\]\(https:\/\/img\.muelsyse\.us\/blog\/[a-f0-9]{64}\.jpg\)/);
  assert.equal(uploads.filter((image) => image.filePath === bodyPath).length, 1);
  assert.deepEqual(
    uploads.map(({ contentType, cacheControl }) => ({ contentType, cacheControl })).sort((a, b) => a.contentType.localeCompare(b.contentType)),
    [
      { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" },
      { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" },
    ],
  );
});

test("supports Typora paths with parentheses and escaped spaces", async () => {
  const { root, contentDir, imageDir } = await createFixture();
  const nestedDir = path.join(imageDir, "export (final)");
  await mkdir(nestedDir, { recursive: true });
  const imagePath = path.join(nestedDir, "screen shot.png");
  await writeFile(imagePath, Buffer.from("screenshot"));
  const escapedPath = imagePath.replaceAll(" ", "\\ ");
  const postPath = path.join(contentDir, "post.md");
  await writeFile(postPath, `${bom}---\ncover: /images/default.png\n---\n\n![Screenshot](${escapedPath})\n`);

  const result = await syncBlogImages({ root, upload: async () => {} });
  const rewritten = await readFile(postPath, "utf8");

  assert.equal(result.uploaded, 1);
  assert.match(rewritten, /!\[Screenshot\]\(https:\/\/img\.muelsyse\.us\/blog\/[a-f0-9]{64}\.png\)/);
});

test("ignores remote, site-root, and relative image references", async () => {
  const { root, contentDir } = await createFixture();
  const postPath = path.join(contentDir, "post.md");
  const source = `${bom}---\ncover: /images/local.png\n---\n\n![Remote](https://example.com/a.png)\n![Site](/images/a.png)\n![Relative](./a.png)\n`;
  await writeFile(postPath, source);

  const result = await syncBlogImages({
    root,
    upload: async () => assert.fail("no upload expected"),
  });

  assert.deepEqual(result, { scannedFiles: 1, uploaded: 0, rewrittenFiles: 0 });
  assert.equal(await readFile(postPath, "utf8"), source);
});

test("does not modify any article when validation fails", async () => {
  const { root, contentDir, imageDir } = await createFixture();
  const validPath = path.join(imageDir, "valid.png");
  const missingPath = path.join(imageDir, "missing.png");
  await writeFile(validPath, Buffer.from("valid"));

  const firstPath = path.join(contentDir, "first.md");
  const secondPath = path.join(contentDir, "second.md");
  const firstSource = `${bom}---\ncover: /images/default.png\n---\n\n![Valid](<${validPath}>)\n`;
  const secondSource = `${bom}---\ncover: /images/default.png\n---\n\n![Missing](<${missingPath}>)\n`;
  await writeFile(firstPath, firstSource);
  await writeFile(secondPath, secondSource);

  await assert.rejects(
    syncBlogImages({ root, upload: async () => assert.fail("validation must finish before upload") }),
    /missing\.png.*does not exist/s,
  );
  assert.equal(await readFile(firstPath, "utf8"), firstSource);
  assert.equal(await readFile(secondPath, "utf8"), secondSource);
});

test("does not rewrite articles when an upload fails", async () => {
  const { root, contentDir, imageDir } = await createFixture();
  const imagePath = path.join(imageDir, "image.png");
  await writeFile(imagePath, Buffer.from("image"));
  const postPath = path.join(contentDir, "post.md");
  const source = `${bom}---\ncover: /images/default.png\n---\n\n![Image](<${imagePath}>)\n`;
  await writeFile(postPath, source);

  await assert.rejects(
    syncBlogImages({ root, upload: async () => { throw new Error("R2 unavailable"); } }),
    /R2 unavailable/,
  );
  assert.equal(await readFile(postPath, "utf8"), source);
});

test("is a no-op after local paths have already been rewritten", async () => {
  const { root, contentDir } = await createFixture();
  const postPath = path.join(contentDir, "post.md");
  const source = `${bom}---\ncover: https://img.muelsyse.us/blog/${"a".repeat(64)}.png\n---\n\n![Image](https://img.muelsyse.us/blog/${"a".repeat(64)}.png)\n`;
  await writeFile(postPath, source);

  const result = await syncBlogImages({
    root,
    upload: async () => assert.fail("no upload expected"),
  });

  assert.deepEqual(result, { scannedFiles: 1, uploaded: 0, rewrittenFiles: 0 });
  assert.equal(await readFile(postPath, "utf8"), source);
});

test("deduplicates different local paths with identical image bytes", async () => {
  const { root, contentDir, imageDir } = await createFixture();
  const firstImage = path.join(imageDir, "first.png");
  const secondImage = path.join(imageDir, "second.png");
  await writeFile(firstImage, Buffer.from("identical"));
  await writeFile(secondImage, Buffer.from("identical"));
  const postPath = path.join(contentDir, "post.md");
  await writeFile(postPath, `${bom}---\ncover: /images/default.png\n---\n\n![One](<${firstImage}>)\n![Two](<${secondImage}>)\n`);

  const uploads = [];
  const result = await syncBlogImages({ root, upload: async (image) => uploads.push(image) });
  const rewritten = await readFile(postPath, "utf8");
  const urls = [...rewritten.matchAll(/https:\/\/img\.muelsyse\.us\/blog\/[a-f0-9]{64}\.png/g)].map((match) => match[0]);

  assert.equal(result.uploaded, 1);
  assert.equal(uploads.length, 1);
  assert.equal(urls.length, 2);
  assert.equal(urls[0], urls[1]);
});

test("rejects unsupported local image types before upload", async () => {
  const { root, contentDir, imageDir } = await createFixture();
  const imagePath = path.join(imageDir, "image.bmp");
  await writeFile(imagePath, Buffer.from("bitmap"));
  await writeFile(path.join(contentDir, "post.md"), `${bom}---\ncover: /images/default.png\n---\n\n![Image](<${imagePath}>)\n`);

  await assert.rejects(
    syncBlogImages({ root, upload: async () => assert.fail("no upload expected") }),
    /unsupported image type/,
  );
});
