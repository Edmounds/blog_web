# Repository Guidelines

## Project Structure & Module Organization

This is an Astro content site with React islands and Tailwind styling.

- `src/pages/` contains route files, including blog and note detail routes.
- `src/components/` is grouped by role: `site/`, `sections/`, `cards/`, `domain/`, `links/`, and `ui/`. Do not add new empty grouping folders; create a folder only together with its first component.
- `src/content/` holds Astro Content Collections: `blog/`, `note/`, `about/`, and `site/`.
- `src/lib/` contains shared routing, content, theme, utility, and view-model helpers.
- `src/styles/global.css` defines global styles and design tokens.
- `public/images/` stores content images; `public/favicon.*` and font CSS are static assets.
- `tests/` contains `node --test` suites; `scripts/` contains build and content tooling.

## Build, Test, and Development Commands

- `npm install`: install project dependencies from `package-lock.json`.
- `npm run dev`: start the Astro development server.
- `npm run check`: run Astro and TypeScript checks.
- `npm test`: run the `node --test` suites in `tests/`.
- `npm run check:encoding`: verify Markdown encoding rules.
- `npm run build`: run encoding checks, then create the production build in `dist/`.
- `npm run preview`: preview the built site locally.

## Coding Style & Naming Conventions

Use 2-space indentation, LF line endings, and UTF-8 without requiring a BOM.

Prefer Astro components for static markup and React `.tsx` components only where client-side interaction or animation is needed. Keep shared UI primitives in `src/components/ui/`; keep site-specific composition outside that folder. Use PascalCase for component files, camelCase for functions and variables, and kebab-case for content slugs.

## Testing Guidelines

Tests use the built-in Node test runner (`npm test`, files in `tests/*.test.mjs`). Treat `npm test`, `npm run check`, and `npm run build` as the required verification path for code changes. For content-only edits, run `npm run check:encoding`; run `npm run build` when route structure, frontmatter schema, images, or rendering behavior changes.

Rules for writing tests:

- Tests must exercise behavior: import the module under test (or call the running app) and assert on its output or side effects.
- Never write source-snapshot tests that `readFileSync` a source file and regex-match implementation details (constant values, CSS class names, selector strings, "this string must/must not appear"). They break on every refactor and catch no real regressions. Such tests were removed once already; do not reintroduce them.
- If something cannot be tested through behavior (for example a pure markup tweak), leave it untested and verify with `npm run check`/`npm run build` instead of pinning source text.
- Do not add a new test file per task or fix; extend the existing suite for that domain, and delete tests when the behavior they cover is removed.

## Commit & Pull Request Guidelines

Recent history uses short imperative commit subjects, sometimes with a scope such as `feat(ui): add shadcn redesign baseline`. Keep commits focused on one change and use clear verbs, for example `Animate homepage surfaces` or `Update content image paths`.

Pull requests should include a concise summary, changed areas, verification commands run, and screenshots or recordings for visible UI changes.

## Worktree Isolation

- Before editing the project, use the `using-git-worktrees` skill to create an isolated worktree.
- Each agent must use its own worktree and branch. Never allow multiple agents to edit files in the same worktree.
- Prefer the project-local `.worktrees/` directory and verify that Git ignores it before creating a worktree.
- Run the project checks in the worktree before integrating its changes.
- Unless the user explicitly asks to leave work unmerged, finish completed worktree tasks by committing the worktree branch and merging it into the repository's default branch.
- Resolve merge conflicts without discarding unrelated user changes, rerun the required checks on the integrated default branch, then remove the completed worktree and delete its merged branch.
- If the default worktree has uncommitted changes that make integration unsafe, preserve them and ask the user how to proceed instead of overwriting or stashing them without permission.

## Security & Configuration

Runtime environment variables are not currently required. Do not commit local secrets or machine-specific configuration. Keep generated build output in `dist/` out of source edits unless a deployment workflow explicitly requires it.

## Static Asset Source Policy

- Prefer a stable official or upstream HTTPS asset hosted in mainland China when one is available. Serve that URL directly; do not copy the same asset to Cloudflare R2 only for delivery.
- NetEase Cloud Music covers must use `p*.music.126.net` and be normalized to `https://p1.music.126.net/...`. Douban book covers may use verified `https://*.doubanio.com/...` URLs.
- Use R2 for user uploads, assets owned by this site, sources that cannot be reached reliably from mainland China, or assets without a suitable domestic upstream.
- If a domestic upstream is stable but rejects browser-origin requests through anti-hotlink rules, use a stateless cached proxy to that upstream instead of storing a duplicate in R2.
- If a domestic upstream image fails, use the local placeholder rather than an R2 duplicate of that image.
- When moving an existing asset from R2 to a domestic upstream, verify the upstream URL first and delete the unreferenced R2 copy only after the cutover succeeds.
