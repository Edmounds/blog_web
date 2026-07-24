import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { createMarkdownProcessor } from "@astrojs/markdown-remark";

import { markdownOptions } from "../src/lib/markdown.mjs";

const fixtureUrl = new URL("./fixtures/markdown-showcase.md", import.meta.url);
const fixture = readFileSync(fixtureUrl, "utf8");
const processor = await createMarkdownProcessor(markdownOptions);
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

test("remark-math and rehype-katex render inline and display formulas", () => {
  assert.match(html, /class="katex"/);
  assert.match(html, /class="katex-display"/);
  assert.doesNotMatch(html, />\$E = mc\^2\$</);
});

test("every KaTeX woff2 font referenced by the public stylesheet exists", () => {
  const stylesheet = readFileSync(new URL("../public/katex.min.css", import.meta.url), "utf8");
  const fontPaths = [...stylesheet.matchAll(/url\((fonts\/[^)]+\.woff2)\)/g)].map((match) => match[1]);

  assert.ok(fontPaths.length > 0);
  for (const fontPath of new Set(fontPaths)) {
    assert.equal(existsSync(new URL(`../public/${fontPath}`, import.meta.url)), true, `${fontPath} should exist`);
  }
});
