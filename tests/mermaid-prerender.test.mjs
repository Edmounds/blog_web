import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import test from "node:test";

import { prerenderMermaid } from "../scripts/lib/prerender-mermaid.mjs";

test("static Mermaid diagrams have both themes, dimensions, source alternatives and reusable hashed assets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "blog-mermaid-"));
  const dir = pathToFileURL(`${directory}/`);
  const block = '<pre><code class="language-mermaid">flowchart LR\nA[Read &amp; write] --&gt; B[Done]\n</code></pre>';
  try {
    await writeFile(new URL("index.html", dir), `<main>${block}${block}</main>`);
    assert.deepEqual(await prerenderMermaid(dir), { pages: 1, diagrams: 1 });
    const html = await readFile(new URL("index.html", dir), "utf8");
    assert.equal([...html.matchAll(/data-prerendered="true"/g)].length, 2);
    assert.equal([...html.matchAll(/data-mermaid-theme="light"/g)].length, 2);
    assert.equal([...html.matchAll(/data-mermaid-theme="dark"/g)].length, 2);
    assert.match(html, /alt="flowchart LR\nA\[Read &amp; write\]/);
    assert.match(html, /width="[1-9]\d*" height="[1-9]\d*"/);
    assert.ok(html.includes(block), "Keep the diagram source as a fallback");
    const assets = await readdir(new URL("_astro/", dir));
    assert.equal(assets.length, 2);
    const svgs = await Promise.all(assets.map((name) => readFile(new URL(`_astro/${name}`, dir), "utf8")));
    for (const svg of svgs) {
      assert.match(svg, /<svg /);
      assert.match(svg, /Read &amp; write/);
      assert.doesNotMatch(svg, /<script\b/);
    }
    assert.notEqual(svgs[0], svgs[1]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("pages without diagrams need no browser or output assets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "blog-no-mermaid-"));
  const dir = pathToFileURL(`${directory}/`);
  try {
    await writeFile(new URL("index.html", dir), "<main>Plain article</main>");
    assert.deepEqual(await prerenderMermaid(dir), { pages: 0, diagrams: 0 });
    assert.deepEqual(await readdir(dir), ["index.html"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("an invalid diagram fails the build and preserves the source page", async () => {
  const directory = await mkdtemp(join(tmpdir(), "blog-invalid-mermaid-"));
  const dir = pathToFileURL(`${directory}/`);
  const html = '<pre><code class="language-mermaid">this is not a diagram</code></pre>';
  try {
    await writeFile(new URL("index.html", dir), html);
    await assert.rejects(prerenderMermaid(dir));
    assert.equal(await readFile(new URL("index.html", dir), "utf8"), html);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
