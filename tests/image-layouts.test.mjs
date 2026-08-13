import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { createSatteriMarkdownProcessor } from "@astrojs/markdown-satteri";

import { createMarkdownPlugins, markdownOptions } from "../src/lib/markdown.mjs";
import { IMAGE_LAYOUTS_COMPATIBILITY_VERSION } from "../src/lib/image-layouts.mjs";

const processor = await createSatteriMarkdownProcessor(markdownOptions);
const aboutFileUrl = new URL("../src/content/about/image-layout-test.md", import.meta.url);
const writingFileUrl = new URL("../src/content/note/image-size-test.md", import.meta.url);

const configuredProcessor = async (configuration) => {
  const plugins = createMarkdownPlugins(configuration);
  return createSatteriMarkdownProcessor({
    ...markdownOptions,
    mdastPlugins: plugins.mdastPlugins,
    hastPlugins: plugins.hastPlugins,
  });
};

test("Obsidian Image Layouts thumbnail carousels render as interactive image galleries", async () => {
  const result = await processor.render(`
\`\`\`image-layout
---
layout: carousel
carouselShowThumbnails: true
---
![jupiter](https://img.muelsyse.us/bed/jupiter.png)

![moon](https://img.muelsyse.us/bed/moon.png)
\`\`\`
`, { fileURL: aboutFileUrl });

  assert.match(result.code, /<figure class="image-layout image-layout--carousel"[^>]*data-image-layout-carousel/);
  assert.match(result.code, /class="image-layout__stage"/);
  assert.equal((result.code.match(/class="image-layout__slide"/g) ?? []).length, 2);
  assert.equal((result.code.match(/class="image-layout__thumbnail"/g) ?? []).length, 2);
  assert.match(result.code, /aria-label="Show image 1"[^>]*aria-current="true"/);
  assert.match(result.code, /alt="jupiter"/);
  assert.match(result.code, /alt="moon"/);
  assert.doesNotMatch(result.code, /language-image-layout/);
});

test("Image Layouts grid, masonry, and custom variants retain their layout intent", async () => {
  const grid = await processor.render(`
\`\`\`image-layout
---
layout: d
fit: contain
overlay: always
caption: Three views
---
![One](https://example.com/one.png)
![Two](https://example.com/two.png)
![Three](https://example.com/three.png)
\`\`\`
`, { fileURL: aboutFileUrl });
  const masonry = await processor.render(`
\`\`\`image-layout
---
layout: masonry-3
---
![One](https://example.com/one.png)
![Two](https://example.com/two.png)
![Three](https://example.com/three.png)
\`\`\`
`, { fileURL: aboutFileUrl });
  const custom = await processor.render(`
\`\`\`image-layout
---
layout: custom
grid: |
  A A B
  A A C
---
![One](https://example.com/one.png)
![Two](https://example.com/two.png)
![Three](https://example.com/three.png)
\`\`\`
`, { fileURL: aboutFileUrl });

  assert.match(grid.code, /class="image-layout image-layout--grid image-layout--d image-layout--fit-contain image-layout--overlay-always"/);
  assert.match(grid.code, /<figcaption class="image-layout__caption">Three views<\/figcaption>/);
  assert.match(masonry.code, /class="image-layout image-layout--masonry[^"]*"[^>]*style="--image-layout-columns: 3"/);
  assert.equal((masonry.code.match(/class="image-layout__masonry-column"/g) ?? []).length, 3);
  assert.match(custom.code, /class="image-layout image-layout--grid image-layout--custom/);
  assert.match(custom.code, /class="image-layout__grid" style="grid-template-columns:[^"]*grid-template-areas: &quot;image-0 image-0 image-1&quot; &quot;image-0 image-0 image-2&quot;/);
});

test("Obsidian image width suffixes become centered responsive display widths", async () => {
  const result = await processor.render(
    "![看过的东野圭吾作品|475](https://img.muelsyse.us/bed/books.png)",
    { fileURL: writingFileUrl },
  );

  assert.match(result.code, /class="obsidian-image-size"/);
  assert.match(result.code, /style="--obsidian-image-width: 475px"/);
  assert.match(result.code, /alt="看过的东野圭吾作品"/);
  assert.match(result.code, /<figcaption>看过的东野圭吾作品<\/figcaption>/);
  assert.doesNotMatch(result.code, /东野圭吾作品\|475/);
});

