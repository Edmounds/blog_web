export interface GitHubRepoData {
  url: string;
  name: string;
  fullName: string;
  description: string | null;
  stars: number | null;
}

export interface GitHubRepoPayload extends GitHubRepoData {
  state: "ready" | "fallback";
}

export interface GitHubRepoCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface GitHubRepoOptions {
  cache?: GitHubRepoCache;
  fetchImpl?: typeof fetch;
  now?: Date;
  timeoutMs?: number;
  token?: string;
}

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  canonicalUrl: string;
}

const CACHE_REFRESH_SECONDS = 6 * 60 * 60;
const CACHE_RETENTION_SECONDS = 7 * 24 * 60 * 60;
const CACHE_TIMESTAMP_HEADER = "x-github-repo-fetched-at";
const FETCH_TIMEOUT_MS = 8_000;
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export function parseGitHubRepoUrl(rawUrl: string): ParsedGitHubUrl | null {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return null;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname.toLowerCase() !== "github.com") return null;

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length !== 2) return null;

    const [owner, rawRepo] = segments;
    const repo = rawRepo.replace(/\.git$/i, "");

    if (!IDENTIFIER_PATTERN.test(owner) || !IDENTIFIER_PATTERN.test(repo)) {
      return null;
    }

    return {
      owner,
      repo,
      canonicalUrl: `https://github.com/${owner}/${repo}`,
    };
  } catch {
    return null;
  }
}

export async function fetchGitHubRepo(
  owner: string,
  repo: string,
  options: GitHubRepoOptions = {},
): Promise<GitHubRepoData | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? FETCH_TIMEOUT_MS,
  );
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "blog.muelsyse.us",
  };
  if (options.token?.trim()) {
    headers.authorization = `Bearer ${options.token.trim()}`;
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { headers, signal: controller.signal },
    );
    if (!response.ok) return undefined;
    const data = (await response.json()) as {
      name?: string;
      full_name?: string;
      description?: string | null;
      stargazers_count?: number;
      html_url?: string;
    };
    return {
      url:
        typeof data.html_url === "string" && data.html_url.length > 0
          ? data.html_url
          : `https://github.com/${owner}/${repo}`,
      name: typeof data.name === "string" ? data.name : repo,
      fullName:
        typeof data.full_name === "string"
          ? data.full_name
          : `${owner}/${repo}`,
      description:
        typeof data.description === "string" ? data.description : null,
      stars:
        typeof data.stargazers_count === "number" &&
        Number.isFinite(data.stargazers_count)
          ? data.stargazers_count
          : null,
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export async function getCachedGitHubRepo(
  owner: string,
  repo: string,
  options: GitHubRepoOptions = {},
): Promise<GitHubRepoData | undefined> {
  const key = new Request(
    `https://github-repo-cache.internal/v1/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );
  let staleRepo: GitHubRepoData | undefined;

  if (options.cache) {
    try {
      const cached = await options.cache.match(key);
      if (cached?.ok) {
        const data = (await cached.json()) as GitHubRepoData;
        const fetchedAt = Date.parse(
          cached.headers.get(CACHE_TIMESTAMP_HEADER) ?? "",
        );
        const ageSeconds =
          ((options.now ?? new Date()).getTime() - fetchedAt) / 1_000;
        if (Number.isFinite(fetchedAt) && ageSeconds < CACHE_REFRESH_SECONDS) {
          return data;
        }
        staleRepo = data;
      }
    } catch {}
  }

  const freshRepo = await fetchGitHubRepo(owner, repo, options);
  if (!freshRepo) return staleRepo;
  if (!options.cache) return freshRepo;

  try {
    await options.cache.put(
      key,
      new Response(JSON.stringify(freshRepo), {
        headers: {
          "content-type": "application/json",
          "cache-control": `public, max-age=${CACHE_RETENTION_SECONDS}`,
          [CACHE_TIMESTAMP_HEADER]: (options.now ?? new Date()).toISOString(),
        },
      }),
    );
  } catch {}

  return freshRepo;
}
