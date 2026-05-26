# Implementation Plan: Motion tab/page transitions

## Overview

Implement the Motion transition direction described in `SPEC.md` for the current Astro blog:

- Main navigation active indicator animation.
- Page enter/exit transition for top-level navigation.
- Blogs archive `Grid/List` switch animation.
- Reduced-motion support.

The current scope is animation and interaction polish only. Engagement features such as view counts, likes, Cloudflare D1, and Giscus comments are not part of this active plan.

## Assumptions

- Keep the existing Astro static output.
- Use the existing `motion` dependency.
- Do not add Astro View Transitions or another animation library.
- Preserve existing routes, content collections, and visible copy.
- Browser runtime verification is required for animation behavior.

## Architecture

```text
BaseLayout.astro
├─ PageTransition React island
├─ Header.astro
│  └─ NavMotionController React island
└─ page slot

Blogs archive
└─ ArchivePostsView.astro
   └─ ArchiveViewMotionController React island
```

## Task List

### Phase 1 — Main navigation motion

- [x] Add a Motion-backed active indicator for desktop and mobile navigation.
- [x] Keep `aria-current="page"` as the source of active route state.
- [x] Respect `prefers-reduced-motion`.

Verification:

- `npm run check`
- Browser verify `/` → `/blogs/` → `/projects/` → `/about/`

### Phase 2 — Page transition motion

- [x] Add page enter/exit transition for eligible top-level navigation links.
- [x] Preserve normal browser behavior for modifier-clicks, downloads, external links, and same-page hash links.
- [x] Respect `prefers-reduced-motion`.

Verification:

- `npm run check`
- `npm run build`
- Browser verify fast navigation does not leave the page dimmed or shifted.

### Phase 3 — Archive view switch motion

- [x] Add animated indicator for `Grid/List`.
- [x] Animate visible archive items after view or filter changes.
- [x] Preserve archive search, empty state, `aria-pressed`, and grid/list visibility behavior.

Verification:

- `npm run check`
- Browser verify search, empty state, and `Grid/List` switching on `/blogs/`.

### Phase 4 — Project detail route

- [x] Add static project detail pages for project cards/timeline links.
- [x] Keep external project links available through the existing `href` field.
- [x] Keep `/projects/` as the parent route and active navigation state.

Verification:

- `npm run check`
- `npm run build`
- Verify generated `/projects/<slug>/` pages.

### Phase 5 — Final verification

- [ ] Run project checks.
- [ ] Run production build.
- [ ] Browser verify desktop and mobile navigation.
- [ ] Browser verify reduced-motion behavior.

## Out of Scope

- Article views.
- Likes.
- Giscus comments.
- Cloudflare Pages Functions.
- Cloudflare D1.
- Authentication, analytics, or tracking.
