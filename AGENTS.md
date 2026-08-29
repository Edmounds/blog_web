# Repository Guidelines

## Project Overview & Architecture
An Astro 7 content site (migrated from Astro-star 0.16.25) with React 19 islands, Tailwind v4, and Cloudflare Workers SSR.

- `src/pages/`: Route files (blog, note, life, links, about, admin).
- `src/components/`: Grouped by role (`site/`, `sections/`, `cards/`, `domain/`, `links/`, `ui/`).
- `src/content/`: Content collections (`blog/`, `note/`, `about/`, `site/`).
- `src/lib/`: Shared helpers for routing, i18n, content, theme, and view models.
- `src/server/`: Worker server logic; `workers/`: standalone Cloudflare Workers.
- `tests/`: `node --test` suites; `scripts/`: build, content, and deployment tooling.

## Commands & Verification
- `npm run dev`: Start Astro dev server (predev runs `content:prepare` and `images:sync`).
- `npm run check`: Astro and TypeScript type-checks (`astro check`).
- `npm test`: Run behavior-based unit tests (`node --test tests/*.test.mjs`).
- `npm run check:encoding`: Verify Markdown UTF-8 encoding.
- `npm run check:content-ids`: Verify published content IDs and `src/lib/post-slugs.ts`.
- `npm run build`: Production build with encoding/bundle checks and prerendering.

## Coding & Testing Conventions
- 2-space indentation, LF endings, UTF-8 without BOM.
- Prefer Astro components for markup; React `.tsx` only for interactive/animated islands.
- UI primitives go to `src/components/ui/`; site compositions stay outside.
- Slugs use lowercase kebab-case (`YYYYMMDD-NN` format for dated posts).
- Tests must assert behavior (inputs/outputs/effects), never regex source code strings. Extend existing domain suites instead of creating disposable test files.

## Worktrees & Git Workflow
- Use isolated worktrees for feature work (`.worktrees/` is gitignored).
- Run checks in the worktree before merging into default branch (`master`).
- If default branch has uncommitted changes, do not overwrite without user confirmation.

## Static Asset & Cloudflare Policy
- Prefer stable official/domestic HTTPS upstream assets (e.g. NetEase `p*.music.126.net`, Douban `*.doubanio.com`); do not duplicate stable domestic assets into R2.
- Use Cloudflare R2 (`blog-images`) for user uploads, owned assets, or sources unreachable in mainland China.
- Never commit secrets or log secret values. Local `.env` syncs via `npm run cf:secrets:sync`.
