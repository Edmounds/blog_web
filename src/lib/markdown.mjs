import rehypeKatex from "rehype-katex";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";

export const markdownPlugins = {
  remarkPlugins: [remarkMath, remarkDirective],
  rehypePlugins: [rehypeKatex],
};

/** @type {import("@astrojs/markdown-remark").AstroMarkdownOptions} */
export const markdownOptions = {
  syntaxHighlight: { type: "shiki", excludeLangs: ["math", "mermaid"] },
  shikiConfig: {
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  },
  ...markdownPlugins,
};
