import katex from "katex";
import { fromHtml } from "hast-util-from-html";
import {
  createImageLayoutsPlugin,
  createObsidianImageSizePlugin,
  IMAGE_LAYOUT_LANGUAGES,
} from "./image-layouts.mjs";

const hasClass = (node, className) => (
  Array.isArray(node.properties?.className) && node.properties.className.includes(className)
);

const renderMath = (value, displayMode) => (
  fromHtml(katex.renderToString(value, {
    displayMode,
    strict: "ignore",
    throwOnError: false,
  }), { fragment: true }).children[0]
);

const createSoftBreakPlugin = () => ({
  name: "preserve-soft-breaks",
  text(node, ctx) {
    if (!node.value.includes("\n")) return;

    const replacement = node.value.split("\n").flatMap((value, index) => [
      ...(index > 0 ? [{ type: "break" }] : []),
      ...(value ? [{ type: "text", value }] : []),
    ]);
    ctx.insertBefore(node, replacement);
    ctx.removeNode(node);
  },
});

const createDirectivePlugin = () => ({
  name: "render-directives",
  containerDirective(node, ctx) {
    ctx.setProperty(node, "data", {
      hName: "div",
      hProperties: node.attributes ?? {},
    });
  },
  leafDirective(node, ctx) {
    ctx.setProperty(node, "data", {
      hName: "div",
      hProperties: node.attributes ?? {},
    });
  },
  textDirective(node, ctx) {
    ctx.setProperty(node, "data", {
      hName: "span",
      hProperties: node.attributes ?? {},
    });
  },
});

const createMathPlugin = () => ({
  name: "mark-math",
  math(node) {
    // Reuse fenced-code HAST so the display formula stays addressable before Shiki runs.
    return {
      type: "code",
      lang: "math",
      meta: null,
      value: node.value,
    };
  },
});

const createKatexPlugin = () => ({
  name: "render-katex",
  element: [
    {
      filter: ["code"],
      visit(node, ctx) {
        const parent = ctx.parent(node);
        if (parent?.type === "element" && parent.tagName === "pre") return;
        if (!hasClass(node, "math-inline")) return;
        return renderMath(ctx.textContent(node), false);
      },
    },
    {
      filter: ["pre"],
      visit(node, ctx) {
        const code = node.children?.find(
          (child) => child.type === "element" && child.tagName === "code",
        );
        if (!code || !hasClass(code, "language-math")) return;
        return renderMath(ctx.textContent(code), true);
      },
    },
  ],
});

const isWritingContent = (fileURL) => {
  const path = fileURL?.pathname;
  if (!path) return false;
  return /\/src\/content\/(?:blog|note|project)\//.test(path)
    || /\/src\/i18n\/content\/[^/]+\/(?:blog|note|project)\//.test(path);
};

const createCaptionFigure = (image, caption) => ({
  type: "element",
  tagName: "figure",
  properties: { className: ["article-figure"] },
  children: [
    image,
    {
      type: "element",
      tagName: "figcaption",
      properties: {},
      children: [{ type: "text", value: caption }],
    },
  ],
});

const createImageCaptionPlugin = () => ({
  name: "render-image-captions",
  element: {
    filter: ["p"],
    visit(node, ctx) {
      if (!isWritingContent(ctx.fileURL) || !node.children?.length) return;
      const image = node.children.at(-1);
      if (image.type !== "element" || image.tagName !== "img") return;
      const caption = typeof image.properties?.alt === "string" ? image.properties.alt.trim() : "";
      if (!caption || caption.toLowerCase() === "image") return;
      if (node.children.length === 1) return createCaptionFigure(image, caption);

      let breakIndex = node.children.length - 2;
      while (breakIndex >= 0 && node.children[breakIndex].type === "text" && !node.children[breakIndex].value.trim()) {
        breakIndex -= 1;
      }
      const lineBreak = node.children[breakIndex];
      if (lineBreak?.type !== "element" || lineBreak.tagName !== "br") return;

      const paragraphChildren = node.children.slice(0, breakIndex);
      if (paragraphChildren.length) {
        ctx.insertBefore(node, {
          type: "element",
          tagName: "p",
          properties: node.properties ?? {},
          children: paragraphChildren,
        });
      }
      return createCaptionFigure(image, caption);
    },
  },
});

export const markdownPlugins = {
  mdastPlugins: [createSoftBreakPlugin, createDirectivePlugin, createMathPlugin],
  hastPlugins: [
    createKatexPlugin,
    createImageLayoutsPlugin,
    createObsidianImageSizePlugin,
    createImageCaptionPlugin,
  ],
};

/** @type {import("@astrojs/markdown-satteri").SatteriMarkdownProcessorOptions} */
export const markdownOptions = {
  syntaxHighlight: {
    type: "shiki",
    excludeLangs: ["math", "mermaid", ...IMAGE_LAYOUT_LANGUAGES],
  },
  shikiConfig: {
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  },
  features: {
    directive: true,
    math: true,
  },
  ...markdownPlugins,
};
