/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

interface ImportMetaEnv {
  readonly GITHUB_TOKEN?: string;
  readonly WAKA_TIME_API_KEY?: string;
}

declare namespace Cloudflare {
  interface Env {
    [key: string]: unknown;
    DB: D1Database;
    ART_COVERS: R2Bucket;
    ART_COVER_FETCHER?: Fetcher;
    IMAGES?: ImagesBinding;
    GOOGLE_BOOKS_API_KEY?: string;
    TMDB_API_KEY?: string;
    STEAM_API_KEY?: string;
    NETEASE_MUSIC_U?: string;
    NETEASE_CSRF?: string;
    NETEASE_COOKIE_KEY?: string;
    OPENAI_BASE_URL?: string;
    API_KEY?: string;
    MODEL?: string;
    GITHUB_TOKEN?: string;
    WAKA_TIME_API_KEY?: string;
    COMMENT_HASH_SALT?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
  }
}

declare namespace App {
  interface Locals {
    runtime: { env: Cloudflare.Env; cf?: IncomingRequestCfProperties; ctx?: ExecutionContext };
    cfContext?: ExecutionContext;
  }
}
