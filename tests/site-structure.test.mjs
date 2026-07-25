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

test("the transparent header keeps its side controls visible while auto-hiding desktop navigation", () => {
  const header = read("src/components/site/Header.astro");
  assert.match(header, /data-header-reveal-zone/);
  assert.match(header, /\.site-header\s*\{[^}]*position:\s*sticky;[^}]*background:\s*transparent;/s);
  assert.match(header, /\.site-header__inner\s*\{[^}]*min-height:\s*4\.5rem;/s);
  assert.match(header, /--desktop-nav-font-size:\s*clamp\(16\.3px,\s*0\.82rem \+ 0\.13vw,\s*20px\);/s);
  assert.match(header, /\.desktop-nav\s*>\s*a,[\s\S]*?\.life-menu__items a\s*\{[^}]*font-family:\s*var\(--font-ui\);[^}]*font-size:\s*var\(--desktop-nav-font-size\);/s);
  assert.match(header, /\.mobile-menu\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--canvas\) 82%, transparent\);/s);
  assert.match(header, /desktopNav\.dataset\.hidden/);
  assert.match(header, /window\.addEventListener\("scroll"/);
  assert.match(header, /revealZone\.addEventListener\("pointerenter"/);
  assert.match(header, /matchMedia\("\(hover: hover\) and \(pointer: fine\)"\)/);
  assert.match(header, /\.desktop-nav\[data-hidden="true"\]/);
  assert.doesNotMatch(header, /\.site-header\[data-hidden="true"\]/);
  assert.match(header, /@media\s*\(max-width:\s*64rem\)[\s\S]*?\.site-header__inner\s*\{[^}]*min-height:\s*4rem;/);
  assert.match(header, /@media\s*\(max-width:\s*30rem\)[\s\S]*?\.site-header__tools\s*\{[^}]*gap:\s*0;/);
  assert.match(header, /@media\s*\(max-width:\s*30rem\)[\s\S]*?\.site-signature\s*\{[^}]*width:\s*min\(100%,\s*8\.75rem\);[^}]*font-size:\s*2\.15rem;/);
  assert.doesNotMatch(header, /backdrop-filter/);
});

test("public content pages share a narrower symmetric content container", () => {
  const global = read("src/styles/global.css");
  assert.match(global, /--content-shell-max:\s*88rem;/);
  assert.match(global, /--content-rail-left:\s*clamp\(21rem,\s*32vw,\s*33rem\);/);
  assert.match(global, /--content-rail-right:\s*clamp\(11rem,\s*13\.5vw,\s*18rem\);/);
  assert.match(global, /\.content-container\s*\{[^}]*max-width:\s*none;[^}]*margin-left:\s*max\(var\(--content-rail-left\),[^}]*margin-right:\s*max\(var\(--content-rail-right\),/s);
  assert.match(global, /@media\s*\(max-width:\s*64rem\)[\s\S]*?\.content-container\s*\{[^}]*margin-inline:\s*auto;/s);

  for (const path of [
    "src/components/sections/HomeSection.astro",
    "src/components/sections/AboutSection.astro",
    "src/components/sections/ContentSection.astro",
    "src/components/sections/ArtSection.astro",
    "src/components/sections/GameSection.astro",
    "src/components/domain/ContentDetail.astro",
  ]) {
    assert.match(read(path), /class="[^"]*content-container/);
  }

  assert.match(read("src/components/site/Header.astro"), /site-header__inner app-container/);
  assert.match(read("src/pages/admin/art/index.astro"), /class="app-container/);
});

