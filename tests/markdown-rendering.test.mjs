import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { createSatteriMarkdownProcessor } from "@astrojs/markdown-satteri";
import { mdxToJs } from "satteri";

import { markdownOptions } from "../src/lib/markdown.mjs";

const fixtureUrl = new URL("./fixtures/markdown-showcase.md", import.meta.url);
const writingFileUrl = new URL("../src/content/note/caption-test.md", import.meta.url);
const aboutFileUrl = new URL("../src/content/about/caption-test.md", import.meta.url);
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

test("blank Markdown lines create separate article paragraphs", async () => {
  const result = await processor.render("第一段。\n\n第二段。", { fileURL: writingFileUrl });

  assert.equal(result.code.trimEnd(), "<p>第一段。</p>\n<p>第二段。</p>");
});

test("writing content drops the leading level-1 heading that duplicates the title", async () => {
  const result = await processor.render("# 文章标题\n\n正文第一段。", { fileURL: writingFileUrl });

  assert.doesNotMatch(result.code, /<h1/);
  assert.match(result.code, /<p>正文第一段。<\/p>/);
  assert.equal(result.metadata.headings.some(({ depth }) => depth === 1), false);
});

test("a level-1 heading below other writing content is preserved", async () => {
  const result = await processor.render("引言段落。\n\n# 正文标题", { fileURL: writingFileUrl });

  assert.match(result.code, /<h1[^>]*>正文标题<\/h1>/);
});

test("non-writing content keeps its leading level-1 heading", async () => {
  const result = await processor.render("# About\n\n正文。", { fileURL: aboutFileUrl });

  assert.match(result.code, /<h1[^>]*>About<\/h1>/);
});

test("standalone writing images use non-empty alt text as a visible caption", async () => {
  const result = await processor.render(
    "![看过的东野圭吾作品](https://img.muelsyse.us/bed/books.png)",
    { fileURL: writingFileUrl },
  );

  assert.match(result.code, /<figure class="article-figure"><img[^>]*alt="看过的东野圭吾作品"[^>]*><figcaption>看过的东野圭吾作品<\/figcaption><\/figure>/);
});

test("writing images after a soft break become caption figures", async () => {
  const result = await processor.render(
    "其他书就不一一赘述了，下面图中是我看过的东野圭吾的作品\n![看过的东野圭吾作品](https://img.muelsyse.us/bed/books.png)",
    { fileURL: writingFileUrl },
  );

  assert.match(result.code, /^<p>其他书就不一一赘述了，下面图中是我看过的东野圭吾的作品<\/p>\s*<figure class="article-figure">/);
  assert.match(result.code, /<figcaption>看过的东野圭吾作品<\/figcaption><\/figure>\s*$/);
});

test("empty, placeholder, inline, and non-writing images do not create captions", async () => {
  const empty = await processor.render("![](https://example.com/empty.png)", { fileURL: writingFileUrl });
  const placeholder = await processor.render("![Image](https://example.com/placeholder.png)", { fileURL: writingFileUrl });
  const inline = await processor.render("正文中的 ![内联图片](https://example.com/inline.png) 不单独成图。", { fileURL: writingFileUrl });
  const about = await processor.render("![关于页图片](https://example.com/about.png)", { fileURL: aboutFileUrl });

  for (const result of [empty, placeholder, inline, about]) assert.doesNotMatch(result.code, /<figcaption>/);
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
