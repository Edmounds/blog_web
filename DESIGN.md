# Astro-star Design Specification

## 1. Status and Scope

This document is the canonical design contract for the visual migration of this blog. It defines the intended appearance and responsive behavior; it does not change runtime APIs, routes, content schemas, component props, localization, comments, or navigation behavior.

The reference baseline is the checked-in `Astro-star/` source at version `0.16.25`. Values marked **Reference** are taken directly from that source. Values marked **Adaptation** translate the reference language to this project's existing top-navigation and localized SPA architecture. The source code, CSS tokens, components, layouts, and checked-in screenshots are authoritative; screenshots alone are not the source of truth.

The migration should reproduce Astro-star's visual language, not its personal identity, signature, content, original left-side navigation shell, or route inventory.

## 2. Design Direction

The site is a high-contrast, monochrome personal publishing system. Its defining qualities are:

- White and true-black canvases, not tinted page backgrounds.
- Near-black or near-white foregrounds with translucency used for hierarchy.
- Fine rules, sparse borders, minimal shadows, and very limited rounded surfaces.
- Large outlined display headings paired with calm, readable body copy.
- Biotif typography with explicit Chinese system-font fallbacks.
- Generous desktop whitespace and restrained interface chrome.
- Route-specific atmospheric backgrounds that remain subordinate to content.
- Motion that explains navigation or state changes rather than decorating idle surfaces.

Content must remain the strongest signal. Backgrounds, borders, controls, and transitions should establish atmosphere and orientation without competing with titles, article text, artwork, or comments.

## 3. Foundations

### 3.1 Color System

#### Core tokens

| Token | Light theme | Dark theme | Status | Purpose |
| --- | --- | --- | --- | --- |
| `--canvas` | `#ffffff` | `#000000` | Reference | Root page canvas |
| `--foreground` | `#111111` | `#f5f5f5` | Reference | Primary text, icons, strong rules |
| `--foreground-soft` | `rgba(17, 17, 17, 0.88)` | `rgba(245, 245, 245, 0.90)` | Reference | Secondary icons and high-emphasis metadata |
| `--text-muted` | `color-mix(in srgb, var(--foreground) 68%, transparent)` | Same formula | Reference | Metadata, descriptions, inactive navigation |
| `--text-faint` | `color-mix(in srgb, var(--foreground) 46%, transparent)` | Same formula | Adaptation from reference hierarchy | Labels and tertiary detail |
| `--border-soft` | `color-mix(in srgb, var(--foreground) 14%, transparent)` | Same formula | Reference | Hairlines and quiet separators |
| `--border-strong` | `color-mix(in srgb, var(--foreground) 24%, transparent)` | Same formula | Adaptation | Inputs and selected boundaries |
| `--surface-soft` | `color-mix(in srgb, var(--canvas) 95.5%, var(--foreground) 4.5%)` | Same formula | Adaptation from reference hover surfaces | Quiet panels and hover fills |
| `--surface-panel` | `color-mix(in srgb, var(--canvas) 94%, transparent)` | Same formula | Adaptation | Translucent menus and mobile overlays |
| `--focus-ring` | `color-mix(in srgb, var(--foreground) 30%, transparent)` | Same formula | Reference pattern | Default focus outline |
| `--selection-bg` | `color-mix(in srgb, var(--foreground) 16%, transparent)` | Same formula | Adaptation | Text selection |

`--accent` must resolve to `--foreground`. Interactive emphasis is created by contrast, opacity, underline, line weight, or motion. Do not introduce a decorative brand hue for links, active navigation, focus, buttons, charts, or badges.

#### Mixing conventions

- Use `color-mix(in srgb, var(--foreground) <percentage>, transparent)` for text, rules, and icon hierarchy.
- Use `color-mix(in srgb, var(--canvas) <percentage>, var(--foreground) <percentage>)` for opaque surfaces that must cover animated backgrounds.
- Keep common strength levels consistent: `68%` muted text, `58%` secondary links, `24%` strong borders, `14%` soft borders, and `4.5%` quiet fills.
- A hover state should normally move one hierarchy step toward `--foreground`; it should not switch hue.
- A selected control may invert to `background: var(--foreground)` and `color: var(--canvas)` when a stronger state is required.

#### Theme behavior

