# Cloudflare Resource Inventory

Last live verification: 2026-08-08 (Asia/Shanghai). Refresh volatile counts with `scripts/check-cloudflare.mjs`.

## Topology

```text
blog.muelsyse.us
  -> Cloudflare zone controls / managed challenge / Access
  -> blog-preferred-proxy (custom route)
  -> ORIGIN service binding
  -> new-blog-ssr
       -> DB: blog_web (D1)
       -> ART_COVERS: blog-images (R2)
       -> ART_COVER_FETCHER: blog-art-cover-fetcher (service binding)
       -> IMAGES (Cloudflare Images binding)
       -> ASSETS (Workers Static Assets)
       -> SESSION (Astro-generated KV binding)

img.muelsyse.us
  -> blog-images R2 custom domain
```

## Resource Counts

| Category | Count | Resources |
| --- | ---: | --- |
| Worker configs | 4 | 3 production Workers, 1 local smoke config |
| Deployed Workers | 3 | `new-blog-ssr`, `blog-art-cover-fetcher`, `blog-preferred-proxy` |
| D1 databases | 1 | `blog_web` |
| R2 buckets | 1 | `blog-images` |
| KV namespaces used by the app | 1 | `new-blog-ssr-session`, generated as `SESSION` by Astro |
| Worker service bindings | 2 | `ART_COVER_FETCHER`, `ORIGIN` |
| Platform bindings | 2 | `IMAGES`, `ASSETS` |
| Cron triggers | 1 | `0 20 * * *` on `new-blog-ssr` (04:00 China Standard Time) |
| Production Worker routes | 1 | `blog.muelsyse.us/*` on `blog-preferred-proxy` |
| R2 custom domains | 1 | `img.muelsyse.us`, TLS active, minimum TLS 1.2 |
| Access applications observed | 1 | `blog-admin` protecting `/admin/`; repository policy also requires `/api/admin/*` |
| Worker secrets | 18 | Names listed below; values must never be printed |

`new-blog-smoke` is not deployed and must remain local-only. The account also contains an unrelated KV namespace named `link`; it is not referenced by this application.

## Production Workers

| Worker | Config/source | Live state verified on 2026-08-08 |
| --- | --- | --- |
| `new-blog-ssr` | `wrangler.astro.jsonc`, deployed from `dist/server/wrangler.json` | Version 89, deployment 100%, fetch + scheduled handlers |
| `blog-art-cover-fetcher` | `wrangler.art-cover-fetcher.jsonc` | Version 53, deployment 100%, fetch handler |
| `blog-preferred-proxy` | `wrangler.preferred-proxy.jsonc` | Version 14, deployment 100%, fetch handler |
| `new-blog-smoke` | `wrangler.smoke.jsonc` | Local `getPlatformProxy` fixture; absent from the account by design |

The generated Astro deployment adds `SESSION` even though it is not declared directly in `wrangler.astro.jsonc`. Inspect `dist/server/wrangler.json` after each build when auditing bindings.

## Live Storage Snapshot

| Resource | Snapshot |
| --- | --- |
| D1 `blog_web` | 13 tables, 266,240 bytes, primary region WNAM; read-only `SELECT 1` succeeded |
| R2 `blog-images` | 79 objects, 8.66 MB, APAC, Standard storage |
| R2 public access | `img.muelsyse.us` active; `r2.dev` disabled; representative object returned `200 image/webp` |

The D1 and R2 counts are volatile. Do not treat this snapshot as a quota or invariant.

The NetEase session migration (`schema/netease_music.sql`) was applied remotely on 2026-08-13, adding `netease_auth_state` and bringing D1 to 13 tables.

## Secret Names

The deployed `new-blog-ssr` Worker has these 18 secret names:

```text
API_KEY
CF_ACCESS_AUD
CF_ACCESS_TEAM_DOMAIN
COMMENT_HASH_SALT
DEEPLX_API_KEY
DEEPLX_BASE_URL
GOOGLE_BOOKS_API_KEY
MODEL
NETEASE_COOKIE_KEY
NETEASE_CSRF
NETEASE_MUSIC_U
OPENAI_BASE_URL
OPENAI_IMAGE_API_KEY
OPENAI_IMAGE_BASE_URL
SERVICE_TYPE
STEAM_API_KEY
TMDB_API_KEY
WAKA_TIME_API_KEY
```

`GITHUB_TOKEN` is optional in `src/env.d.ts` and was not present during the snapshot. The DEEPLX, OpenAI image, and `SERVICE_TYPE` secrets are deployed but are not declared in the current runtime type; do not remove them without confirming they are obsolete outside this repository.

`NETEASE_COOKIE_KEY` was configured on 2026-08-13 as a random 64-character hex value (also stored in the local `.env`); never print or commit it. `NETEASE_MUSIC_U` and `NETEASE_CSRF` become optional bootstrap secrets after the first successful encrypted session save.

## Verified Connectivity

- Wrangler OAuth authentication and required Workers, KV, D1, and R2 permissions: passed.
- All three production Worker deployment lookups: passed.
- Main Astro artifact, preferred proxy, and cover fetcher dry-runs: passed.
- D1 remote read: passed with zero rows written.
- R2 metadata, custom domain, and representative object read: passed.
- Browser homepage through proxy and `ORIGIN`: passed.
- Browser friend-avatar path through `ART_COVER_FETCHER` and `IMAGES`: passed, 640 x 640 WebP output observed.
- Cloudflare Access redirect: passed; unauthenticated browser reached the `blog-admin` login.
- Terminal requests to `blog.muelsyse.us`: managed challenge observed. This is an edge security response, not an origin failure.

## Known Authentication Detail

The shell-provided `CLOUDFLARE_API_TOKEN` can identify the account and read R2, but returned Cloudflare error `10000` for Workers deployment reads and was unreliable for D1. Wrangler's stored OAuth session has the necessary permissions. Local checks therefore remove `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the child environment by default; CI should opt back into its environment token with `BLOG_CF_USE_ENV_TOKEN=1`.

This workstation's route to the Cloudflare API intermittently returned Wrangler `fetch failed` while adjacent requests succeeded. The bundled check retries read-only API calls twice and still fails closed when all attempts fail. Treat repeated failures as connectivity or API incidents; treat a single recovered retry as transient network noise.
