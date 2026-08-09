import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createSatteriMarkdownProcessor } from "@astrojs/markdown-satteri";

import { markdownOptions } from "../src/lib/markdown.mjs";

const processor = await createSatteriMarkdownProcessor(markdownOptions);
const aboutFileUrl = new URL("../src/content/about/image-layout-test.md", import.meta.url);
const writingFileUrl = new URL("../src/content/note/image-size-test.md", import.meta.url);

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
});