- The root canvas changes between `#ffffff` and `#000000`; components inherit from semantic tokens.
- Theme selection continues to use this project's existing light/dark control and persistence behavior.
- Theme changes must update `color-scheme`, page background, navigation surfaces, icons, code blocks, form fields, and route backgrounds together.
- No component should hard-code a light-only panel behind dark-theme content.
- `meta[name="theme-color"]` should follow the resolved canvas.

### 3.2 Typography

#### Font files and weights

The primary family is `Biotif`. The checked-in reference contains these exact files:

| File | Weight | Style |
| --- | --- | --- |
| `/fonts/Biotif-Regular.woff2` | `400` | Normal |
| `/fonts/Biotif-Medium.woff2` | `500` | Normal |
| `/fonts/Biotif-SemiBold.woff2` | `600` | Normal |
| `/fonts/Biotif-Bold.woff2` | `700` | Normal |

The required UI and content stack is:

```css
font-family: "Biotif", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
```

Use `font-display: swap` for all four `@font-face` declarations. Do not synthesize italic files that do not exist; metadata may use `font-style: italic` with the regular face. Code and tabular dates use a system monospace stack and `font-variant-numeric: tabular-nums`.

#### Reference scale

```css
--type-xs: clamp(12.5px, 0.62rem + 0.08vw, 15px);
--type-sm: clamp(14px, 0.72rem + 0.1vw, 17px);
--type-base: clamp(15.5px, 0.78rem + 0.12vw, 19px);
--type-md: clamp(17px, 0.9rem + 0.14vw, 21px);
--type-lg: clamp(20px, 1.05rem + 0.2vw, 26px);
--type-xl: clamp(26px, 1.35rem + 0.32vw, 36px);
--type-2xl: clamp(31px, 1.55rem + 0.42vw, 44px);
--type-content-body: clamp(17px, 15px + 0.18vw, 20px);
--type-content-body-zh: clamp(16.8px, 14.9px + 0.18vw, 19.5px);
--type-content-code: clamp(13.8px, 12.6px + 0.08vw, 15.8px);
--type-content-caption: clamp(14px, 13px + 0.08vw, 16.2px);
```

#### Role mapping

| Role | Specification | Status |
| --- | --- | --- |
| Outlined page title | `clamp(2rem, 1.8rem + 1vw, 3.5rem)`, `500`, line-height `1.1`, transparent fill, `1.15px` foreground stroke | Reference |
| Article title, Latin | `clamp(1.82rem, 1.52rem + 0.9vw, 2.95rem)`, `400`, line-height `1.05`, transparent fill, `1px` stroke | Reference |
| Article title, Chinese | `clamp(1.56rem, 1.36rem + 0.6vw, 2.28rem)`, `400`, line-height `1.05`, transparent fill, `1px` stroke | Reference |
| Article `h1` | `--type-2xl`, `600`, line-height `1.18` | Reference |
| Article `h2` | `--type-xl`, `600`, line-height `1.24` | Reference |
| Article `h3` | `1.38rem`, `550`, line-height `1.3` | Reference |
| Article `h4` | `1.2rem`, `550`, line-height `1.32` | Reference |
| Body copy | `--type-content-body`, `400`, line-height `1.78` | Reference |
| Chinese body copy | `--type-content-body-zh`, `400`, line-height `1.78` | Reference |
| Lead or summary | `--type-md`, `400`, line-height `1.65` to `1.75`, muted | Adaptation |
| Metadata | `--type-sm`, `400`, line-height `1.25`, italic where date/status prose is grouped | Reference |
| Caption | `--type-content-caption`, `400`, line-height `1.55`, muted | Reference |
| Navigation label | `--type-sm`, `500`, line-height `1.2` | Adaptation for the existing top navigation |
| Code | `--type-content-code`, `400`, line-height `1.55`, monospace | Reference |
| TOC title | `1.12rem`, `400`, line-height `1.15` | Reference |
| TOC depth 1-6 | `0.96rem`, `0.88rem`, `0.82rem`, `0.77rem`, `0.73rem`, `0.70rem` | Reference |
| Mobile TOC title | `0.96rem`, `400`, line-height `1.2` | Reference |

Letter spacing is `0` unless tabular or technical content needs `0.01em`. Do not apply viewport-based font scaling outside the documented `clamp()` tokens. Long translated labels must wrap or truncate deliberately; they must never overlap controls.

