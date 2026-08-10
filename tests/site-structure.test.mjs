import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

test("the primary canvas keeps the writing routes and loads deferred sections", () => {
  const layout = read("src/layouts/SpaLayout.astro");

  for (const route of ["/", "/about/", "/blog/", "/note/", "/project/"]) {
    assert.match(layout, new RegExp(`"${route.replaceAll("/", "\\/")}"`));
  }
  assert.match(layout, /data-section-url=\{localizePath\(path, locale\)\}/);
  assert.match(layout, /requestIdleCallback/);
  assert.match(layout, /X-Spa-Fragment/);
});

test("navigation exposes the writing, links, and Life destinations", () => {
  const header = read("src/components/site/Header.astro");

  for (const label of ["About", "Blog", "Note", "Project", "Links", "Life", "Books", "Music", "Screen", "Game"]) {
    assert.match(header, new RegExp(`(?:>|label: ")${label}`));
  }
  for (const route of ["/art/book/", "/art/music/", "/art/screen/", "/art/game/"]) {
    assert.match(header, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.match(header, /localizePath\(item\.href, locale\)/);
});

test("desktop navigation stays hidden while scrolling and reveals on hover", () => {
  const header = read("src/components/site/Header.astro");

  assert.match(header, /class="desktop-nav-region"/);
  assert.match(header, /desktopNav\.dataset\.hidden/);
  assert.match(header, /window\.addEventListener\(\s*"scroll"/);
  assert.match(header, /currentScrollY <= 0[\s\S]*else setHidden\(true\)/);
  assert.match(header, /setHidden\(window\.scrollY > 0\)/);
  assert.doesNotMatch(header, /previousScrollY/);
  assert.match(header, /desktopNavRegion\.addEventListener\(\s*"pointerenter"/);
  assert.match(header, /desktopNavRegion\.addEventListener\(\s*"pointerleave"/);
  assert.doesNotMatch(header, /header\.addEventListener\(\s*"pointer(?:enter|leave)"/);
  assert.doesNotMatch(header, /DESKTOP_NAV_REVEAL_INTERACTION_MS/);
  assert.match(header, /\.desktop-nav-region\s*\{[^}]*align-self:\s*stretch;/s);
  assert.match(header, /\.desktop-nav\[data-hidden="true"\]/);
  assert.doesNotMatch(header, /data-interactive/);
  assert.doesNotMatch(header, /\.site-header\[data-hidden="true"\]/);
});

test("theme transitions expand from the theme icon through scoped CSS", () => {
  const toggle = read("src/components/site/ThemeToggle.astro");
  const global = read("src/styles/global.css");

  assert.match(toggle, /querySelector<SVGElement>\("\[data-theme-icon\]"\)/);
  assert.match(toggle, /--theme-transition-x/);
  assert.match(toggle, /--theme-transition-y/);
  assert.match(toggle, /\(x \/ window\.innerWidth\) \* 100/);
  assert.match(toggle, /\(y \/ window\.innerHeight\) \* 100/);
  assert.doesNotMatch(toggle, /--theme-transition-radius/);
  assert.doesNotMatch(toggle, /document\.documentElement\.animate/);
  assert.match(global, /@keyframes theme-reveal/);
  assert.match(global, /html\[data-theme-transitioning\]::view-transition-new\(root\)/);
  assert.match(
    global,
    /circle\(\s*0px at var\(--theme-transition-x\) var\(--theme-transition-y\)\s*\)/,
  );
  assert.match(
    global,
    /circle\(\s*150vmax at var\(--theme-transition-x\)\s*var\(--theme-transition-y\)\s*\)/,
  );
});

test("percentage theme origins remain aligned across viewports and zoom", () => {
  const cases = [
    { width: 390, height: 844, x: 301, y: 32, zoom: 1 },
    { width: 1280, height: 720, x: 1184, y: 44, zoom: 1.25 },
    { width: 1728, height: 480, x: 1630, y: 44, zoom: 1.5 },
    { width: 2810, height: 780, x: 2650, y: 48, zoom: 2 },
  ];

  for (const { width, height, x, y, zoom } of cases) {
    const renderedWidth = width * zoom;
    const renderedHeight = height * zoom;
    const renderedX = (x / width) * renderedWidth;
    const renderedY = (y / height) * renderedHeight;
    const radius = Math.max(renderedWidth, renderedHeight) * 1.5;
    const farthestCorner = Math.hypot(
      Math.max(renderedX, renderedWidth - renderedX),
      Math.max(renderedY, renderedHeight - renderedY),
    );

    assert.equal(renderedX, x * zoom);
    assert.equal(renderedY, y * zoom);
    assert.ok(radius >= farthestCorner);
  }
});

test("public sections share the content frame and responsive mobile padding", () => {
  const global = read("src/styles/global.css");
  assert.match(global, /--content-frame-inline-start:/);
  assert.match(global, /--content-frame-inline-end:/);
  assert.match(global, /\.content-container/);
  assert.match(global, /safe-area-inset-left/);
  assert.match(global, /safe-area-inset-right/);

  for (const path of [
    "src/components/sections/HomeSection.astro",
    "src/components/sections/AboutSection.astro",
  ]) {
    assert.match(read(path), /content-container/, `${path} must use the shared content frame`);
  }

  for (const path of [
    "src/components/sections/ContentSection.astro",
    "src/components/sections/ArtSection.astro",
    "src/components/sections/GameSection.astro",
    "src/components/domain/ContentDetail.astro",
  ]) {
    assert.match(read(path), /detail-layout-(?:outer|inner)/, `${path} must use the shared detail frame`);
  }
});

test("Blog Note and Project collections and localized archive routes remain configured", () => {
  const config = read("src/content.config.ts");
  const images = read("scripts/lib/blog-images.mjs");

  for (const group of ["blog", "note", "project"]) {
    assert.match(config, new RegExp(`const ${group} = defineCollection`));
    assert.equal(exists(`src/pages/${group}/index.astro`), true);
    assert.equal(exists(`src/pages/[locale]/${group}/index.astro`), true);
  }
  assert.match(images, /CONTENT_GROUPS\s*=\s*\["blog",\s*"note",\s*"project"\]/);
});

test("writing archives and details retain their functional components", () => {
  const archive = read("src/components/sections/ContentSection.astro");
  const detail = read("src/components/domain/ContentDetail.astro");
  const global = read("src/styles/global.css");
  const toc = read("src/components/domain/TableOfContents.astro");

  assert.match(archive, /ArchiveActivityTimeline/);
  assert.match(archive, /ArchiveTableOfContents/);
  assert.match(archive, /\.content-timeline time[^}]*font-size:\s*var\(--type-base\)/s);
  assert.match(archive, /\.content-timeline a[^}]*font-size:\s*var\(--type-md\)/s);
  assert.match(detail, /<h1 class="ui-page-title">\{item\.title\}<\/h1>/);
  assert.match(detail, /PostEngagement/);
  assert.match(detail, /CommentsSection/);
  assert.match(detail, /TableOfContents/);
  assert.match(global, /html:lang\(zh\)[^}]*\.article-prose\s*>\s*p[^}]*text-indent:\s*2em/s);
  assert.match(global, /html:lang\(ja\)[^}]*\.article-prose\s*>\s*p[^}]*text-indent:\s*2em/s);
  assert.match(global, /\.article-figure[^}]*margin:\s*0/s);
  assert.match(toc, /data-toc-progress/);
  assert.match(toc, /data-toc-link/);
});

