# Todo: Motion tab/page transitions

## Phase 1 — Main navigation

- [x] Implement Motion active indicator for main navigation.
  - Acceptance: indicator follows the active nav item and hover/focus preview returns to the active item.
  - Verification: `npm run check`; browser verify top-level navigation.

- [x] Support desktop and mobile navigation switchers.
  - Acceptance: both switchers initialize from `aria-current="page"`.
  - Verification: browser verify desktop and mobile widths.

- [x] Respect reduced motion.
  - Acceptance: movement animation is skipped when `prefers-reduced-motion: reduce` is active.
  - Verification: browser or DevTools reduced-motion check.

## Phase 2 — Page transitions

- [x] Add page enter/exit transition for eligible navigation links.
  - Acceptance: top-level navigation fades/slides the main content without changing routes or content.
  - Verification: browser verify `/`, `/blogs/`, `/projects/`, and `/about/`.

- [x] Preserve normal link behavior.
  - Acceptance: external links, download links, modifier-clicks, and same-page hash links are not intercepted.
  - Verification: code review plus browser spot check.

## Phase 3 — Blogs archive switcher

- [x] Animate the `Grid/List` switch indicator.
  - Acceptance: `aria-pressed` remains correct and indicator follows the selected view.
  - Verification: browser verify `/blogs/`.

- [x] Animate archive item reveal after view/filter changes.
  - Acceptance: visible items animate without breaking search or empty state.
  - Verification: browser verify search query with results and no-results state.

## Phase 4 — Project detail pages

- [x] Generate `/projects/[slug]/` pages from the projects collection.
  - Acceptance: every project entry generates a detail page.
  - Verification: `npm run build`.

- [x] Route project cards and timeline items to detail pages when no external `href` exists.
  - Acceptance: cards/timeline entries no longer dead-end at `/projects/`.
  - Verification: generated pages and link review.

## Final checks

- [ ] `npm run check`
- [ ] `npm run build`
- [ ] Browser verify navigation animation.
- [ ] Browser verify archive grid/list animation.
- [ ] Browser verify reduced-motion behavior.
