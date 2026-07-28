// @ts-check
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import { satteri } from "@astrojs/markdown-satteri";
import sitemap from "@astrojs/sitemap";
import { markdownOptions, markdownPlugins } from "./src/lib/markdown.mjs";
import { createResponsiveImagePlugin } from "./src/lib/responsive-images.mjs";

const buildId = process.env.PUBLIC_BUILD_ID ?? `local-${Date.now()}`;
const imageManifestSource = await readFile(new URL("./.blog-images-manifest.json", import.meta.url), "utf8");
const imageManifest = JSON.parse(imageManifestSource);
const imageManifestVersion = createHash("sha256").update(imageManifestSource).digest("hex").slice(0, 12);
const hastPlugins = /** @type {any} */ ([
  ...markdownPlugins.hastPlugins,
  createResponsiveImagePlugin({ manifest: imageManifest, version: imageManifestVersion }),
]);

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
  compressHTML: true,
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
    processor: satteri({
      features: markdownOptions.features,
      mdastPlugins: markdownPlugins.mdastPlugins,
      hastPlugins,
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