test("localized content routes keep their route builders", () => {
  for (const path of [
    "src/pages/[locale]/blog/index.astro",
    "src/pages/[locale]/note/index.astro",
    "src/pages/[locale]/project/index.astro",
    "src/pages/[locale]/links/index.astro",
  ]) {
    assert.match(read(path), /getStaticPaths/, `${path} must generate localized routes`);
  }

  const dynamicArt = read("src/pages/[locale]/art/[type]/index.astro");
  assert.match(dynamicArt, /Astro\.params\.locale/);
  assert.match(dynamicArt, /Astro\.params\.type/);
});

test("art pages use the D1-backed public and administrative flows", () => {
  const admin = read("src/components/domain/ArtAdmin.tsx");
  const publicSection = read("src/components/sections/ArtSection.astro");

  assert.match(admin, /\/api\/admin\/art\/items/);
  assert.match(admin, /\/api\/admin\/art\/covers/);
  assert.match(admin, /cache:\s*"no-store"/);
  assert.match(publicSection, /data-music-tab/);
  assert.match(publicSection, /data-ranking-tab/);

  for (const route of ["book", "music", "screen", "game"]) {
    assert.equal(exists(`src/pages/art/${route}/index.astro`), true);
  }
});

test("legacy routes redirect or stay removed", () => {
  assert.match(read("src/pages/blogs/index.astro"), /Astro\.redirect\("\/blog\/", 301\)/);
  assert.match(read("src/pages/[locale]/blogs/index.astro"), /Astro\.redirect\([\s\S]*301/);
  assert.equal(exists("src/pages/series/index.astro"), false);
  assert.equal(exists("src/pages/series/[slug].astro"), false);
  assert.equal(exists("src/pages/[section]-archive.astro"), false);
});

test("homepage activity widgets and project links remain wired", () => {
  const home = read("src/components/sections/HomeSection.astro");
  const detail = read("src/components/domain/ContentDetail.astro");

  assert.match(home, /GitHubHeatmap/);
  assert.match(home, /\/api\/wakatime-badge\.svg/);
  assert.match(home, /getPublishedContent\("project", locale\)/);
  assert.match(detail, /item\.projectUrl/);
  assert.match(detail, /item\.docUrl/);
});

test("home and About omit the profile location and major", () => {
  const home = read("src/components/sections/HomeSection.astro");
  const profiles = [
    ["src/content/about/profile.md", "重庆大学国家卓越工程师学院大三在读 机器人工程专业"],
    ["src/i18n/content/en/about/profile.md", "I am a third-year Robotics Engineering student"],
    ["src/i18n/content/ja/about/profile.md", "重慶大学国家卓越工程師学院の3年生"],
    ["src/i18n/content/zh-TW/about/profile.md", "目前就讀於重慶大學國家卓越工程師學院大三"],
  ];

  assert.doesNotMatch(home, /profile\.(?:major|city)/);
  for (const [file, biography] of profiles) {
    const profile = read(file);
    assert.doesNotMatch(profile, /^(?:city|major):/m);
    assert.doesNotMatch(profile, new RegExp(biography));
  }
});
