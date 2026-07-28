const EDGE_CACHE_TTL_SECONDS = 15;

export function createEdgeCacheKey(request, kind, params) {
  const url = new URL(request.url);
  url.pathname = `/__edge-cache/${kind}`;
  url.search = "";
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return new Request(url.toString(), { method: "GET" });
}

export async function readEdgeJson(cache, key, load, now = () => performance.now(), waitUntil) {
  const startedAt = now();
  const cached = await cache.match(key);
  if (cached) return withEdgeHeaders(cached, "HIT", now() - startedAt);

  const response = await load();
  if (response.status === 200 && response.headers.get("content-type")?.includes("application/json")) {
    const stored = new Response(response.clone().body, response);
    stored.headers.set("cache-control", `public, max-age=${EDGE_CACHE_TTL_SECONDS}`);
    const write = cache.put(key, stored);
    if (waitUntil) waitUntil(write);
    else await write;
  }
  return withEdgeHeaders(response, "MISS", now() - startedAt);
}

export function noStore(response) {
  const result = new Response(response.body, response);
  result.headers.set("cache-control", "no-store");
  return result;
}

function withEdgeHeaders(response, status, durationMs) {
  const result = new Response(response.body, response);
  result.headers.set("cache-control", "no-store");
  result.headers.set("x-edge-cache", status);
  result.headers.set("server-timing", `edge;dur=${Math.max(0, durationMs).toFixed(1)}`);
  return result;
}
