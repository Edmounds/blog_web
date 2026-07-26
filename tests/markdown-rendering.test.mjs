import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { createSatteriMarkdownProcessor } from "@astrojs/markdown-satteri";
import { mdxToJs } from "satteri";

import { markdownOptions } from "../src/lib/markdown.mjs";

const fixtureUrl = new URL("./fixtures/markdown-showcase.md", import.meta.url);
const fixture = readFileSync(fixtureUrl, "utf8");
const processor = await createSatteriMarkdownProcessor(markdownOptions);
const rendered = await processor.render(fixture, { fileURL: fixtureUrl });
const html = rendered.code;

test("the Markdown fixture renders heading hierarchy and GFM structures", () => {
  for (const level of [1, 2, 3, 4]) {
    assert.match(html, new RegExp(`<h${level} id="[^"]+">`));
  }

  assert.match(html, /<table>/);
  assert.match(html, /class="contains-task-list"/);
  assert.match(html, /type="checkbox" checked disabled/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<a href="https:\/\/example\.com">link<\/a>/);
});

test("single Markdown line breaks remain visible in rendered prose", async () => {
  const result = await processor.render("第一行\n第二行\n第三行");

  assert.match(result.code, /<p>第一行<br>\s*第二行<br>\s*第三行<\/p>/);
});

test("Shiki highlights common fenced languages and leaves Mermaid as source", () => {
  for (const language of ["js", "python", "bash"]) {
    assert.match(html, new RegExp(`data-language="${language}"`));
  }

  assert.match(html, /class="language-mermaid"/);
  assert.match(html, /flowchart LR/);
  assert.doesNotMatch(html, /data-language="mermaid"/);
  assert.match(html, /--shiki-light:/);
  assert.match(html, /--shiki-dark:/);
});

test("Sätteri math renders inline and display formulas with KaTeX", () => {
  assert.match(html, /class="katex"/);
  assert.match(html, /class="katex-display"/);
  assert.doesNotMatch(html, />\$E = mc\^2\$</);
});

test("Sätteri directives preserve their content and attributes", () => {
  assert.match(html, /<div data-kind="info" id="directive-note" class="callout"><p>Directive <strong>content<\/strong> stays renderable\.<\/p><\/div>/);
  assert.match(html, /Before <span data-kind="info">New<\/span> after\./);
});

test("Sätteri preserves heading metadata for Astro table-of-contents consumers", () => {
  assert.deepEqual(rendered.metadata.headings.map(({ depth, slug }) => ({ depth, slug })), [
    { depth: 1, slug: "markdown-showcase" },
    { depth: 2, slug: "lists-and-quotes" },
    { depth: 3, slug: "table-and-image" },
    { depth: 4, slug: "code-examples" },
  ]);
});

test("the same Sätteri plugins compile Markdown features inside MDX", () => {
  const compiled = mdxToJs(`
# MDX Showcase

<aside>MDX component</aside>

Inline math uses $a^2 + b^2 = c^2$.

:::note
Directive content.
:::
`, {
    features: markdownOptions.features,
    mdastPlugins: markdownOptions.mdastPlugins,
    hastPlugins: markdownOptions.hastPlugins,
    jsxImportSource: "astro",
  });

  assert.match(compiled.code, /className: "katex"/);
  assert.match(compiled.code, /_components\.div/);
  assert.match(compiled.code, /MDX component/);
});

test("every KaTeX woff2 font referenced by the public stylesheet exists", () => {
  const stylesheet = readFileSync(new URL("../public/katex.min.css", import.meta.url), "utf8");
  const fontPaths = [...stylesheet.matchAll(/url\((fonts\/[^)]+\.woff2)\)/g)].map((match) => match[1]);

  assert.ok(fontPaths.length > 0);
  for (const fontPath of new Set(fontPaths)) {
    assert.equal(existsSync(new URL(`../public/${fontPath}`, import.meta.url)), true, `${fontPath} should exist`);
  }
});