test("top-level writing sections use the compact Astro-star archive layout", () => {
  const content = read("src/components/sections/ContentSection.astro");
  assert.match(content, /<h1>All \{sectionLabel\}<\/h1>/);
  assert.match(content, /font-size:\s*clamp\(2\.3rem,\s*2rem \+ 1\.5vw,\s*4\.3rem\)/);
  assert.match(content, /ArchiveActivityTimeline/);
  assert.match(content, /ArchiveTableOfContents/);
  assert.match(content, /padding-bottom:\s*clamp\(0\.75rem,\s*1\.5vw,\s*1\.25rem\)/);
  assert.match(content, /margin-bottom:\s*0;/);

  const activity = read("src/components/domain/ArchiveActivityTimeline.astro");
  assert.match(activity, /--activity-axis:\s*2\.5rem;/);
  assert.match(activity, /height:\s*6\.75rem;/);
  assert.match(activity, /margin-block:\s*0 2rem;/);
  assert.match(activity, /top:\s*5\.15rem;/);
  assert.doesNotMatch(content, /View categories|content-listing__categories|Essays and longer-form writing|Short observations and working notes|Selected work and experiments/);

  const art = read("src/components/sections/ArtSection.astro");
  assert.match(art, /<h1 class="ui-page-title">\{title\}<\/h1>/);
  assert.doesNotMatch(art, /<p class="ui-lead">|const description\s*=/);
  assert.match(art, /type === "screen"[\s\S]*data-screen-tabs/);

  const about = read("src/components/sections/AboutSection.astro");
  assert.match(about, /<header class="about-article__header">[\s\S]*<h1>\{profile\.data\.name\}<\/h1>[\s\S]*<img /);
  assert.match(about, /\.about-article__header h1\s*\{[^}]*font-size:\s*clamp\(2\.3rem,\s*2rem \+ 1\.5vw,\s*4\.3rem\);/s);
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

test("music administration separates albums and singles while preserving selectable results after saving", () => {
  const admin = read("src/components/domain/ArtAdmin.tsx");
  const search = read("functions/_shared/art-search.js");

  assert.match(admin, /歌曲名或歌手/);
  assert.match(admin, /type MusicKind = "album" \| "single"/);
  assert.match(admin, /musicKind=\$\{selectedMusicKind\}/);
  assert.match(admin, /params\.set\("musicKind", musicKind\)/);
  assert.match(admin, /type !== "music"[\s\S]*type === "book" \? "作者" : "补充关键词"/);
  assert.match(admin, /type === "music" \? "deezer_music"/);
  assert.match(admin, /已收藏/);
  assert.match(admin, /const collectedCandidates = useMemo/);
  assert.match(admin, /\/api\/admin\/art\/items\?type=\$\{selectedType\}\$\{suffix\}`,[\s\S]*cache: "no-store"/);
  assert.match(admin, /setItems\(ensuredItem \? \[ensuredItem,[\s\S]*item\.id !== ensuredItem\.id/);
  assert.match(admin, /setItems\(\(current\) => \[data\.item,[\s\S]*item\.id !== data\.item\.id/);
  assert.doesNotMatch(admin, /setForm\(blankForm\(type\)\); setCandidates\(\[\]\); await loadItems/);
  assert.doesNotMatch(search, /itunes\.apple\.com|searchAppleMusic|upgradeAppleArtwork/);
  assert.match(search, /searchDeezerTracks/);
  assert.match(search, /deezer_track/);
  assert.doesNotMatch(read("src/lib/cover-api.ts"), /itunes\.apple\.com|ItunesSearchResponse/);
});

test("music administration paginates ten candidates without clearing search context", () => {
  const admin = read("src/components/domain/ArtAdmin.tsx");

  assert.match(admin, /const MUSIC_PAGE_SIZE = 10/);
  assert.match(admin, /const \[candidatePage, setCandidatePage\] = useState\(1\)/);
  assert.match(admin, /candidates\.slice\(candidatePageStart, candidatePageStart \+ MUSIC_PAGE_SIZE\)/);
  assert.match(admin, /setCandidates\(data\.items\); setCandidatePage\(1\)/);
  assert.match(admin, /changeType[\s\S]*setCandidatePage\(1\)/);
  assert.match(admin, /第 \{candidatePage\} \/ \{candidatePageCount\} 页/);
  assert.match(admin, /aria-label="上一页"/);
  assert.match(admin, /aria-label="下一页"/);
  assert.doesNotMatch(admin, /setCandidates\(\[\]\)[\s\S]{0,200}收藏已新增/);
});

test("album covers use square contain layers while non-music covers remain posters", () => {
  const admin = read("src/components/domain/ArtAdmin.tsx");
  const card = read("src/components/cards/ArtCard.astro");

  assert.match(admin, /function AlbumCover/);
  assert.match(admin, /aspect-square/);
  assert.match(admin, /aria-hidden="true"[\s\S]*object-cover[\s\S]*blur/);
  assert.match(admin, /object-contain/);
  assert.match(admin, /type === "music" \? <AlbumCover/);
  assert.match(admin, /type === "music" \? <AlbumCover[\s\S]*aspect-\[2\/3\]/);
  assert.match(card, /item\.type === "music"/);
  assert.match(card, /aspect-square/);
  assert.match(card, /aria-hidden="true"/);
  assert.match(card, /object-contain/);
  assert.match(card, /aspect-\[2\/3\][\s\S]*object-cover/);
});

test("public music collection has localized album and single tabs and hides single notes", () => {
  const section = read("src/components/sections/ArtSection.astro");
  const card = read("src/components/cards/ArtCard.astro");
  const messages = read("src/i18n/source.json");

  assert.match(section, /data-music-tab/);
  assert.match(section, /site\.copy\.musicAlbum/);
  assert.match(section, /site\.copy\.musicSingle/);
  assert.match(card, /item\.musicKind !== "single"/);
  assert.match(messages, /"musicAlbum": "专辑"/);
  assert.match(messages, /"musicSingle": "单曲"/);
});

test("art save operations expose independent progress and nearby live feedback", () => {
  const admin = read("src/components/domain/ArtAdmin.tsx");

  for (const state of ["isSearching", "isSaving", "isTranslating", "isLoadingItems", "isUploading"]) {
    assert.match(admin, new RegExp(`const \\[${state}, set`));
  }
  assert.match(admin, /const \[saveMessage, setSaveMessage\] = useState\(""\)/);
  assert.match(admin, /aria-live="polite"/);
  assert.match(admin, /已添加“\$\{savedTitle\}”/);
  assert.match(admin, /disabled=\{!canSave \|\| isSaving \|\| isTranslating \|\| isUploading\}/);
  assert.match(admin, /setItems\(\(current\) => \[data\.item,[\s\S]*item\.id !== data\.item\.id/);
});

test("only books and movies expose art translation controls or request translated drafts", () => {
  const admin = read("src/components/domain/ArtAdmin.tsx");
  const translateApi = read("functions/api/admin/art/translate.js");

  assert.match(admin, /const TRANSLATED_TYPES = new Set<ArtType>\(\["book", "movie"\]\)/);
  assert.match(admin, /TRANSLATED_TYPES\.has\(type\)[\s\S]*aria-label="翻译语言"/);
  assert.match(admin, /TRANSLATED_TYPES\.has\(type\)[\s\S]*生成翻译草稿/);
  assert.doesNotMatch(admin, /selectCandidate[\s\S]*if \(TRANSLATED_TYPES\.has\(type\)\) await translate/);
  assert.match(admin, /JSON\.stringify\(\{ type, \.\.\.source \}\)/);
  assert.match(admin, /translations: translationsForType\(form\.type, form\.translations\)/);
  assert.match(translateApi, /TRANSLATED_TYPES\.has\(type\)/);
});

test("dynamic art pages revalidate on every visit", () => {
  const routes = [
    "src/pages/art/book/index.astro",
    "src/pages/art/music/index.astro",
    "src/pages/art/screen/index.astro",
    "src/pages/art/game/index.astro",
    "src/pages/[locale]/art/[type]/index.astro",
  ];
  for (const route of routes) {
    assert.match(read(route), /Cache-Control", "public, max-age=0, s-maxage=0, must-revalidate"/);
    assert.doesNotMatch(read(route), /stale-while-revalidate/);
  }
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

test("the homepage renders a compact WakaTime label and native GitHub heatmap", () => {
  const home = read("src/components/sections/HomeSection.astro");
  const badge = read("src/pages/api/wakatime-badge.svg.ts");
  const heatmap = read("src/components/domain/GitHubHeatmap.astro");

  assert.equal((home.match(/\/api\/wakatime-badge\.svg/g) ?? []).length, 1);
  assert.match(home, /import GitHubHeatmap/);
  assert.match(home, /<GitHubHeatmap \/>/);
  assert.match(badge, /getCachedWakaTimeAllTime/);
  assert.match(badge, /width="240" height="28"/);
  assert.match(badge, /font-size="16"/);
  assert.match(badge, />Codetime .*<\/text>/);
  assert.doesNotMatch(badge, /<circle|<path|<rect/);
  assert.match(home, /html\.dark[^}]*codetime-badge[^}]*filter:\s*invert\(1\)/);
  assert.match(home, /profile-card__intro[\s\S]*profile-card__location[\s\S]*profile-metrics/);
  assert.match(heatmap, /\/api\/github-contributions\.json/);
  assert.match(heatmap, /data-github-grid/);
  assert.match(heatmap, /data-github-months/);
  assert.match(heatmap, /prefers-reduced-motion/);
  assert.doesNotMatch(home, /github-contribution-grid-snake/);
});

test("the homepage aligns latest content with the profile and lists projects last", () => {
  const home = read("src/components/sections/HomeSection.astro");

  assert.match(home, /getPublishedContent\("project", locale\)/);
  assert.match(home, /Latest Blogs[\s\S]*Latest Notes[\s\S]*Latest Projects/);
  assert.match(home, /\.home-shell\s*\{[^}]*align-items:\s*start;/s);
  assert.match(home, /\.latest-content\s*>\s*section:first-child\s*\{[^}]*padding-top:\s*0;/s);
  assert.match(home, /href=\{localizePath\(`\/\$\{block\.section\}\/`, locale\)\}/);
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
  assert.doesNotMatch(content, /View categories|category archive/);
});

test("About renders the profile as a normal Markdown article with the code-rain background", () => {
  const about = read("src/components/sections/AboutSection.astro");
  const background = read("src/components/site/RouteBackground.astro");
  assert.match(about, /render\(profile\)/);
  assert.match(about, /profile\.data\.city/);
  assert.doesNotMatch(about, /about-document__toc|href="#about-focus"/);
  assert.match(background, /path === "\/about\/"[\s\S]*\? "rain"/);
});

test("Project and every Life route use the dynamic constellation canvas", () => {
  const background = read("src/components/site/RouteBackground.astro");
  assert.match(background, /<canvas[\s\S]*data-background-kind="constellation"/);
  assert.match(background, /path === "\/project\/" \|\|[\s\S]*?path\.startsWith\("\/project\/"\)/);
  assert.match(background, /path === "\/art" \|\|[\s\S]*?path\.startsWith\("\/art\/"\)/);
  assert.match(background, /requestAnimationFrame\(tick\)/);
  assert.match(background, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(background, /route-background__constellation line|route-background__constellation circle/);
});

test("Project detail supports project and documentation links", () => {
  const detail = read("src/components/domain/ContentDetail.astro");
  assert.match(detail, /item\.projectUrl/);
  assert.match(detail, /item\.docUrl/);
});

test("writing detail pages keep interactions while moving the table of contents to the right", () => {
  const detail = read("src/components/domain/ContentDetail.astro");
  const toc = read("src/components/domain/TableOfContents.astro");

  assert.match(detail, /article-page__content[\s\S]*article-prose[\s\S]*article-page__toc/);
  assert.match(detail, /--article-title-size:\s*clamp\(1\.82rem,\s*1\.52rem \+ 0\.9vw,\s*2\.95rem\)/);
  assert.match(detail, /\.article-page__header h1[\s\S]*?font-size:\s*var\(--article-title-size\)/);
  assert.match(detail, /html:lang\(zh-CN\)[\s\S]*?--article-title-size:\s*clamp\(1\.56rem,\s*1\.36rem \+ 0\.6vw,\s*2\.28rem\)/);
  assert.doesNotMatch(detail, /<main class="article-page__main">/);
  assert.match(detail, /PostEngagement/);
  assert.match(detail, /CommentsSection/);
  assert.match(detail, /article-page__toc-mobile/);
  assert.match(detail, /data-scroll-top/);
  assert.match(toc, /data-toc-progress/);
  assert.match(toc, /data-toc-link/);
  assert.doesNotMatch(toc, /data-toc-expand|toc-children/);
});
