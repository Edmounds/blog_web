import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the primary canvas contains the five requested pages in order", () => {
  const layout = read("src/layouts/SpaLayout.astro");
  assert.match(layout, /width:\s*500vw/);

  const paths = [...layout.matchAll(/data-path="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(paths, ["/", "/about/", "/blog/", "/note/", "/project/"]);
});

test("navigation labels stay English and Life exposes the four collection routes", () => {
  const header = read("src/components/site/Header.astro");
  for (const label of ["About", "Blog", "Note", "Project", "Life", "Books", "Music", "Screen", "Game"]) {
    assert.match(header, new RegExp(`(?:>|label: ")${label}`));
  }
  assert.doesNotMatch(header, />Home</);
  assert.match(header, /\/art\/book\//);
  assert.match(header, /\/art\/music\//);
  assert.match(header, /\/art\/screen\//);
  assert.match(header, /\/art\/game\//);
});

test("the sticky header uses an opaque theme canvas and larger desktop navigation type", () => {
  const header = read("src/components/site/Header.astro");
  assert.match(header, /\.site-header\s*\{[^}]*position:\s*sticky;[^}]*background:\s*var\(--canvas\);/s);
  assert.match(header, /\.site-header__inner\s*\{[^}]*min-height:\s*4\.5rem;/s);
  assert.match(header, /\.desktop-nav\s*>\s*a,[^}]*\.life-menu\s*>\s*button\s*\{[^}]*font-size:\s*var\(--type-base\);/s);
  assert.match(header, /\.mobile-menu\s*\{[^}]*background:\s*var\(--canvas\);/s);
  assert.match(header, /@media\s*\(max-width:\s*48rem\)[\s\S]*?\.site-header__inner\s*\{[^}]*min-height:\s*4rem;/);
  assert.doesNotMatch(header, /\.(?:site-header|mobile-menu)\s*\{[^}]*\b(?:border|box-shadow|backdrop-filter)\s*:/s);
});

test("top-level section headers render titles without nearby descriptions or category links", () => {
  const content = read("src/components/sections/ContentSection.astro");
  assert.match(content, /<header class="content-listing__header">\s*<h1>\{title\}<\/h1>\s*<\/header>/);
  assert.doesNotMatch(content, /View categories|content-listing__categories|Essays and longer-form writing|Short observations and working notes|Selected work and experiments/);

  const art = read("src/components/sections/ArtSection.astro");
  assert.match(art, /<h1 class="ui-page-title">\{title\}<\/h1>/);
  assert.doesNotMatch(art, /<p class="ui-lead">|const description\s*=/);
  assert.match(art, /type === "screen"[\s\S]*data-screen-tabs/);

  const about = read("src/components/sections/AboutSection.astro");
  assert.match(about, /<header class="about-article__header">[\s\S]*<h1>\{profile\.data\.name\}<\/h1>[\s\S]*<img /);
  assert.match(about, /<Content \/>/);
  assert.doesNotMatch(about, /profile\.(?:story|meta|focusCards|experience|homeFeatured)/);
});

test("section descriptions remain available to page metadata", () => {
  const layout = read("src/layouts/BaseLayout.astro");
  assert.match(layout, /<meta name="description" content=\{resolvedDescription\}/);
  assert.match(read("src/pages/art/book/index.astro"), /description=\{site\.page\.bookDescription\}/);
  assert.match(read("src/pages/blog/index.astro"), /description="Essays and longer-form writing\."/);
});

test("legacy blogs routes permanently redirect and Series routes are gone", () => {
  assert.match(read("src/pages/blogs/index.astro"), /Astro\.redirect\("\/blog\/", 301\)/);
  assert.match(read("src/pages/\[locale\]/blogs/index.astro"), /Astro\.redirect\([\s\S]*, 301\)/);
  assert.throws(() => read("src/pages/series/index.astro"));
  assert.throws(() => read("src/pages/series/[slug].astro"));
  assert.throws(() => read("src/pages/links/index.astro"));
});

test("Blog Note and Project content collections and image sync roots are configured", () => {
  const config = read("src/content.config.ts");
  assert.match(config, /const blog = defineCollection/);
  assert.match(config, /const note = defineCollection/);
  assert.match(config, /const project = defineCollection/);

  const images = read("scripts/lib/blog-images.mjs");
  assert.match(images, /CONTENT_GROUPS\s*=\s*\["blog",\s*"note",\s*"project"\]/);
});

test("art covers render from the public image CDN and local uploads avoid blob previews", () => {
  const admin = read("src/components/domain/ArtAdmin.tsx");
  const shared = read("functions/_shared/art.js");
  const publicArt = read("src/lib/art.ts");

  assert.match(admin, /\/api\/admin\/art\/covers/);
  assert.doesNotMatch(admin, /URL\.createObjectURL/);
  assert.match(admin, /kind: "stored"/);
  assert.match(shared, /https:\/\/img\.muelsyse\.us/);
  assert.match(publicArt, /https:\/\/img\.muelsyse\.us/);
});

test("music administration uses one Deezer search field and preserves selectable results after saving", () => {
  const admin = read("src/components/domain/ArtAdmin.tsx");
  const search = read("functions/_shared/art-search.js");

  assert.match(admin, /专辑名或歌手/);
  assert.match(admin, /type !== "music"[\s\S]*type === "book" \? "作者" : "补充关键词"/);
  assert.match(admin, /type === "music" \? "deezer_music"/);
  assert.match(admin, /已收藏/);
  assert.match(admin, /const collectedCandidates = useMemo/);
  assert.doesNotMatch(admin, /setForm\(blankForm\(type\)\); setCandidates\(\[\]\); await loadItems/);
  assert.doesNotMatch(search, /itunes\.apple\.com|searchAppleMusic|upgradeAppleArtwork/);
  assert.doesNotMatch(read("src/lib/cover-api.ts"), /itunes\.apple\.com|ItunesSearchResponse/);
});

test("localized RSS routes and the WakaTime proxy support both server-side key names", () => {
  assert.match(read("src/pages/rss.xml.ts"), /createRssResponse/);
  assert.match(read("src/pages/[locale]/rss.xml.ts"), /createRssResponse/);
  assert.match(read("src/pages/api/wakatime-badge.svg.ts"), /resolveWakaTimeApiKey/);
  assert.match(read("src/pages/api/wakatime-status.svg.ts"), /resolveWakaTimeApiKey/);

  const envTypes = read("src/env.d.ts");
  assert.match(envTypes, /WAKA_TIME_API_KEY\?: string/);
  assert.match(envTypes, /WAKATIME_API_KEY\?: string/);
});

test("the homepage shows only the compact WakaTime badge and a stable theme-aware GitHub animation", () => {
  const home = read("src/components/sections/HomeSection.astro");
  const badge = read("src/pages/api/wakatime-badge.svg.ts");
  const lightUrl = "https://raw.githubusercontent.com/Edmounds/Edmounds/refs/heads/output/github-contribution-grid-snake.svg";
  const darkUrl = "https://raw.githubusercontent.com/Edmounds/Edmounds/refs/heads/output/github-contribution-grid-snake-dark.svg";

  assert.equal((home.match(/\/api\/wakatime-badge\.svg/g) ?? []).length, 1);
  assert.doesNotMatch(home, /\/api\/wakatime-status\.svg|wakatime-status/);
  assert.match(badge, /getCachedWakaTimeAllTime/);
  assert.match(badge, /aria-label="Code time/);
  assert.match(badge, /width="160" height="24"/);
  assert.match(badge, />CodeTime</);
  assert.doesNotMatch(badge, /<rect/);
  assert.match(home, /<\/nav>[\s\S]*class="codetime-badge"[\s\S]*profile-card__intro/);
  assert.match(home, /html\.dark[^}]*codetime-badge[^}]*filter:\s*invert\(1\)/);
  assert.doesNotMatch(badge, /Today|language|editor/);
  assert.doesNotMatch(home, /Today's coding activity/);
  assert.match(home, new RegExp(lightUrl.replaceAll(".", "\\.")));
  assert.match(home, new RegExp(darkUrl.replaceAll(".", "\\.")));
  assert.match(home, /<picture>[\s\S]*prefers-color-scheme: dark[\s\S]*prefers-color-scheme: light[\s\S]*<img/);
  assert.match(home, /width="880" height="192"/);
  assert.match(home, /aspect-ratio:\s*880\s*\/\s*192/);
  assert.match(home, /document\.documentElement\.classList\.contains\("dark"\)/);
  assert.match(home, /blog:theme-change/);
  assert.match(home, /querySelectorAll\("source"\)/);
});

test("the homepage keeps the legacy GitHub Bilibili and mail SVG paths around Steam", () => {
  const home = read("src/components/sections/HomeSection.astro");

  assert.match(home, /M15 22v-4a4\.8 4\.8 0 0 0-1-3\.5c3 0 6-2 6-5\.5/);
  assert.match(home, /M17\.813 4\.653a\.85\.85 0 0 1 \.15\.15/);
  assert.match(home, /m22 7-8\.97 5\.7a1\.94 1\.94 0 0 1-2\.06 0L2 7/);
  assert.doesNotMatch(home, />GH<|>B</);
  assert.match(home, /href="https:\/\/github\.com\/Edmounds"/);
  assert.match(home, /href="https:\/\/space\.bilibili\.com\/397591871"/);
  assert.match(home, /href="https:\/\/steamcommunity\.com\/profiles\/76561198437201442"/);
  assert.match(home, /href="mailto:i@muelsyse\.us"/);
  assert.doesNotMatch(home, /music\.163\.com|NetEase/);
});

test("category archive routes are removed in favor of tags", () => {
  assert.throws(() => read("src/pages/[section]-archive.astro"));
  assert.throws(() => read("src/pages/[section]-archive/[archiveSlug].astro"));
  assert.throws(() => read("src/pages/[locale]/[section]-archive.astro"));
  assert.throws(() => read("src/pages/[locale]/[section]-archive/[archiveSlug].astro"));

  const content = read("src/components/sections/ContentSection.astro");
  assert.match(content, /post\.tags\.map/);
});

test("About renders the profile as a normal Markdown article with the code-rain background", () => {
  const about = read("src/components/sections/AboutSection.astro");
  const background = read("src/components/site/RouteBackground.astro");
  assert.match(about, /render\(profile\)/);
  assert.match(about, /profile\.data\.major/);
  assert.match(about, /profile\.data\.city/);
  assert.doesNotMatch(about, /about-document__toc|href="#about-focus"/);
  assert.match(background, /path === "\/about\/"[\s\S]*\? "rain"/);
});

test("Project detail supports project and documentation links", () => {
  const detail = read("src/components/domain/ContentDetail.astro");
  assert.match(detail, /item\.projectUrl/);
  assert.match(detail, /item\.docUrl/);
});
