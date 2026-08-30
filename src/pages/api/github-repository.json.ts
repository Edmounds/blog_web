import type { APIRoute } from "astro";

import {
  getCachedGitHubRepo,
  parseGitHubRepoUrl,
  type GitHubRepoPayload,
} from "../../lib/github-repository";
import { getRuntimeEnv } from "../../lib/runtime";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const targetUrl = requestUrl.searchParams.get("url");

  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: "Missing required 'url' query parameter" }),
      {
        status: 400,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-content-type-options": "nosniff",
        },
      },
    );
  }

  const parsed = parseGitHubRepoUrl(targetUrl);
  if (!parsed) {
    return new Response(
      JSON.stringify({ error: "Invalid GitHub repository URL" }),
      {
        status: 400,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-content-type-options": "nosniff",
        },
      },
    );
  }

  const env = getRuntimeEnv();
  const cache = (caches as CacheStorage & { default?: Cache }).default;
  const token =
    typeof env.GITHUB_TOKEN === "string"
      ? env.GITHUB_TOKEN
      : import.meta.env.GITHUB_TOKEN;

  const repo = await getCachedGitHubRepo(parsed.owner, parsed.repo, {
    cache,
    token,
  });

  const payload: GitHubRepoPayload = repo
    ? { ...repo, state: "ready" }
    : {
        url: parsed.canonicalUrl,
        fullName: `${parsed.owner}/${parsed.repo}`,
        name: parsed.repo,
        description: null,
        stars: null,
        state: "fallback",
      };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "cache-control":
        payload.state === "ready"
          ? "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400"
          : "public, max-age=60, s-maxage=60",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
};
