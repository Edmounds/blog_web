# UI System Draft

## Goal
Single style pipeline based on `Tailwind (Vite) + src/styles/global.css`, with reusable components for all core pages.

## Design Tokens
Defined in `src/styles/global.css`:
- Color: `--bg-*`, `--text-*`, `--border-*`, `--accent`, `--accent-soft`
- Radius: `--radius-sm`, `--radius-md`, `--radius-lg`
- Elevation: `--shadow-soft`
- Theme: `html.dark` and `html.light`

## Public Type Contracts
Defined in `src/types/ui.ts`:
- `NavItem`, `FooterLink`, `SectionCta`
- `CardMeta`, `ContentCardModel`, `CardVariant`
- `ArchiveFilterModel`, `TimelineItemModel`, `ArticleMetaModel`
- `AboutMetaItem`, `AboutFocusCard`, `ExperienceItem`

## Component Layers

### Foundation
- `src/components/foundation/PageContainer.astro`
- `src/components/foundation/SurfacePanel.astro`
- `src/components/foundation/Divider.astro`
- `src/components/foundation/PillTag.astro`

### Site
- `src/components/site/Header.astro`
- `src/components/site/Footer.astro`
- `src/components/site/ThemeToggle.astro`
- `src/components/site/SectionHeading.astro`

### Domain
- `src/components/domain/ContentCard.astro`
- `src/components/domain/TimelineItem.astro`
- `src/components/domain/ArchiveSidebar.astro`
- `src/components/domain/ArticleMeta.astro`

### Page Sections
- `src/components/sections/HomeHero.astro`
- `src/components/sections/AboutHero.astro`
- `src/components/sections/AboutFocusGrid.astro`
- `src/components/sections/ExperienceList.astro`

## View-model Adapter
`src/lib/view-models.ts` keeps page data source details away from UI components:
- `toBlogCardModel`
- `toProjectCardModel`
- `toArchiveFilters`
- `toTimelineItemModel`
- `toArticleMetaItems`

## Page Composition
Core pages now use `BaseLayout` and compose sections/components only:
- `src/pages/index.astro`
- `src/pages/blogs/index.astro`
- `src/pages/blog/[slug].astro`
- `src/pages/projects/index.astro`
- `src/pages/about/index.astro`
