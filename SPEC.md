# Spec: shadcn-style site redesign

## Objective

Redesign the entire Astro blog/portfolio site so the visible UI clearly uses a shadcn-style component language rather than the current custom editorial styling.

Target users are readers, recruiters, and collaborators browsing the portfolio, writing archive, blog posts, about page, and projects page. The site should feel like a polished shadcn-based personal site with consistent cards, buttons, badges, separators, and light/dark theme support.

Acceptance criteria:
- All public pages are covered: home, blog archive, category archive, blog detail, about, projects, header, and footer.
- The UI supports switching between light and dark modes.
- Existing routes and content sources remain intact.
- Content and section order may be rearranged to better fit the shadcn design language.
- Existing key interactions remain functional: navigation, theme toggle, archive search/filtering, and archive grid/list switching.
- Custom `ui-*` styling and heavy `!` overrides are reduced where practical in favor of shadcn tokens and variants.

## Commands

Use these project commands:

```bash
npm run check
npm run build
npm run dev
npm run preview
```

Verification required before completion:
- `npm run check`
- `npm run build`

The user selected code-level verification as the required acceptance gate. Browser visual testing is optional unless requested later.

## Project Structure

Important source areas:
- `src/pages/index.astro` — home page
- `src/pages/blogs/index.astro` — blog archive
- `src/pages/blogs/category/[category].astro` — category archive
- `src/pages/blog/[slug].astro` — blog detail
- `src/pages/about/index.astro` — about page
- `src/pages/projects/index.astro` — projects page
- `src/layouts/BaseLayout.astro` — shared page layout
- `src/components/site/Header.astro` — top navigation
- `src/components/site/Footer.astro` — footer
- `src/components/site/ThemeToggle.astro` — light/dark switching
- `src/components/foundation/*` — local wrappers around layout and primitives
- `src/components/domain/*` — archive/cards/meta/timeline domain components
- `src/components/sections/*` — page sections
- `src/components/ui/*` — shadcn components currently installed: badge, button, card, separator
- `src/styles/global.css` — Tailwind v4 global styles and theme tokens

Likely additional shadcn components may be needed via CLI, such as navigation-menu, sheet, tabs, input, avatar, breadcrumb, tooltip, or toggle-group. Add only components that are actually used.

## Code Style

- Prefer shadcn primitives and semantic tokens: `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card`, `text-card-foreground`, `bg-muted`, `text-primary`.
- Avoid raw custom color variables in new UI unless needed for theme tokens.
- Avoid broad `!` Tailwind overrides; centralize unavoidable overrides in local wrappers.
- Keep Astro components semantic: repeated content cards should remain `article` where appropriate.
- Use project wrappers when they provide a stable boundary, but do not create abstractions for one-off use.
- Keep routes, data loading, and content models stable unless a section rearrangement requires local view-model changes.
- Do not add comments unless they explain a non-obvious constraint.
- Do not commit unless explicitly asked.

## Testing Strategy

Required:
- Run `npm run check` after implementation slices that touch Astro/TypeScript structure.
- Run `npm run build` before reporting completion.

Recommended for this redesign:
- Verify archive search and grid/list logic still compiles and is unchanged or intentionally adapted.
- Check generated pages count and encoding check output from `npm run build`.
- If browser verification is later requested, smoke test `/`, `/blogs`, `/about`, `/projects`, and one blog detail page.

## Boundaries

Always do:
- Preserve public routes.
- Preserve content collection sources and existing markdown content unless the user explicitly asks to rewrite copy.
- Preserve theme toggle behavior and make light/dark mode visually coherent.
- Keep changes focused on the shadcn visual redesign.
- Run required verification before completion claims.

Ask first about:
- Installing substantial new dependencies beyond shadcn component requirements.
- Changing content schema, route names, or URL structure.
- Removing existing pages or major content sections.
- Introducing animations or visual effects that materially change performance or accessibility.

Never do without explicit request:
- Commit, push, amend, reset, or force git operations.
- Delete user content.
- Replace the project framework or routing architecture.
- Add analytics, tracking, external services, or remote assets.
- Hide build/check failures or claim visual completion without verification evidence.
