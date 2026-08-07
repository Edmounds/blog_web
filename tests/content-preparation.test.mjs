import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { prepareContent } from "../scripts/prepare-content.mjs";

test("content preparation keeps UTF-8 without BOM, assigns a date slug, and regenerates published content IDs", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-content-"));

  try {
    for (const group of ["blog", "note", "project"]) {
      await mkdir(path.join(root, "src/content", group), { recursive: true });
    }
    await mkdir(path.join(root, "src/lib"), { recursive: true });
    await writeFile(path.join(root, "src/content/blog/新文章.md"), "---\ntitle: 新文章\ncreatedAt: 2026-08-03\npublished: true\n---\n\n正文\n", "utf8");
    await writeFile(path.join(root, "src/content/note/draft.md"), "---\ntitle: Draft\ncreatedAt: 2026-08-03\npublished: false\n---\n", "utf8");
    await writeFile(path.join(root, "src/lib/post-slugs.ts"), "export const CONTENT_IDS = [] as const;\n", "utf8");

    const result = await prepareContent(root);
    const article = await readFile(path.join(root, "src/content/blog/新文章.md"));
    const astroContentIds = await readFile(path.join(root, "src/lib/post-slugs.ts"), "utf8");

    assert.deepEqual([...article.subarray(0, 3)], [0x2d, 0x2d, 0x2d]);
    assert.match(article.toString("utf8"), /slug: 20260803-01/);
    assert.deepEqual(result.contentIds, ["blog/20260803-01"]);
    assert.equal(result.slugsAdded, 1);
    assert.match(astroContentIds, /"blog\/20260803-01"/);
    assert.match(astroContentIds, /as const/);
    assert.doesNotMatch(astroContentIds, /draft/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("content preparation keeps assigned and custom slugs stable", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-content-"));

  try {
    for (const group of ["blog", "note", "project"]) {
      await mkdir(path.join(root, "src/content", group), { recursive: true });
    }
    await mkdir(path.join(root, "src/lib"), { recursive: true });
    await writeFile(path.join(root, "src/content/blog/a.md"), "---\ntitle: A\ncreatedAt: 2026-08-03\npublished: true\n---\n", "utf8");
    await writeFile(path.join(root, "src/content/blog/b.md"), "---\ntitle: B\ncreatedAt: 2026-08-03\npublished: true\n---\n", "utf8");
    await writeFile(path.join(root, "src/content/blog/custom.md"), "---\ntitle: Custom\ncreatedAt: 2026-08-03\nslug: chosen-address\npublished: true\n---\n", "utf8");

    const first = await prepareContent(root);
    assert.deepEqual(first.contentIds, ["blog/20260803-01", "blog/20260803-02", "blog/chosen-address"]);

    await rename(path.join(root, "src/content/blog/a.md"), path.join(root, "src/content/blog/改名.md"));
    const second = await prepareContent(root);
    assert.deepEqual(second.contentIds, first.contentIds);
    assert.equal(second.slugsAdded, 0);
    assert.match(await readFile(path.join(root, "src/content/blog/改名.md"), "utf8"), /slug: 20260803-01/);
    assert.match(await readFile(path.join(root, "src/content/blog/custom.md"), "utf8"), /slug: chosen-address/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("content preparation rejects invalid and duplicate published slugs", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-content-"));

  try {
    for (const group of ["blog", "note", "project"]) {
      await mkdir(path.join(root, "src/content", group), { recursive: true });
    }
    await writeFile(path.join(root, "src/content/blog/a.md"), "---\ntitle: A\ncreatedAt: 2026-08-03\nslug: duplicate\npublished: true\n---\n", "utf8");
    await writeFile(path.join(root, "src/content/blog/b.md"), "---\ntitle: B\ncreatedAt: 2026-08-04\nslug: duplicate\npublished: true\n---\n", "utf8");

    await assert.rejects(prepareContent(root), /Duplicate blog slug "duplicate"/);

    await rm(path.join(root, "src/content/blog/b.md"));
    await writeFile(path.join(root, "src/content/blog/b.md"), "---\ntitle: B\ncreatedAt: 2026-08-04\nslug: Invalid Slug\npublished: true\n---\n", "utf8");
    await assert.rejects(prepareContent(root), /slug must use lowercase kebab-case/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("content preparation requires a valid creation date before generating a slug", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-content-"));

  try {
    for (const group of ["blog", "note", "project"]) {
      await mkdir(path.join(root, "src/content", group), { recursive: true });
    }
    await writeFile(path.join(root, "src/content/blog/missing-date.md"), "---\ntitle: Missing date\npublished: true\n---\n", "utf8");

    await assert.rejects(prepareContent(root), /requires a valid createdAt/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("content ID validation reads the generated TypeScript list on Node 22", async () => {
  const script = await readFile(
    new URL("../scripts/check-content-ids.mjs", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(script, /from "\.\.\/src\/lib\/post-slugs\.ts"/);
  assert.match(script, /readFile\(file, "utf8"\)/);
  assert.match(script, /JSON\.parse\(match\[1\]\.replace/);
});
