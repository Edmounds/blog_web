# Spec: Motion animation layer for Astro blog

## Objective

Add a restrained, polished Motion animation layer to the Astro blog/portfolio so the site feels more premium without distracting from reading or degrading performance.

Target users are readers, recruiters, and collaborators browsing the home page, blog archives, article pages, about page, and projects page. The animation style should be subtle, smooth, and high-quality: light fade/slide/scale motion, tasteful hover feedback, and consistent section reveals.

User-selected direction:
- Goal: higher-end visual quality.
- Scope: cover the full public site in the first version.
- Dependency: install and use the official `motion` package.
- Style: restrained and silky, not flashy.

Acceptance criteria:
- `motion` is installed and imported from `motion/react` where React animation islands are needed.
- Public routes remain intact: home, blog archive, category archive, blog detail, about, projects, header, and footer.
- Animations cover the main visible surfaces: page/section entry, hero content, blog/project cards, navigation/header micro-interactions, article content affordances, and footer presence.
- Animations respect `prefers-reduced-motion` and avoid excessive movement for users who request reduced motion.
- Existing interactions remain functional: navigation, theme toggle, archive search/filtering, and archive grid/list switching.
- Existing content sources, route names, and markdown content remain unchanged.
- Light and dark themes remain visually coherent.
- Final verification passes with `npm run check` and `npm run build`.

## Tech Stack

Current project:
- Astro 5 app with React integration via `@astrojs/react`.
- React 19 and React DOM 19.
- TypeScript.
- Tailwind CSS v4 via `src/styles/global.css`.
- shadcn-style components in `src/components/ui/*`.
- Existing CSS animation helper: `tw-animate-css`.

Planned animation dependency:
- `motion` from the official Motion project: `npm install motion`.
- React usage should import from `motion/react`, not `framer-motion`.

Preferred implementation approach:
- Keep Astro pages and content loading in Astro.
- Add React client islands only where Motion runtime behavior is required.
- Use CSS/Tailwind for simple static transitions when Motion would be unnecessary.
- Avoid converting entire pages to React just to animate them.

## Commands

Development:

```bash
npm run dev
```

Type and Astro validation:

```bash
npm run check
```

Production build:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

Install Motion during implementation:

```bash
npm install motion
```

Required verification before completion:

```bash
npm run check
npm run build
```

For UI verification, start the dev server and manually smoke test at least:
- `/`
- `/blogs`
- one `/blogs/category/[category]` page
- one `/blog/[slug]` page
- `/about`
- `/projects`

## Project Structure

Important existing source areas:
- `src/pages/index.astro` — home page.
- `src/pages/blogs/index.astro` — blog archive.
- `src/pages/blogs/category/[category].astro` — category archive.
- `src/pages/blog/[slug].astro` — blog detail.
- `src/pages/about/index.astro` — about page.
- `src/pages/projects/index.astro` — projects page.
- `src/layouts/BaseLayout.astro` — shared layout shell.
- `src/components/site/Header.astro` — top navigation.
- `src/components/site/Footer.astro` — footer.
- `src/components/site/ThemeToggle.astro` — theme switching.
- `src/components/cards/BlogCard.astro` — blog card surface.
- `src/components/cards/ProjectCard.astro` — project card surface.
- `src/components/domain/*` — archive, article metadata, content cards, timeline items.
- `src/components/sections/*` — hero and page section components.
- `src/components/foundation/*` — layout and surface primitives.
- `src/components/ui/*` — shadcn components.
- `src/styles/global.css` — Tailwind v4 global styles and theme tokens.

Likely new or changed areas:
- `src/components/animation/*` — small React animation wrappers or primitives, if useful across multiple pages.
- Existing Astro components may receive lightweight wrapper classes, client islands, or local transition attributes.
- Existing React component files may be extended only if they already own interactive UI.

Do not create broad animation infrastructure unless repeated usage proves it is needed. A few focused primitives are preferred over a large abstraction layer.

## Code Style

Animation code should be explicit, small, and easy to remove or tune. Prefer named variants only when reused across multiple components.

Example style for a reusable Motion island:

```tsx
import { motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"

interface RevealProps {
  children: ReactNode
  delay?: number
}

export function Reveal({ children, delay = 0 }: RevealProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  )
}
```

Conventions:
- Import Motion from `motion/react`.
- Prefer opacity, transform, and scale animations over layout-affecting properties.
- Keep durations short: usually 0.2s–0.6s.
- Use subtle easing and spring settings; avoid bouncy or playful defaults unless explicitly requested.
- Respect reduced motion in reusable Motion components.
- Use semantic Tailwind tokens and existing shadcn styling conventions.
- Do not add comments unless the reason is non-obvious.
- Do not rewrite static Astro components into React unless runtime animation requires it.

## Testing Strategy

Required automated checks:
- `npm run check` for Astro/TypeScript validation.
- `npm run build` for production build and encoding verification.

Required manual UI smoke checks after implementation:
- Confirm page load and navigation work on the home page, blog archive, category archive, blog detail, about page, and projects page.
- Confirm theme toggle still works in light and dark modes.
- Confirm archive search/filtering and grid/list switching still work.
- Confirm animations do not create obvious layout shifts or block reading.
- Confirm reduced-motion behavior by checking `prefers-reduced-motion` in the browser if feasible.

Test level guidance:
- Use manual browser verification for animation feel, hover states, scroll reveals, and reduced-motion behavior.
- Use TypeScript/build checks for integration correctness.
- Add automated tests only if implementation introduces non-trivial animation logic or reusable utilities with behavior worth asserting.

## Boundaries

Always do:
- Preserve public routes and content collections.
- Preserve markdown content unless the user explicitly asks for copy changes.
- Preserve light/dark theme behavior.
- Prefer minimal React islands over converting full Astro pages to React.
- Respect `prefers-reduced-motion` for Motion-powered animations.
- Keep animations subtle, polished, and performance-conscious.
- Run `npm run check` and `npm run build` before claiming completion.

Ask first:
- Adding dependencies beyond the official `motion` package.
- Changing route names, URL structure, content schema, or markdown content.
- Introducing large visual effects such as particle systems, WebGL, heavy cursor effects, audio, or remote assets.
- Replacing shadcn components, changing the design system, or undoing the existing redesign.
- Removing existing sections or interactions.

Never do:
- Import from `framer-motion` for new code.
- Animate layout-affecting dimensions broadly if transform/opacity can achieve the effect.
- Add animations that interfere with reading, navigation, or accessibility.
- Hide check/build failures.
- Commit, push, amend, reset, or run destructive git commands without explicit request.
- Add analytics, tracking, external services, or remote assets.

## Success Criteria

This work is complete when:
- The full public site has a coherent, restrained animation system.
- Motion-powered animations are present on appropriate high-impact areas without over-animating content.
- Reduced-motion users receive static or minimal-motion behavior.
- Existing content, routing, theme switching, archive filtering, and navigation continue to work.
- The implementation avoids broad framework rewrites and keeps changes localized.
- `npm run check` passes.
- `npm run build` passes.
- Manual browser smoke testing has been performed or any inability to perform it is reported clearly.

## Open Questions

- Should the first implementation prioritize reusable animation primitives first, or apply page-specific animations directly and extract primitives only after repetition appears?
- Should article content receive scroll reveal animations for individual blocks, or should article pages stay more static to protect reading flow?
- Should hover animations be applied to all card-like surfaces, or only primary blog/project cards?
