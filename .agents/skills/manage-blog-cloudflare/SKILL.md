---
name: manage-blog-cloudflare
description: Use when inventorying, checking, debugging, deploying, or changing Cloudflare resources for this blog_web repository, including Workers, service bindings, D1, R2, Images, KV, Access, routes, cron triggers, secrets, Wrangler configs, and production connectivity.
---

# Manage Blog Cloudflare

Operate this repository's Cloudflare topology without rediscovering its bindings and deployment order.

## Start Here

1. Read `references/resources.md` for the current topology and last verified state.
2. Run the read-only check from the repository root:

```bash
node .agents/skills/manage-blog-cloudflare/scripts/check-cloudflare.mjs
```

The local shell currently exposes a restricted `CLOUDFLARE_API_TOKEN`. The check intentionally prefers Wrangler's local OAuth session. Set `BLOG_CF_USE_ENV_TOKEN=1` only when the environment token is known to have the required permissions, such as CI.

## Safety Rules

- Default to read-only inspection. Treat deploys, secret updates, D1 migrations, R2 writes/deletes, route changes, and Access changes as production mutations.
- Never print secret values. Listing secret names and types is acceptable.
- Use the repository's `node_modules/.bin/wrangler` or Wrangler module, not an unrelated global version.
- Do not deploy `wrangler.smoke.jsonc`; it exists only for local `getPlatformProxy` tests.
- Do not infer an outage from terminal HTTP `403` responses with `cf-mitigated: challenge`. Verify the site in a real browser.
- Follow the R2 source policy in `AGENTS.md`; do not duplicate stable domestic upstream assets into R2.

## Workflow

### Inventory Or Diagnose

1. Compare `wrangler.*.jsonc`, `dist/server/wrangler.json`, `src/env.d.ts`, `package.json`, and `.github/workflows/deploy.yml` with `references/resources.md`.
2. Run the bundled check and separate configuration, account permission, deployment, binding, and public-edge failures.
3. For browser verification, confirm:
   - `https://blog.muelsyse.us/` renders the homepage through `blog-preferred-proxy` and its `ORIGIN` service binding.
   - `https://blog.muelsyse.us/links/` loads `/api/friend-avatar` images with nonzero natural dimensions, covering `ART_COVER_FETCHER` and `IMAGES`.
   - `https://blog.muelsyse.us/admin/` redirects to the `blog-admin` Cloudflare Access login.
4. Update `references/resources.md` when the topology, bindings, domains, deployment order, or required secret names change.

### Change Or Deploy

1. Make the smallest config or code change that addresses the request.
2. Run `npm run check` and the relevant tests.
3. Run a Wrangler dry-run against the built `dist/server/wrangler.json` and each changed standalone Worker config.
4. Run `npm run build` only after checking whether the current image/content changes are intended to sync to R2; the build pipeline runs `images:sync`.
5. Deploy only with explicit production intent:
   - `npm run deploy` builds, deploys `blog-art-cover-fetcher`, then deploys `new-blog-ssr`.
   - Deploy `blog-preferred-proxy` separately only when its code or config changes.
   - Never let both application and proxy Workers claim `blog.muelsyse.us/*`.

For D1 migrations, inspect every SQL file first, verify it is safe to rerun, test locally, then run the remote migration only with explicit approval. For secret synchronization, compare names before running `npm run cf:secrets:sync`; that command updates production secrets.