Outlined text is reserved for page-level titles, article titles, archive year displays, and similarly important landmarks. Ordinary section headings and card titles use filled foreground text. Under forced colors, all outlined text becomes solid `CanvasText` with no stroke.

### 3.3 Spacing, Width, and Shape

#### Layout tokens

```css
--shell-max: min(92vw, 112.5rem);
--space: clamp(0.1rem, 0.2vw, 1.25rem);
--header-main-gap: clamp(1.25rem, 1.4vw, 2.75rem);
--content-padding: clamp(0.85rem, 1.8vw, 1.4rem);
--section-gap: clamp(2.5rem, 5vw, 5rem);
--content-measure: 46rem;
--radius-control: 0.5rem;
--radius-panel: 1rem;
```

`--shell-max`, `--space`, `--header-main-gap`, and `--content-padding` are direct reference values. `--section-gap` and `--content-measure` are project adaptations.

- Use large empty regions instead of filling the page with containers.
- Align related content to a small number of stable vertical axes.
- Use `1px` rules for separation before adding a panel boundary.
- Repeated content cards should use `0.5rem` radius or less.
- Reserve the `1rem` reference radius for a single transient surface such as the mobile TOC; do not apply it to every section.
- Shadows are normally `none`. A restrained shadow is allowed only when a translucent floating menu or mobile overlay needs separation from moving content beneath it.

### 3.4 Icons and Controls

- Keep the project's Lucide icon usage for navigation, theme, language, comments, and utility actions.
- Standard icon-only controls are at least `2.5rem` square; touch controls are at least `44px` square.
- Icons use `--foreground-soft` at rest and `--foreground` on hover, focus, or active state.
- Controls use transparent or `--surface-soft` backgrounds with fine borders. Avoid filled capsules unless the state requires inversion.
- Every unfamiliar icon has an accessible name and a visible tooltip on hover/focus where the surrounding context does not explain it.
- Focus uses a `2px` outline with at least `3px` offset. Focus must never rely on color alone.

## 4. Layout and Navigation

### 4.1 Navigation Exception

Preserving this project's navigation structure and interaction model is normative.

- Keep the current top header, route switcher, dropdown navigation, theme control, language control, and mobile horizontal navigation.
- Keep localized route generation and active-route matching.
- Keep the existing home/blog/about SPA track, swipe navigation, trackpad navigation, browser history behavior, and Astro page transitions.
- Do not replace the header with Astro-star's signature block, hamburger-led left navigation, or desktop side-navigation column.
- Restyle the existing navigation with Biotif, monochrome semantic tokens, hairlines, restrained icon buttons, and quiet translucent surfaces.

Desktop navigation should read as a thin utility layer rather than a floating pill collection. The active route is indicated by foreground text plus a fine underline, outline, or low-contrast surface. The moving route indicator may remain, but it must lose decorative shadow and use monochrome contrast.

On mobile, preserve the horizontally scrollable navigation row. It must expose the active item, maintain scroll access to every route, and keep language/theme controls fixed at the row edge. Avoid clipping focus rings or dropdowns inside the scroll container.

### 4.2 Page Composition

Astro-star's desktop reference uses a three-region grid with proportions `0.5fr / 2.5fr / 3.5fr` and a `56.25rem` breakpoint. This project should adapt the spacious multi-region idea without recreating the left navigation shell.

- Marketing-style hero layouts are not part of this system. The first viewport should be the actual publishing experience.
- Home uses broad, unframed regions for profile/context and recent content.
- Blog indexes use a title/header region, optional controls, and a full archive/list region.
- Article pages retain the current table-of-contents/content composition. On wide screens, use a narrow sticky TOC, a readable article column, and intentional breathing space rather than stretching prose across the viewport.
- About uses a primary narrative column plus restrained supporting regions; it should not become a dashboard of nested panels.
- Art routes may use a denser visual grid because images are the content, while labels and controls remain monochrome.

The article reading measure should normally remain between `40rem` and `46rem`. Supporting side regions may make the overall shell much wider, but prose line length must stay readable.

### 4.3 Page Transitions

- Retain the current directional page and SPA transitions.
- Prefer opacity and short positional movement; avoid blur-heavy transitions, scaling the entire page, or ornamental wipes.
- Route background changes must not flash the wrong theme or expose an intermediate tinted canvas.
- Under `prefers-reduced-motion: reduce`, route changes should complete without sliding tracks, staggered entrances, falling particles, or expanding theme reveals.

