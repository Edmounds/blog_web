import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { fromHtml } from "hast-util-from-html";

const MERMAID_BLOCK = /<pre\b[^>]*>\s*<code\b[^>]*class="[^"]*\blanguage-mermaid\b[^"]*"[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/g;
const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);
const textContent = (node) => node.type === "text"
  ? node.value
  : (node.children ?? []).map(textContent).join("");
const escapeAttribute = (value) => value.replace(/[&"<>]/g, (character) => ({
  "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;",
})[character]);

const resolveExecutablePath = async () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  for (const candidate of [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ]) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  return undefined;
};

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory() && entry.name !== "_astro") yield* htmlFiles(url);
    else if (entry.isFile() && entry.name.endsWith(".html")) yield url;
  }
}

// This hook runs after prerendering. No browser dependency enters the Worker.
export async function prerenderMermaid(dir) {
  const diagrams = new Map();
  let browser;
  let page;
  let pages = 0;
  try {
    for await (const file of htmlFiles(dir)) {
      const html = await readFile(file, "utf8");
      const blocks = [...html.matchAll(MERMAID_BLOCK)];
      if (blocks.length === 0) continue;
      if (!browser) {
        const { default: puppeteer } = await import("puppeteer");
        const executablePath = await resolveExecutablePath();
        browser = await puppeteer.launch({
          executablePath,
          args: ["--no-sandbox"],
        });
        page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          void (request.url().startsWith("data:") ? request.continue() : request.abort());
        });
        await page.setContent("<!doctype html><html><body></body></html>");
        await page.addScriptTag({
          path: new URL("../../node_modules/mermaid/dist/mermaid.min.js", import.meta.url).pathname,
        });
        await mkdir(new URL("_astro/", dir), { recursive: true });
      }

      let output = "";
      let cursor = 0;
      for (const block of blocks) {
        const source = textContent(fromHtml(block[0], { fragment: true })).trim();
        if (!diagrams.has(source)) {
          const images = [];
          for (const theme of ["default", "dark"]) {
            const id = `mermaid-${hash(source)}-${theme}`;
            const rendered = await page.evaluate(async ({ source, theme, id }) => {
              window.mermaid.initialize({
                startOnLoad: false,
                securityLevel: "strict",
                deterministicIds: true,
                deterministicIDSeed: id,
                theme,
              });
              const { svg } = await window.mermaid.render(id, source);
              const container = document.createElement("div");
              container.innerHTML = svg;
              const element = container.querySelector("svg");
              const { width, height } = element.viewBox.baseVal;
              if (!(width > 0 && height > 0)) throw new Error("Mermaid SVG has no dimensions");
              return { svg, width: Math.ceil(width), height: Math.ceil(height) };
            }, { source, theme, id });
            const name = `mermaid.${hash(rendered.svg)}.svg`;
            await writeFile(new URL(`_astro/${name}`, dir), rendered.svg, "utf8");
            const variant = theme === "default" ? "light" : "dark";
            images.push(`<div class="markdown-mermaid__diagram" data-mermaid-theme="${variant}"><img src="/_astro/${name}" alt="${escapeAttribute(source)}" width="${rendered.width}" height="${rendered.height}" loading="lazy" decoding="async"></div>`);
          }
          diagrams.set(source, images.join(""));
        }
        output += html.slice(cursor, block.index)
          + `<figure class="markdown-mermaid" data-rendered="true" data-prerendered="true">${diagrams.get(source)}<div class="markdown-mermaid__source">${block[0]}</div></figure>`;
        cursor = block.index + block[0].length;
      }
      await writeFile(file, output + html.slice(cursor), "utf8");
      pages += 1;
    }
  } finally {
    await browser?.close();
  }
  return { pages, diagrams: diagrams.size };
}
