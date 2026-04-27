# Todo: shadcn-style site redesign

## Phase 1 — shell and theme baseline

- [x] Redesign global theme tokens in `src/styles/global.css`.
  - Acceptance: light and dark themes use shadcn semantic tokens coherently.
  - Verify: `npm run check`.

- [ ] Redesign shared site shell in `BaseLayout.astro`, `Header.astro`, `Footer.astro`, and `ThemeToggle.astro`.
  - Acceptance: header/footer/theme toggle visibly match shadcn style; navigation and theme switching remain functional.
  - Verify: `npm run check`.

- [ ] Update foundation wrappers (`SurfacePanel`, `PillTag`, `Divider`, `PageContainer` if needed) to provide stable shadcn-style primitives.
  - Acceptance: wrappers reduce repeated `!` overrides and expose a consistent local boundary.
  - Verify: `npm run check`.

## Phase 2 — home page vertical slice

- [ ] Redesign `HomeHero.astro` and home page layout in `src/pages/index.astro`.
  - Acceptance: hero and layout clearly use shadcn-style cards/spacing/tokens; current home content remains present.
  - Verify: `npm run check`.

- [ ] Redesign `SectionHeading.astro` and `ContentCard.astro` for the home blog/project sections.
  - Acceptance: cards are semantic, shadcn-styled, theme-aware, and preserve links/images/tags.
  - Verify: `npm run check`.

## Phase 3 — blog archive and category archive

- [ ] Redesign `ArchiveSidebar.astro`.
  - Acceptance: filters/counts use shadcn-style card/list/badge treatment and preserve active states/links.
  - Verify: `npm run check`.

- [ ] Redesign `ArchivePostsView.astro`.
  - Acceptance: search input, grid/list controls, empty state, grid cards, and list rows use shadcn style; search and toggle behavior remain intact.
  - Verify: `npm run check`.

- [ ] Adapt `src/pages/blogs/index.astro` and `src/pages/blogs/category/[category].astro` around the redesigned archive components.
  - Acceptance: both archive routes share the new visual language without route/content changes.
  - Verify: `npm run check`.

## Phase 4 — blog detail page

- [ ] Redesign article header and metadata in `src/pages/blog/[slug].astro` and `ArticleMeta.astro`.
  - Acceptance: title, summary, category, date, reading time render in shadcn-style layout.
  - Verify: `npm run check`.

- [ ] Redesign TOC, related topics, prose, and next-article CTA.
  - Acceptance: markdown content remains readable; TOC and next link continue working; styling fits light/dark shadcn theme.
  - Verify: `npm run check`.

## Phase 5 — about and projects pages

- [ ] Redesign `AboutHero.astro`, story section, and `AboutFocusGrid.astro`.
  - Acceptance: about page uses shadcn cards/badges/spacing and keeps existing profile content.
  - Verify: `npm run check`.

- [ ] Redesign `ExperienceList.astro`.
  - Acceptance: experience items use shadcn-style list/card structure and preserve all job content.
  - Verify: `npm run check`.

- [ ] Redesign `src/pages/projects/index.astro` and `TimelineItem.astro`.
  - Acceptance: projects page uses shadcn-style project cards/timeline treatment and preserves links/images/CTA labels.
  - Verify: `npm run check`.

## Phase 6 — cleanup and final verification

- [ ] Remove obsolete custom CSS/classes only when grep confirms they are unused.
  - Acceptance: no deleted class is still referenced.
  - Verify: `npm run check`.

- [ ] Reduce remaining broad `!` overrides where practical.
  - Acceptance: overrides are centralized or justified by local wrappers.
  - Verify: `npm run check`.

- [ ] Run final verification.
  - Acceptance: `npm run check` passes with 0 errors/warnings/hints; `npm run build` passes and builds all pages.
  - Verify: `npm run check` and `npm run build`.