## 5. Route Backgrounds

Backgrounds are fixed, non-interactive, `aria-hidden`, and placed behind all content. Their contrast must remain lower than muted text.

### 5.1 Home and Default: Sparse Snow or Particle Field

Use the Astro-star snow field as the default atmosphere for the homepage and routes without a more specific background.

Reference characteristics:

- `44` sparse elements distributed across near, middle, and far layers.
- Light canvas `#ffffff`; dark canvas `#000000`.
- Light particle base `#7d7d7d` mixed at `38%`; dark base `#ffffff` mixed at `26%`.
- Approximate sizes `8px` to `19px`.
- Falling durations from `16s` to `44s`, with slow drift and rotation.
- No pointer events and no content reflow.

For this project, the shapes may be simplified to neutral dots or abstract snow marks if the original snowflake assets are not adopted. The field must remain sparse and must not become a bokeh, orb, or confetti treatment.

### 5.2 Blog Indexes and Articles: Document Grid

Use the reference document background for blog archives, blog detail pages, series pages, and other long-form reading routes.

Light reference values:

```css
--paper: #fafafa;
--grid: rgba(18, 18, 18, 0.095);
--grid-major: rgba(18, 18, 18, 0.16);
--margin-line: rgba(18, 18, 18, 0.22);
--edge: rgba(18, 18, 18, 0.11);
--grid-size: 24px;
--grid-major-size: 120px;
```

Dark reference values:

```css
--paper: #030303;
--grid: rgba(245, 245, 245, 0.07);
--grid-major: rgba(245, 245, 245, 0.125);
--margin-line: rgba(245, 245, 245, 0.16);
--edge: rgba(245, 245, 245, 0.12);
```

The grid uses layered one-pixel CSS lines as a technical pattern, not a decorative color gradient. On screens `48rem` and narrower, reduce the grid to `20px` with `100px` major divisions and reduce or remove paper-edge details. The article surface itself should remain transparent enough for the grid to establish context without reducing text contrast.

### 5.3 About: Monochrome Code Rain

Use code rain only on the about route, where it reinforces the personal technical narrative.

Reference characteristics:

- `60` keyword drops.
- `12px` to `22px` monospace text.
- `14s` to `34s` vertical travel.
- Base opacity `0.03` to `0.08`; rare bright drops use `0.14`.
- Black text on white and white text on black.
- No glow, neon color, or simulated terminal-green palette.

The keyword list should come from existing site/about content rather than invented slogans. Hide moving drops under reduced motion; retain only the plain canvas or a very sparse static keyword field.

### 5.4 Constellation: Contextual Use Only

Constellation lines and nodes are not a global decoration. They may be used on an existing art collection route when the connected-node metaphor supports the displayed collection. Do not use the treatment on home, blog, article, about, comments, administration, or every art detail page.

Use monochrome nodes and `1px` lines at low opacity. The canvas remains white or black. Under reduced motion, freeze the composition; under forced colors, remove it.

### 5.5 Accessibility Alternatives

- Under `prefers-reduced-motion: reduce`, remove continuous falling/raining animation and freeze or simplify canvas motion.
- Under `forced-colors: active`, remove all atmospheric layers, background images, shadows, and decorative pseudo-elements.
- Forced-colors pages use `Canvas`, `CanvasText`, `LinkText`, `GrayText`, `ButtonText`, `ButtonBorder`, and `Highlight` system colors.
- Background removal must not erase structural borders, focus visibility, current-route state, or content hierarchy.

## 6. Component Specifications

### 6.1 Article Lists and Archive Timelines

- Prefer open lists separated by whitespace and hairlines, not a wall of cards.
- Group entries by year. Year headings use `--type-lg`, weight `600`, with a soft bottom rule; large timeline years may use outlined text.
- Desktop rows use a date column of at least `5.6rem` and a flexible title column with `0.9rem` gap.
- Dates use `--type-sm`, muted color, monospace tabular numerals.
- Titles use foreground text and a single-line ellipsis only where the row must remain compact.
- Hover/focus may translate content by `0.14rem` and reveal a fine arrow. Do not change to an accent hue.
- Below `40rem`, stack date above title and allow the title to wrap.

