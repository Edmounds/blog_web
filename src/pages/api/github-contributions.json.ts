import type { APIRoute } from "astro";

import {
  createGitHubContributionHeatmapSkeleton,
  getCachedGitHubContributionHeatmap,
} from "../../lib/github-contributions";
import { getRuntimeEnv } from "../../lib/runtime";

const USERNAME = "Edmounds";

export const prerender = false;
export const GET: APIRoute = async () => {
  const env = getRuntimeEnv();
  const cache = (caches as CacheStorage & { default?: Cache }).default;
  const heatmap = await getCachedGitHubContributionHeatmap(USERNAME, {
    cache,
    token: typeof env.GITHUB_TOKEN === "string" ? env.GITHUB_TOKEN : import.meta.env.GITHUB_TOKEN,
  });

  return new Response(JSON.stringify({
    ...(heatmap ?? createGitHubContributionHeatmapSkeleton()),
    state: heatmap ? "ready" : "fallback",
  }), {
    headers: {
      "cache-control": heatmap
        ? "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400"
        : "public, max-age=60, s-maxage=60",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
};
