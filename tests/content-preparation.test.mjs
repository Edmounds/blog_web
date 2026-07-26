import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { prepareContent } from "../scripts/prepare-content.mjs";

test("content preparation adds BOM and regenerates published content IDs", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-content-"));

  try {
    for (const group of ["blog", "note", "project"]) {
      await mkdir(path.join(root, "src/content", group), { recursive: true });
    }
    await mkdir(path.join(root, "functions/_shared"), { recursive: true });
    await writeFile(path.join(root, "src/content/blog/new-post.md"), "---\ntitle: 新文章\npublished: true\n---\n\n正文\n", "utf8");
    await writeFile(path.join(root, "src/content/note/draft.md"), "---\ntitle: Draft\npublished: false\n---\n", "utf8");
    await writeFile(path.join(root, "functions/_shared/post-slugs.js"), "export const CONTENT_IDS = [];\n", "utf8");

    const result = await prepareContent(root);
    const article = await readFile(path.join(root, "src/content/blog/new-post.md"));
    const contentIds = await readFile(path.join(root, "functions/_shared/post-slugs.js"), "utf8");

    assert.deepEqual([...article.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.deepEqual(result.contentIds, ["blog/new-post"]);
    assert.equal(result.bomAdded, 1);
    assert.match(contentIds, /"blog\/new-post"/);
    assert.doesNotMatch(contentIds, /draft/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("content preparation rejects published filenames that cannot be engagement IDs", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-content-"));

  try {
    for (const group of ["blog", "note", "project"]) {
      await mkdir(path.join(root, "src/content", group), { recursive: true });
    }
    await mkdir(path.join(root, "functions/_shared"), { recursive: true });
    await writeFile(path.join(root, "src/content/blog/新文章.md"), "---\ntitle: 新文章\npublished: true\n---\n", "utf8");

    await assert.rejects(prepareContent(root), /filename must use lowercase kebab-case/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
