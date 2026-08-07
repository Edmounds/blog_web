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

const getTextNodes = (tree) => {
  const nodes = [];
  visit(tree, "text", (node, _index, parent) => {
    const ancestors = parent ? [parent] : [];
    if (isTranslatableTextNode(node, ancestors)) nodes.push(node);
  });
  return nodes;
};

export const collectMarkdownSegments = (markdown) => {
  const tree = processor.parse(markdown);
  return getTextNodes(tree).map((node) => node.value);
};

export const replaceMarkdownSegments = (markdown, translations) => {
  const tree = processor.parse(markdown);
  const nodes = getTextNodes(tree);
  if (nodes.length !== translations.length) {
    throw new Error(`Markdown translation count mismatch: expected ${nodes.length}, received ${translations.length}.`);
  }
  const replacements = nodes.map((node, index) => ({
    start: node.position.start.offset,
    end: node.position.end.offset,
    value: translations[index],
  }));
  let output = markdown;
  for (const replacement of replacements.reverse()) {
    output = `${output.slice(0, replacement.start)}${replacement.value}${output.slice(replacement.end)}`;
  }
  return output;
};

export const translationFingerprint = (source, version = TRANSLATION_ALGORITHM_VERSION) =>
  createHash("sha256").update(`${version}\0${source}`).digest("hex");
