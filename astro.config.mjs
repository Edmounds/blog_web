// @ts-check
import { writeFile } from "node:fs/promises";

import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import { markdownOptions, markdownPlugins } from "./src/lib/markdown.mjs";

const buildId = process.env.PUBLIC_BUILD_ID ?? `local-${Date.now()}`;

const deploymentVersion = {
  name: "deployment-version",
  hooks: {
    /** @param {{ dir: URL }} options */
    "astro:build:done": async ({ dir }) => {
      await writeFile(
        new URL("version.json", dir),
        `${JSON.stringify({ buildId })}\n`,
        "utf8",
      );
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: "https://blog.muelsyse.us",
  output: 'server',
  adapter: cloudflare({
    imageService: "compile",
    configPath: "./wrangler.astro.jsonc",
  }),
  integrations: [deploymentVersion, react(), mdx(), sitemap()],
  markdown: {
    syntaxHighlight: markdownOptions.syntaxHighlight,
    shikiConfig: markdownOptions.shikiConfig,
    processor: unified({
      remarkPlugins: markdownPlugins.remarkPlugins,
      rehypePlugins: markdownPlugins.rehypePlugins,
    }),
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["mermaid"],
    },
    define: {
      "import.meta.env.PUBLIC_BUILD_ID": JSON.stringify(buildId),
    },
  },
});
