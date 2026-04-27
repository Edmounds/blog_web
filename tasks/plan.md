# Plan: shadcn-style site redesign

## Goal

Implement the `SPEC.md` redesign so the whole site visibly uses a shadcn-style UI language with coherent light/dark themes, while preserving routes, content sources, and existing key interactions.

Required verification gates:
- `npm run check`
- `npm run build`

Browser visual testing is optional unless requested later.

## Current dependency graph

```text
BaseLayout.astro
├─ src/styles/global.css
├─ Header.astro
│  ├─ ThemeToggle.astro
│  └─ routes/nav data
├─ page slot
└─ Footer.astro

Home: src/pages/index.astro
├─ HomeHero.astro
├─ SectionHeading.astro
├─ Divider.astro
└─ ContentCard.astro
   ├─ PillTag.astro
   └─ CardContent (shadcn)

Blogs archive: src/pages/blogs/index.astro
├─ ArchiveSidebar.astro
├─ ArchivePostsView.astro
│  ├─ ContentCard.astro
│  └─ Button (shadcn)
└─ view-model/content utilities

Category archive: src/pages/blogs/category/[category].astro
└─ likely shares content card/archive list patterns

Blog detail: src/pages/blog/[slug].astro
├─ ArticleMeta.astro
├─ SurfacePanel.astro
├─ PillTag.astro
└─ markdown content rendered through .ui-prose

About: src/pages/about/index.astro
├─ AboutHero.astro
├─ AboutFocusGrid.astro
│  ├─ SurfacePanel.astro
│  └─ PillTag.astro
└─ ExperienceList.astro

Projects: src/pages/projects/index.astro
└─ TimelineItem.astro

Foundation wrappers:
├─ PageContainer.astro
├─ SurfacePanel.astro
├─ PillTag.astro
└─ Divider.astro

Installed shadcn primitives:
├─ badge.tsx
├─ button.tsx
├─ card.tsx
└─ separator.tsx
```

## Implementation strategy

Work vertically by user-visible paths instead of doing all foundations first. Each phase should leave at least one route coherent and compilable. Shared primitives may be adjusted inside a slice only when that slice needs them.

Use shadcn semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`, `bg-muted`, `text-primary`) and reduce custom `ui-*` styling where practical. Keep semantic Astro roots such as `article` for repeated cards.

## Phase checkpoints

### Checkpoint 1 — shell and theme baseline

Scope:
- `src/styles/global.css`
- `src/layouts/BaseLayout.astro`
- `src/components/site/Header.astro`
- `src/components/site/Footer.astro`
- `src/components/site/ThemeToggle.astro`
- foundation wrappers as needed

Objective:
- Establish a clear shadcn-style global theme for light and dark modes.
- Replace custom editorial chrome with shadcn-like header/footer/button/card styling.
- Keep theme toggle behavior intact.

Acceptance criteria:
- Header and footer visibly use shadcn tokens and clean borders/backgrounds.
- Light and dark tokens are coherent.
- Theme toggle still switches `html.dark` / `html.light` and ARIA state.
- No route/content changes.

Verification:
- `npm run check`

### Checkpoint 2 — home vertical slice

Scope:
- `src/pages/index.astro`
- `src/components/sections/HomeHero.astro`
- `src/components/site/SectionHeading.astro`
- `src/components/domain/ContentCard.astro`
- `src/components/foundation/*` as needed

Objective:
- Redesign the home page as the reference shadcn look: hero, recent blogs, recent projects.
- Use Card/Badge/Button/Separator visual language clearly.

Acceptance criteria:
- Home page no longer depends on custom editorial layout as the primary visual style.
- Cards look like shadcn cards in both themes.
- Existing home content and links remain present.
- Repeated card roots remain semantic where appropriate.

Verification:
- `npm run check`

### Checkpoint 3 — blog archive and category archive

Scope:
- `src/pages/blogs/index.astro`
- `src/pages/blogs/category/[category].astro`
- `src/components/domain/ArchiveSidebar.astro`
- `src/components/domain/ArchivePostsView.astro`
- `src/components/domain/ContentCard.astro` only if needed

Objective:
- Redesign archive pages around shadcn-style controls, cards, badges, and list rows.
- Preserve search, empty state, and grid/list toggle behavior.

Acceptance criteria:
- Archive filter/sidebar uses shadcn-style navigation/list/card patterns.
- Search input and grid/list controls look like shadcn controls.
- Grid/list toggle still updates visibility and `aria-pressed`.
- Search still hides/shows matching items and empty state.
- Category archive remains route-compatible.

Verification:
- `npm run check`

### Checkpoint 4 — blog detail vertical slice

Scope:
- `src/pages/blog/[slug].astro`
- `src/components/domain/ArticleMeta.astro`
- `src/styles/global.css` prose styles
- `SurfacePanel`, `PillTag`, `Divider` as needed

Objective:
- Redesign article detail with shadcn-style article header, metadata card, table-of-contents card, related topics, prose, and next article CTA.

Acceptance criteria:
- Blog detail page uses shadcn-like card/sidebar/prose styling in both themes.
- Markdown rendering remains intact.
- TOC links and next article link remain functional.
- Existing content source/rendering remains unchanged.

Verification:
- `npm run check`

### Checkpoint 5 — about and projects vertical slices

Scope:
- `src/pages/about/index.astro`
- `src/components/sections/AboutHero.astro`
- `src/components/sections/AboutFocusGrid.astro`
- `src/components/sections/ExperienceList.astro`
- `src/pages/projects/index.astro`
- `src/components/domain/TimelineItem.astro`

Objective:
- Redesign about and projects pages with shadcn cards, badges, separators, and clean responsive layouts.

Acceptance criteria:
- About hero, story, focus cards, and experience list align visually with the new system.
- Projects page no longer relies on the old editorial timeline as the dominant style unless adapted into a shadcn-like timeline/card layout.
- Existing content and links remain present.

Verification:
- `npm run check`

### Checkpoint 6 — cleanup and final verification

Scope:
- `src/styles/global.css`
- all touched components/pages
- optional removal of unused demo/component imports only when proven unused

Objective:
- Remove obsolete `ui-*` classes only when no longer used.
- Reduce remaining `!` overrides where practical.
- Confirm all pages build.

Acceptance criteria:
- `npm run check` passes.
- `npm run build` passes, including encoding check and static page generation.
- No broken imports or unused implementation leftovers from the redesign.
- No route changes.

Verification:
- `npm run check`
- `npm run build`

## Risks and constraints

- Adding many shadcn components may increase scope; install only components used by an accepted slice.
- Replacing custom prose/timeline styles too aggressively may harm readability; preserve semantics and content hierarchy.
- The current site uses custom `--text-*` and `--bg-*` variables; migration should favor shadcn tokens without breaking existing components mid-slice.
- `.claude/` is currently untracked; do not include it unless explicitly requested.
- Do not commit or push without explicit request.
