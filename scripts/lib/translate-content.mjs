import { createHash } from "node:crypto";

import { unified } from "unified";
import { visit } from "unist-util-visit";
import remarkParse from "remark-parse";

export const TRANSLATION_ALGORITHM_VERSION = "2026-08-08.1";

const processor = unified().use(remarkParse);

const isTranslatableTextNode = (node, ancestors) => {
  if (node.type !== "text" || !node.value.trim()) return false;
  return !ancestors.some((ancestor) => ancestor.type === "code" || ancestor.type === "inlineCode" || ancestor.type === "html");
};

const findImageAltRange = (markdown, node) => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (!Number.isInteger(start) || !Number.isInteger(end) || markdown.slice(start, start + 2) !== "![") return;
  let depth = 0;
  for (let index = start + 2; index < end; index += 1) {
    const character = markdown[index];
    if (character === "\\") {
      index += 1;
    } else if (character === "[") {
      depth += 1;
    } else if (character === "]") {
      if (depth === 0) return { start: start + 2, end: index };
      depth -= 1;
    }
  }
};

const getTranslatableRanges = (markdown, tree) => {
  const ranges = [];
  visit(tree, (node, _index, parent) => {
    if (node.type === "text") {
      const ancestors = parent ? [parent] : [];
      if (isTranslatableTextNode(node, ancestors)) {
        ranges.push({
          start: node.position.start.offset,
          end: node.position.end.offset,
          value: node.value,
          escape: false,
        });
      }
      return;
    }
    if (node.type !== "image" || !node.alt?.trim() || node.alt.trim().toLowerCase() === "image") return;
    const range = findImageAltRange(markdown, node);
    if (range) ranges.push({ ...range, value: node.alt, escape: true });
  });
  return ranges.sort((left, right) => left.start - right.start);
};

const escapeImageAlt = (value) => value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");

export const collectMarkdownSegments = (markdown) => {
  const tree = processor.parse(markdown);
  return getTranslatableRanges(markdown, tree).map((range) => range.value);
};

export const replaceMarkdownSegments = (markdown, translations) => {
  const tree = processor.parse(markdown);
  const ranges = getTranslatableRanges(markdown, tree);
  if (ranges.length !== translations.length) {
    throw new Error(`Markdown translation count mismatch: expected ${ranges.length}, received ${translations.length}.`);
  }
  const replacements = ranges.map((range, index) => ({
    ...range,
    value: range.escape ? escapeImageAlt(translations[index]) : translations[index],
  }));
  let output = markdown;
  for (const replacement of replacements.reverse()) {
    output = `${output.slice(0, replacement.start)}${replacement.value}${output.slice(replacement.end)}`;
  }
  return output;
};

export const translationFingerprint = (source, version = TRANSLATION_ALGORITHM_VERSION) =>
  createHash("sha256").update(`${version}\0${source}`).digest("hex");
