import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchGitHubRepo,
  getCachedGitHubRepo,
  parseGitHubRepoUrl,
} from "../src/lib/github-repository.ts";

test("GitHub repo URL parser correctly parses valid GitHub repository URLs", () => {
  const parsed1 = parseGitHubRepoUrl("https://github.com/Edmounds/robviz");
  assert.deepEqual(parsed1, {
    owner: "Edmounds",
    repo: "robviz",
    canonicalUrl: "https://github.com/Edmounds/robviz",
  });

  const parsed2 = parseGitHubRepoUrl("https://github.com/Edmounds/robviz/");
  assert.deepEqual(parsed2, {
    owner: "Edmounds",
    repo: "robviz",
    canonicalUrl: "https://github.com/Edmounds/robviz",
  });

  const parsed3 = parseGitHubRepoUrl("https://github.com/Edmounds/robviz.git");
  assert.deepEqual(parsed3, {
    owner: "Edmounds",
    repo: "robviz",
    canonicalUrl: "https://github.com/Edmounds/robviz",
  });

  const parsed4 = parseGitHubRepoUrl(
    "https://github.com/Edmounds/robviz?tab=readme-ov-file#install",
  );
  assert.deepEqual(parsed4, {
    owner: "Edmounds",
    repo: "robviz",
    canonicalUrl: "https://github.com/Edmounds/robviz",
  });
});

test("GitHub repo URL parser rejects non-https, non-GitHub domains, extra paths, and malformed inputs", () => {
  assert.equal(parseGitHubRepoUrl("http://github.com/Edmounds/robviz"), null);
  assert.equal(parseGitHubRepoUrl("https://gitlab.com/Edmounds/robviz"), null);
  assert.equal(parseGitHubRepoUrl("https://github.com/Edmounds/robviz/issues"), null);
  assert.equal(parseGitHubRepoUrl("https://github.com/Edmounds/robviz/tree/main"), null);
  assert.equal(parseGitHubRepoUrl("https://github.com/Edmounds"), null);
  assert.equal(parseGitHubRepoUrl("https://github.com/"), null);
  assert.equal(parseGitHubRepoUrl("not-a-url"), null);
  assert.equal(parseGitHubRepoUrl(""), null);
  assert.equal(parseGitHubRepoUrl(null), null);
});

test("fetchGitHubRepo parses successful repository responses and includes Authorization when configured", async () => {
  let capturedUrl = "";
  let capturedAuth = "";

  const data = await fetchGitHubRepo("Edmounds", "robviz", {
    token: "ghp_secret_token",
    fetchImpl: async (url, init) => {
      capturedUrl = String(url);
      capturedAuth = init?.headers?.authorization ?? "";
      return new Response(
        JSON.stringify({
          name: "robviz",
          full_name: "Edmounds/robviz",
          description: "ROS2 2D visualization tool",
          stargazers_count: 42,
          html_url: "https://github.com/Edmounds/robviz",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  assert.equal(capturedUrl, "https://api.github.com/repos/Edmounds/robviz");
  assert.equal(capturedAuth, "Bearer ghp_secret_token");
  assert.deepEqual(data, {
    url: "https://github.com/Edmounds/robviz",
    name: "robviz",
    fullName: "Edmounds/robviz",
    description: "ROS2 2D visualization tool",
    stars: 42,
  });
});

test("fetchGitHubRepo returns undefined on 404, 429 rate limit, 500 error, or timeout", async () => {
  const notFound = await fetchGitHubRepo("Edmounds", "non-existent", {
    fetchImpl: async () => new Response("Not Found", { status: 404 }),
  });
  assert.equal(notFound, undefined);

  const rateLimited = await fetchGitHubRepo("Edmounds", "robviz", {
    fetchImpl: async () => new Response("Rate Limit Exceeded", { status: 429 }),
  });
  assert.equal(rateLimited, undefined);

  const serverError = await fetchGitHubRepo("Edmounds", "robviz", {
    fetchImpl: async () => new Response("Server Error", { status: 500 }),
  });
  assert.equal(serverError, undefined);

  const timedOut = await fetchGitHubRepo("Edmounds", "robviz", {
    timeoutMs: 10,
    fetchImpl: async (_url, init) => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 50);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("The operation was aborted", "AbortError"));
        });
      });
      return new Response("{}", { status: 200 });
    },
  });
  assert.equal(timedOut, undefined);
});

test("getCachedGitHubRepo serves fresh cached data without requesting upstream", async () => {
  const now = new Date("2026-08-30T12:00:00Z");
  const cachedData = {
    url: "https://github.com/Edmounds/robviz",
    name: "robviz",
    fullName: "Edmounds/robviz",
    description: "Cached description",
    stars: 100,
  };

  let fetchCalls = 0;
  const result = await getCachedGitHubRepo("Edmounds", "robviz", {
    now,
    cache: {
      match: async () =>
        new Response(JSON.stringify(cachedData), {
          headers: {
            "x-github-repo-fetched-at": new Date(
              "2026-08-30T10:00:00Z",
            ).toISOString(), // 2 hours old (less than 6h)
          },
        }),
      put: async () => {},
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response("{}", { status: 200 });
    },
  });

  assert.equal(fetchCalls, 0);
  assert.deepEqual(result, cachedData);
});

test("getCachedGitHubRepo falls back to stale cache when refresh fails", async () => {
  const now = new Date("2026-08-30T12:00:00Z");
  const staleData = {
    url: "https://github.com/Edmounds/robviz",
    name: "robviz",
    fullName: "Edmounds/robviz",
    description: "Stale description",
    stars: 99,
  };

  let fetchCalls = 0;
  let putCalls = 0;
  const result = await getCachedGitHubRepo("Edmounds", "robviz", {
    now,
    cache: {
      match: async () =>
        new Response(JSON.stringify(staleData), {
          headers: {
            "x-github-repo-fetched-at": new Date(
              "2026-08-30T04:00:00Z",
            ).toISOString(), // 8 hours old (expired refresh TTL)
          },
        }),
      put: async () => {
        putCalls += 1;
      },
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response("Rate limited", { status: 429 });
    },
  });

  assert.equal(fetchCalls, 1);
  assert.equal(putCalls, 0);
  assert.deepEqual(result, staleData);
});

test("getCachedGitHubRepo retains successful data and writes cache headers", async () => {
  const now = new Date("2026-08-30T12:00:00Z");
  let storedResponse = null;

  const result = await getCachedGitHubRepo("Edmounds", "robviz", {
    now,
    cache: {
      match: async () => undefined,
      put: async (_req, res) => {
        storedResponse = res;
      },
    },
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          name: "robviz",
          full_name: "Edmounds/robviz",
          description: "Fresh description",
          stargazers_count: 123,
          html_url: "https://github.com/Edmounds/robviz",
        }),
        { status: 200 },
      ),
  });

  assert.deepEqual(result, {
    url: "https://github.com/Edmounds/robviz",
    name: "robviz",
    fullName: "Edmounds/robviz",
    description: "Fresh description",
    stars: 123,
  });
  assert.equal(
    storedResponse?.headers.get("cache-control"),
    "public, max-age=604800",
  );
  assert.equal(
    storedResponse?.headers.get("x-github-repo-fetched-at"),
    now.toISOString(),
  );
});
