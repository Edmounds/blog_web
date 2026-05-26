# Repository Guidelines

## Project Structure & Module Organization

This is an Astro content site with React islands and Tailwind styling.

- `src/pages/` contains route files, including blog and project detail routes.
- `src/components/` is grouped by role: `site/`, `sections/`, `cards/`, `domain/`, `foundation/`, `animation/`, and `ui/`.
- `src/content/` holds Astro Content Collections: `blog/`, `projects/`, `about/`, and `site/`.
- `src/lib/` contains shared routing, content, theme, utility, and view-model helpers.
- `src/styles/global.css` defines global styles and design tokens.
- `public/images/` stores content images; `public/favicon.*` and font CSS are static assets.
- `docs/`, `spec/`, and `tasks/` contain planning and design notes.

## Build, Test, and Development Commands

- `npm install`: install project dependencies from `package-lock.json`.
- `npm run dev`: start the Astro development server.
- `npm run check`: run Astro and TypeScript checks.
- `npm run check:encoding`: verify Markdown encoding rules.
- `npm run build`: run encoding checks, then create the production build in `dist/`.
- `npm run preview`: preview the built site locally.

## Coding Style & Naming Conventions

Use 2-space indentation, LF line endings, and UTF-8. Markdown files that contain Chinese text should keep UTF-8 BOM, matching `.editorconfig` and `scripts/check-encoding.mjs`.

Prefer Astro components for static markup and React `.tsx` components only where client-side interaction or animation is needed. Keep shared UI primitives in `src/components/ui/`; keep site-specific composition outside that folder. Use PascalCase for component files, camelCase for functions and variables, and kebab-case for content slugs.

## Testing Guidelines

There is no dedicated unit-test framework configured. Treat `npm run check` and `npm run build` as the required verification path for code changes. For content-only edits, run `npm run check:encoding`; run `npm run build` when route structure, frontmatter schema, images, or rendering behavior changes.

## Commit & Pull Request Guidelines

Recent history uses short imperative commit subjects, sometimes with a scope such as `feat(ui): add shadcn redesign baseline`. Keep commits focused on one change and use clear verbs, for example `Animate homepage surfaces` or `Update content image paths`.

Pull requests should include a concise summary, changed areas, verification commands run, and screenshots or recordings for visible UI changes. Reference related task or spec files when the work comes from `tasks/` or `spec/`.

## Security & Configuration

Runtime environment variables are not currently required. Do not commit local secrets or machine-specific configuration. Keep generated build output in `dist/` out of source edits unless a deployment workflow explicitly requires it.