test("article image enhancements expose carousel and lightbox controls", () => {
  const component = readFileSync(
    new URL("../src/components/domain/MarkdownEnhancements.astro", import.meta.url),
    "utf8",
  );

  assert.match(component, /data-image-lightbox/);
  assert.match(component, /showModal\(\)/);
  assert.match(component, /data-image-layout-carousel/);
  assert.match(component, /ArrowLeft/);
  assert.match(component, /ArrowRight/);
  assert.match(component, /Escape/);
  assert.match(component, /data-image-layout-placeholder/);
});

test("all fixed layouts enforce the plugin 0.18.0 capacity and placeholders", async () => {
  const capacities = { a: 2, b: 2, c: 2, d: 3, e: 3, f: 4, g: 4, h: 3, i: 4, single: 1 };
  for (const [layout, capacity] of Object.entries(capacities)) {
    const result = await processor.render(`\n\`\`\`image-layout\n---\nlayout: ${layout}\n---\n![One](https://example.com/one.png)\n![Extra 1](https://example.com/extra-1.png)\n![Extra 2](https://example.com/extra-2.png)\n![Extra 3](https://example.com/extra-3.png)\n![Hidden](https://example.com/hidden.png)\n\`\`\`\n`, { fileURL: aboutFileUrl });
    assert.equal((result.code.match(/class="image-layout__item/g) ?? []).length, capacity, layout);
    assert.equal((result.code.match(/grid-area: image-/g) ?? []).length, capacity, layout);
    if (capacity < 5) assert.doesNotMatch(result.code, /hidden\.png/, layout);
  }

  const missing = await processor.render("```image-layout-a\n![One](https://example.com/one.png)\n```", { fileURL: aboutFileUrl });
  assert.equal((missing.code.match(/data-image-layout-placeholder/g) ?? []).length, 1);
});

test("masonry 2 through 6 keeps every image without placeholders", async () => {
  for (let columns = 2; columns <= 6; columns += 1) {
    const result = await processor.render(`\n\`\`\`image-layout-masonry-${columns}\n![One](https://example.com/one.png)\n![Two](https://example.com/two.png)\n![Three](https://example.com/three.png)\n\`\`\`\n`, { fileURL: aboutFileUrl });
    assert.equal((result.code.match(/image-layout__masonry-column/g) ?? []).length, columns);
    assert.equal((result.code.match(/class="image-layout__item/g) ?? []).length, 3);
    assert.doesNotMatch(result.code, /data-image-layout-placeholder/);
  }
});

test("custom grids reject malformed regions and pad valid slots", async () => {
  const cases = [
    ["", /needs a `grid` option/],
    ["A A\\nB", /same number of cells/],
    [". .\\n. .", /at least one image cell/],
    ["A A\\nA B", /solid rectangle/],
    [Array.from({ length: 21 }, (_, index) => `X${index}`).join(" "), /up to 20 images/],
  ];
  for (const [grid, error] of cases) {
    const gridOption = grid ? `grid: |\n${grid.split("\\n").map((row) => `  ${row}`).join("\n")}` : "";
    const result = await processor.render(`\n\`\`\`image-layout\n---\nlayout: custom\n${gridOption}\n---\n![One](https://example.com/one.png)\n\`\`\`\n`, { fileURL: aboutFileUrl });
    assert.match(result.code, /class="image-layout-error"/);
    assert.match(result.code, error);
  }

  const valid = await processor.render("```image-layout\n---\nlayout: custom\ngrid: |\n  A A B\n  A A C\n---\n![One](https://example.com/one.png)\n```", { fileURL: aboutFileUrl });
  assert.equal((valid.code.match(/data-image-layout-placeholder/g) ?? []).length, 2);
});

test("Wiki images, folder images, pipe sizes, sorting, reverse, and limit resolve from the vault index", async () => {
  const vaultAssets = {
    "note/attachments/one.png": { fallback: "https://img.test/one.webp", mtime: 30 },
    "gallery/a.png": { fallback: "https://img.test/a.webp", mtime: 20 },
    "gallery/b.png": { fallback: "https://img.test/b.webp", mtime: 10 },
    "gallery/nested/c.png": { fallback: "https://img.test/c.webp", mtime: 5 },
  };
  const resolved = await configuredProcessor({ vaultAssets });
  const result = await resolved.render(`\n\`\`\`image-layout\n---\nlayout: masonry-2\nfromFolder: gallery\nsortBy: mtime\nreverse: true\nlimit: 1\n---\n![[attachments/one.png|说明|300x200]]\n\`\`\`\n`, { fileURL: writingFileUrl });
  assert.match(result.code, /src="https:\/\/img\.test\/one\.webp"/);
  assert.match(result.code, /alt="说明"/);
  assert.match(result.code, /--obsidian-image-width: 300px; --obsidian-image-height: 200px/);
  assert.match(result.code, /src="https:\/\/img\.test\/a\.webp"/);
  assert.doesNotMatch(result.code, /b\.webp|c\.webp/);

  const standalone = await resolved.render("![[attachments/one.png|独立图片|475]]", { fileURL: writingFileUrl });
  assert.match(standalone.code, /src="https:\/\/img\.test\/one\.webp"/);
  assert.match(standalone.code, /--obsidian-image-width: 475px/);

  const localized = await resolved.render("![[attachments/one.png]]", {
    fileURL: new URL("../src/i18n/content/en/note/image-size-test.md", import.meta.url),
  });
  assert.match(localized.code, /src="https:\/\/img\.test\/one\.webp"/);

  const noteEmbed = await resolved.render("![[Another note]]", { fileURL: writingFileUrl });
  assert.match(noteEmbed.code, /!\[\[Another note\]\]/);
  assert.doesNotMatch(noteEmbed.code, /<img/);

  const mixedEmbeds = await resolved.render("Before ![[Another note]] after ![[attachments/one.png]] end.", { fileURL: writingFileUrl });
  assert.match(mixedEmbeds.code, /Before !\[\[Another note\]\] after <img[^>]*src="https:\/\/img\.test\/one\.webp"[^>]*> end\./);
  assert.equal((mixedEmbeds.code.match(/Before/g) ?? []).length, 1);
});

test("layout options honor precedence and reject unsafe CSS values", async () => {
  const configured = await configuredProcessor({ settings: { overlayMode: "always" } });
  const result = await configured.render(`\n\`\`\`image-layout\n---\nlayout: carousel\ncaption: Gallery\ndescriptions: [First]\ncarouselShowThumbnails: true\ncarouselBackground: "#123456"\ncarouselHeight: "calc(30rem - 2px)"\n---\n![Alt](https://example.com/one.png)\n\`\`\`\n`, { fileURL: aboutFileUrl });
  assert.match(result.code, /--image-layout-carousel-background: #123456/);
  assert.match(result.code, /--image-layout-carousel-height: calc\(30rem - 2px\)/);
  assert.match(result.code, /class="image-layout__thumbnail"/);
  assert.match(result.code, /class="image-layout__description"[^>]*>First</);
  assert.match(result.code, />Gallery<\/figcaption>/);

  const unsafe = await processor.render("```image-layout\n---\nlayout: single\nwidth: '1px; color: red'\ncarouselBackground: 'url(https://bad.test/x)'\n---\n![One](https://example.com/one.png)\n```", { fileURL: aboutFileUrl });
  assert.doesNotMatch(unsafe.code, /color: red|bad\.test/);

  const permanent = await configured.render("```image-layout\n---\nlayout: single\npermanentOverlay: false\n---\n![One](https://example.com/one.png)\n```", { fileURL: aboutFileUrl });
  assert.match(permanent.code, /image-layout--overlay-hover/);
});

test("empty carousel uses a non-lightbox placeholder and empty or unknown layouts render errors", async () => {
  const carousel = await processor.render("```image-layout\n---\nlayout: carousel\n---\n```", { fileURL: aboutFileUrl });
  assert.equal((carousel.code.match(/data-image-layout-placeholder/g) ?? []).length, 1);
  const empty = await processor.render("```image-layout\n![One](https://example.com/one.png)\n```", { fileURL: aboutFileUrl });
  assert.match(empty.code, /Choose a layout in Obsidian/);
  const unknown = await processor.render("```image-layout\n---\nlayout: impossible\n---\n```", { fileURL: aboutFileUrl });
  assert.match(unknown.code, /Unknown layout/);
});

test("the installed compatibility target is Obsidian Image Layouts 0.18.0", () => {
  assert.equal(IMAGE_LAYOUTS_COMPATIBILITY_VERSION, "0.18.0");
  const worktreeManifest = new URL("../src/content/.obsidian/plugins/obsidian-image-layouts/manifest.json", import.meta.url);
  const mainManifest = new URL("../../../src/content/.obsidian/plugins/obsidian-image-layouts/manifest.json", import.meta.url);
  const manifestPath = [worktreeManifest, mainManifest].find((candidate) => existsSync(candidate));
  if (!manifestPath) return;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.id, "obsidian-image-layouts");
  assert.equal(manifest.version, "0.18.0");
});
