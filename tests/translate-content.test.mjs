import assert from "node:assert/strict";
import test from "node:test";

import {
  collectMarkdownSegments,
  replaceMarkdownSegments,
  translationFingerprint,
} from "../scripts/lib/translate-content.mjs";

test("Markdown translation leaves code, URLs, and image paths untouched", () => {
  const source = `# 标题\n\n正文包含 [链接](https://example.com) 和 \`inlineCode()\`。\n\n\`\`\`js\nconsole.log("不要翻译");\n\`\`\`\n\n![封面](/images/cover.png)\n\n![image](/images/placeholder.png)\n`;
  const segments = collectMarkdownSegments(source);

  assert.deepEqual(segments, [
    "标题",
    "正文包含 ",
    "链接",
    " 和 ",
    "。",
    "封面",
  ]);

  const translated = replaceMarkdownSegments(
    source,
    segments.map((segment) => `T:${segment}`),
  );
  assert.match(translated, /https:\/\/example\.com/);
  assert.match(translated, /`inlineCode\(\)`/);
  assert.match(translated, /console\.log\("不要翻译"\)/);
  assert.match(translated, /\/images\/cover\.png/);
  assert.match(translated, /# T:标题/);
  assert.match(translated, /!\[T:封面\]\(\/images\/cover\.png\)/);
  assert.match(translated, /!\[image\]\(\/images\/placeholder\.png\)/);
});

test("fingerprints change when the source or algorithm changes", () => {
  assert.notEqual(
    translationFingerprint("甲", "v1"),
    translationFingerprint("乙", "v1"),
  );
  assert.notEqual(
    translationFingerprint("甲", "v1"),
    translationFingerprint("甲", "v2"),
  );
});

test("Invariant updates (image URL, code change) preserve translatable segments and passthrough invariants", () => {
  const originalSource = `# 标题\n\n正文段落。\n\n![头像](/images/avatar-old.png)\n\n\`\`\`js\nconst a = 1;\n\`\`\`\n`;
  const originalSegments = collectMarkdownSegments(originalSource);

  const updatedSource = `# 标题\n\n正文段落。\n\n![头像](/images/avatar-new.webp)\n\n\`\`\`js\nconst a = 2; // modified code\n\`\`\`\n`;
  const updatedSegments = collectMarkdownSegments(updatedSource);

  // Translatable segments are unchanged
  assert.deepEqual(originalSegments, updatedSegments);
  assert.deepEqual(updatedSegments, ["标题", "正文段落。", "头像"]);

  // Re-assembling updated source with existing translations updates the image URL and code block with 0 translation changes
  const cachedTranslations = ["Title", "Body paragraph.", "Avatar"];
  const assembled = replaceMarkdownSegments(updatedSource, cachedTranslations);

  assert.match(assembled, /# Title/);
  assert.match(assembled, /Body paragraph\./);
  assert.match(assembled, /!\[Avatar\]\(\/images\/avatar-new\.webp\)/);
  assert.match(assembled, /const a = 2; \/\/ modified code/);
});

test("Incremental segment translation replaces modified segment while reusing cached segments", () => {
  const sourceV1 = `# 文章标题\n\n第一段内容。\n\n第二段内容。`;
  const segmentsV1 = collectMarkdownSegments(sourceV1);
  assert.deepEqual(segmentsV1, ["文章标题", "第一段内容。", "第二段内容。"]);

  const cachedTranslations = [
    "Article Title",
    "First paragraph content.",
    "Second paragraph content.",
  ];

  // User edits only the second paragraph
  const sourceV2 = `# 文章标题\n\n第一段内容。\n\n第二段内容（修改版）。`;
  const segmentsV2 = collectMarkdownSegments(sourceV2);
  assert.deepEqual(segmentsV2, ["文章标题", "第一段内容。", "第二段内容（修改版）。"]);

  // Match segments: segment 0 and 1 hit cache, segment 2 is new
  const translationsV2 = [
    cachedTranslations[0],
    cachedTranslations[1],
    "Second paragraph content (updated).", // newly translated segment
  ];

  const assembledV2 = replaceMarkdownSegments(sourceV2, translationsV2);
  assert.equal(
    assembledV2,
    `# Article Title\n\nFirst paragraph content.\n\nSecond paragraph content (updated).`,
  );
});
