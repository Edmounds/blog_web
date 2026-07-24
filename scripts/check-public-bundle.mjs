import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../dist/client/", import.meta.url);
const publicPages = ["index.html", "about/index.html", "blog/index.html", "note/index.html", "project/index.html", "blog/first-note/index.html"];
const forbidden = [/PostEngagement/i, /CommentsSection/i, /ArchiveViewMotionController/i, /ArchiveInteractionController/i, /motion\/react/i];

for (const page of publicPages) {
  const html = await readFile(new URL(page, root), "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(html)) throw new Error(`${page} contains forbidden public client code: ${pattern}`);
  }
}

const astroDir = new URL("_astro/", root);
for (const file of await readdir(astroDir)) {
  if (!file.endsWith(".js")) continue;
  const source = await readFile(join(astroDir.pathname, file), "utf8");
  if (forbidden.some((pattern) => pattern.test(source)) && publicPages.some((page) => source.includes(page))) {
    throw new Error(`${file} couples a public page to forbidden client code.`);
  }
}

console.log(`Public bundle check passed (${publicPages.length} pages).`);
