import katex from "katex";
import { fromHtml } from "hast-util-from-html";

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

export const markdownPlugins = {
  mdastPlugins: [createDirectivePlugin, createMathPlugin],
  hastPlugins: [createKatexPlugin],
};

/** @type {import("@astrojs/markdown-satteri").SatteriMarkdownProcessorOptions} */
export const markdownOptions = {
  syntaxHighlight: { type: "shiki", excludeLangs: ["math", "mermaid"] },
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