### 6.2 Content Cards

- Use cards only for repeated visual items such as art entries, media entries, or genuinely framed resources.
- Default card: transparent or `--surface-soft`, `1px` soft border, radius no greater than `0.5rem`, no decorative shadow.
- Images reveal the actual content, use a stable aspect ratio, and avoid unnecessary dark overlays.
- Text remains outside the image when inspection matters. Metadata is muted; the title is foreground.
- Hover uses a small border-strength or `translateY(-0.08rem)` change. Image zoom must stay at or below approximately `1.025`.
- Do not nest a card inside another card.

### 6.3 Article Header

- Use the outlined article title scale defined above.
- Place summary and metadata directly beneath the title with a compact vertical rhythm.
- Separate the header from prose with a `1px` line mixed at `16%` foreground.
- Summary uses approximately `78%` foreground and line-height `1.75`.
- Metadata uses `--type-sm`; labels may use `46%` foreground and values `88%` foreground at weight `500`.
- Category, date, reading time, engagement, and localization metadata remain content, not colorful badges.

### 6.4 Prose

- Body color is full foreground in light mode and may use `78%` foreground in dark mode to reduce glare.
- Paragraph and list line-height is `1.78`; Chinese copy uses the Chinese body token.
- Use filled headings inside articles. Outlining is for the page/article title, not every heading.
- Strong text uses weight `600` without changing hue.
- Links use foreground at `84%`, weight `600`, and may show a small external arrow. Hover moves to full foreground.
- Images are centered, responsive, and constrained by context. Default content-image radius is `clamp(0.75rem, 0.6rem + 0.5vw, 1rem)` only when the image itself benefits from rounding; diagrams and screenshots may remain square.
- Captions use the caption token and muted foreground.
- Horizontal rules are `1px` soft lines with generous vertical space.

### 6.5 Code Blocks

- Use the reference code size and `1.55` line-height.
- Padding is `clamp(10px, 9.5px + 0.2vw, 12px)` vertically and `clamp(12px, 11px + 0.45vw, 16px)` horizontally.
- Radius is `clamp(12px, 11px + 0.35vw, 16px)` for standalone code blocks; inline code uses a much smaller radius.
- Backgrounds are monochrome quiet surfaces with a `1px` soft border.
- Preserve syntax color when supplied by the renderer, but do not add a site-wide decorative accent around code.
- Long lines scroll horizontally. Copy controls are icon buttons with accessible labels and stable dimensions.

### 6.6 Blockquotes

- Use a `1px` or `2px` foreground-derived left rule, transparent background, and comfortable inline padding.
- Text is foreground or muted foreground; no colored callout stripe for ordinary quotations.
- Reserve semantic colors only for content-authored warning/error meaning, not general brand decoration.

### 6.7 Tables

- Wrap tables in horizontal overflow rather than shrinking text below the type scale.
- Cells use `1px` borders mixed at approximately `12%` foreground.
- Header cells use a `6%` foreground-mixed surface, weight `600`, and no decorative fill.
- Align text to the document direction and use tabular numerals for numeric columns.

### 6.8 Table of Contents

- Desktop TOC is sticky at the article top offset and constrained to the viewport height.
- Use the documented depth scale, `0.65rem` vertical gaps, and progressive indentation in `0.8rem` steps.
- Inactive links use `58%` foreground; active, hover, and focus links use full foreground.
- A `2px` vertical track at `10%` foreground and thumb at `72%` may indicate reading position.
- At widths below the desktop breakpoint, hide the desktop rail and expose the existing mobile TOC control.
- The mobile panel may use the reserved `1rem` radius, a soft border, a translucent canvas surface, and one restrained elevation shadow.

### 6.9 Comments

- Keep the existing comment API, pagination, moderation, and form behavior unchanged.
- Begin comments with a top hairline and an outlined or filled section title appropriate to its hierarchy.
- Inputs use the canvas, `1px` strong borders, at least `44px` height, and a monochrome `2px` focus ring.
- The submit action may invert foreground/canvas for a strong state; it must not use an arbitrary accent color.
- Comment entries are open rows separated by soft lines, not individual cards.
- Names use weight `600`; timestamps and regions use faint text; body copy uses muted text with readable line-height.
- Loading, empty, error, and disabled states remain visibly distinct through text, opacity, border, and icon changes.

