// @ts-check
import { createHash } from "node:crypto";
import { appendFile, readdir, readFile, writeFile } from "node:fs/promises";

import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import { satteri } from "@astrojs/markdown-satteri";
import sitemap from "@astrojs/sitemap";
import { createMarkdownPlugins, markdownOptions } from "./src/lib/markdown.mjs";
import { createResponsiveImagePlugin } from "./src/lib/responsive-images.mjs";

const buildId = process.env.PUBLIC_BUILD_ID ?? `local-${Date.now()}`;
const imageManifestSource = await readFile(new URL("./.blog-images-manifest.json", import.meta.url), "utf8");
const imageManifest = JSON.parse(imageManifestSource);
const imageManifestVersion = createHash("sha256").update(imageManifestSource).digest("hex").slice(0, 12);
const imageLayoutsSettings = await readFile(
  new URL("./src/content/.obsidian/plugins/obsidian-image-layouts/data.json", import.meta.url),
  "utf8",
).then(JSON.parse).catch((error) => {
  if (error?.code === "ENOENT") return {};
  throw error;
});
const markdownPlugins = createMarkdownPlugins({
  vaultAssets: imageManifest.vaultAssets ?? {},
  settings: imageLayoutsSettings,
});
const hastPlugins = /** @type {any} */ ([
  ...markdownPlugins.hastPlugins,
  createResponsiveImagePlugin({ manifest: imageManifest, version: imageManifestVersion }),
]);

// Routes serving prerendered HTML. Early-hint Link headers let browsers fetch
// the render-blocking stylesheet and body font before HTML parsing starts,
// which saves a round trip on high-latency (e.g. mainland China) connections.
const HTML_ROUTES = ["/", "/about/*", "/links/*", "/blog/*", "/note/*", "/en/*", "/ja/*", "/zh-TW/*"];

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
      const hashedAssets = await readdir(new URL("_astro/", dir));
      const layoutCss = hashedAssets.find(
        (file) => file.startsWith("BaseLayout.") && file.endsWith(".css"),
      );
      if (!layoutCss) throw new Error("BaseLayout stylesheet missing from _astro output");
      const links = [
        `  Link: </_astro/${layoutCss}>; rel=preload; as=style`,
        "  Link: </fonts/Biotif-Regular.woff2>; rel=preload; as=font; type=font/woff2; crossorigin",
      ];
      const rules = HTML_ROUTES.map((route) => [route, ...links].join("\n")).join("\n\n");
      await appendFile(new URL("_headers", dir), `\n${rules}\n`, "utf8");
    },
  },
};

// https://astro.build/config
export default defineConfig({
  compressHTML: true,
  site: "https://blog.muelsyse.us",
  output: 'server',
  // ClientRouter enables hover prefetch by default; viewport strategy also
  // covers touch devices, where most mainland China traffic comes from.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
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
