import assert from "node:assert/strict";
import test from "node:test";

import { collectMarkdownSegments, replaceMarkdownSegments, translationFingerprint } from "../scripts/lib/translate-content.mjs";

test("Markdown translation leaves code, URLs, and image paths untouched", () => {
  const source = `# 标题\n\n正文包含 [链接](https://example.com) 和 \`inlineCode()\`。\n\n\`\`\`js\nconsole.log("不要翻译");\n\`\`\`\n\n![封面](/images/cover.png)\n\n![image](/images/placeholder.png)\n`;
  const segments = collectMarkdownSegments(source);

  assert.deepEqual(segments, ["标题", "正文包含 ", "链接", " 和 ", "。", "封面"]);

  const translated = replaceMarkdownSegments(source, segments.map((segment) => `T:${segment}`));
  assert.match(translated, /https:\/\/example\.com/);
  assert.match(translated, /`inlineCode\(\)`/);
  assert.match(translated, /console\.log\("不要翻译"\)/);
  assert.match(translated, /\/images\/cover\.png/);
  assert.match(translated, /# T:标题/);
  assert.match(translated, /!\[T:封面\]\(\/images\/cover\.png\)/);
  assert.match(translated, /!\[image\]\(\/images\/placeholder\.png\)/);
});

test("fingerprints change when the source or algorithm changes", () => {
  assert.notEqual(translationFingerprint("甲", "v1"), translationFingerprint("乙", "v1"));
  assert.notEqual(translationFingerprint("甲", "v1"), translationFingerprint("甲", "v2"));
});