### 6.10 Footer

- Use a full-width top hairline and transparent canvas.
- Metadata uses `--type-xs` and `--foreground-soft`.
- Center content on mobile; align metadata left and utility icons right on desktop where space permits.
- Footer icon buttons remain transparent and move only subtly on hover/focus.
- Do not use a contrasting filled footer band.

### 6.11 Theme and Language Controls

- Preserve the current controls and menus.
- Triggers are icon buttons with stable `2.5rem` to `2.75rem` dimensions.
- Menus use a canvas-derived surface, `1px` border, compact `0.5rem` radius, and no decorative shadow unless required for overlap separation.
- The current language uses foreground text plus a check icon; inactive languages use muted text.
- Theme state is represented by the icon and accessible label, not by a colored fill.

## 7. Responsive Behavior

### 7.1 Desktop: `>= 56.25rem`

- Use the wide shell and multi-region composition.
- Keep the top header compact and sticky.
- Show desktop navigation and desktop article TOC.
- Preserve wide whitespace around the readable article column.
- Archive dates and titles share a row; visual card collections may use multiple columns.
- Footer metadata and utility icons may occupy opposite ends of the same line.

### 7.2 Tablet: `48rem` to `56.249rem`

- Collapse multi-region layouts to one primary content column plus optional inline supporting regions.
- Keep the existing horizontal navigation behavior when the desktop navigation no longer fits.
- Place TOC access in a floating or inline control instead of reserving a permanent rail.
- Reduce background detail and route-animation density.
- Keep article measure near `40rem`; do not stretch prose to the full tablet width.

### 7.3 Mobile: `< 48rem`

- Use a single content column with at least `1rem` side padding and safe-area awareness.
- Preserve the two-row mobile header and horizontal route scrolling.
- Keep all touch targets at least `44px` in both dimensions.
- Allow page and article titles to wrap; reduce them through the documented `clamp()` minimums, not ad hoc viewport formulas.
- Stack archive metadata above titles below `40rem`.
- Make tables and code blocks horizontally scrollable with momentum scrolling.
- Use one- or two-column visual grids only when the longest localized labels fit.
- Simplify paper edges, holes, constellation density, and particles. Remove nonessential animated layers on small or constrained devices.

## 8. Motion

- State transitions generally use `180ms` to `260ms` ease timing.
- Page entrances may use approximately `680ms` opacity and `760ms` positional easing when motion is allowed.
- Hover movement stays between `0.08rem` and `0.18rem`.
- Avoid continuous animation except the route-specific atmospheric backgrounds.
- Never animate layout dimensions in a way that shifts surrounding controls unexpectedly.
- `prefers-reduced-motion: reduce` removes transforms, stagger, continuous animation, smooth scrolling, and theme reveal effects while retaining immediate state changes.

## 9. Accessibility and Resilience

- Maintain WCAG-readable contrast for primary and muted text in both themes.
- Do not encode active route, theme, language, validation, or comment status by color alone.
- Preserve visible keyboard focus for links, buttons, menus, inputs, TOC entries, and scrollable navigation.
- Outlined headings must become solid text in forced colors.
- Decorative canvases and particles are hidden from assistive technology and never intercept pointer events.
- Content remains usable with JavaScript disabled: navigation, localized links, articles, and basic forms must retain sensible document structure.
- Stable widths, aspect ratios, and control sizes prevent labels, icons, and loading states from shifting the layout.

## 10. Design Rules

### Required

- Use true white and true black as the main canvases.
- Use Biotif with the documented Chinese fallbacks.
- Use semantic monochrome tokens and `color-mix()` for hierarchy.
- Use outlined text only for major display landmarks.
- Use generous whitespace, readable measures, and fine rules.
- Use route backgrounds intentionally and provide reduced-motion and forced-colors alternatives.
- Preserve current routes, localization, comments, navigation, and SPA behavior.

### Prohibited

- No decorative color gradients. The document grid's one-pixel CSS line layers are the only technical exception.
- No arbitrary accent colors or one-hue tinted palette.
- No decorative drop shadows on static page sections, cards, navigation indicators, or images.
- No excessive nested cards or page sections styled as floating cards.
- No oversized rounding, repeated pills, or capsule-shaped text containers where a line, icon, or open layout works.
- No universal constellation, particle, or code-rain layer across every route.
- No glow, glassmorphism-heavy chrome, bokeh blobs, gradient orbs, or ornamental blur.
- No oversized marketing hero that delays access to the actual site content.
- No change to information architecture merely to imitate the reference layout.

## 11. Implementation Mapping

This section identifies where a later visual migration should apply the contract. It is a mapping, not a request for unrelated refactoring.

| Specification area | Existing project location | Expected later change |
| --- | --- | --- |
| Theme, color, type, radius, spacing | `src/styles/global.css` | Replace current visual tokens with the semantic monochrome system and add reference type tokens |
| Font loading | `src/layouts/BaseLayout.astro`, `public/anthropic-fonts.css` | Add Biotif `@font-face` rules/preloads and point the site stack to Biotif plus Chinese fallbacks |
| Static font assets | `public/fonts/` | Add the four checked-in reference WOFF2 files when the visual migration begins |
| Root theme application | `src/layouts/BaseLayout.astro`, `src/lib/theme.ts` | Keep existing persistence while synchronizing canvas, `color-scheme`, and theme-color metadata |
| Header and route controls | `src/components/site/Header.astro`, `NavSwitcher.astro`, `NavMotionController.tsx` | Preserve structure and behavior; restyle typography, active state, surfaces, borders, and motion |
| Theme and language controls | `ThemeToggle.astro`, `LanguageSelector.astro` | Convert to monochrome icon-button and menu treatments without behavior changes |
| SPA transitions | `src/layouts/SpaLayout.astro`, `src/layouts/BaseLayout.astro` | Retain routing gestures and history; align timing and reduced-motion behavior |
| Homepage | `src/components/sections/HomeSection.astro`, `HomeHero.astro` | Replace the current visual treatment with spacious unframed profile and recent-content regions |
| Blog index | `src/components/sections/BlogsSection.astro`, `src/components/domain/ArchivePostsView.astro` | Apply outlined title, open archive rows/timeline, document background, and responsive collapse |
| Archive cards and rows | `ContentCard.astro`, `ArchiveGrid.astro`, `ArchiveList.astro`, `ArchiveToolbar.astro` | Remove accent-driven states and decorative card styling; use monochrome rules and restrained surfaces |
| Article layout | `src/pages/blog/[slug].astro`, `src/pages/[locale]/blog/[slug].astro` | Apply the outlined header, readable measure, multi-region composition, and document background |
| Article prose | `.ui-prose` in `src/styles/global.css` | Implement the reference body, heading, code, quote, table, image, and link rules |
| Table of contents | `src/components/domain/TableOfContents.tsx` | Replace the rounded card treatment with the reference rail and responsive mobile panel |
| Comments | `src/components/domain/CommentsSection.tsx` | Preserve API behavior; apply open rows, monochrome form states, and hairline separators |
| About | `src/components/sections/AboutSection.astro` and related sections | Apply code-rain atmosphere and reduce nested panel composition |
| Art | `src/components/sections/ArtSection.astro`, `src/components/cards/ArtCard.astro` | Keep artwork primary; use restrained monochrome controls and optional contextual constellation background |
| Footer | `src/components/site/Footer.astro` | Replace the filled band with an open canvas, top hairline, compact metadata, and icon controls |

The later implementation should make the smallest changes needed in these existing ownership boundaries. It should not change content collection schemas, route names, localization files, comment contracts, or component public interfaces unless a separate requirement explicitly calls for it.

## 12. Acceptance Criteria for the Visual Migration

A future implementation conforms to this specification when:

- Light and dark themes use the documented foreground and canvas values.
- All four Biotif weights load from the documented files and Chinese text uses the required fallbacks.
- Page titles, article titles, body copy, metadata, captions, code, and TOC text follow the documented scale.
- The existing header, localized routes, mobile horizontal navigation, theme/language controls, comments, and SPA navigation still behave as before.
- Home, blog/article, about, and contextual art backgrounds follow their assigned families and accessibility fallbacks.
- Article lists, archives, cards, prose, code, tables, TOC, comments, and footer use the specified monochrome treatment.
- Desktop, tablet, and mobile layouts satisfy the documented collapse, measure, target-size, and overflow rules.
- No prohibited gradient, shadow, accent, nested-card, excessive-radius, or universal-background pattern is introduced.
