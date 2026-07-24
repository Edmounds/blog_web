import type { APIRoute } from "astro";
import { errorResponse, getStats, jsonResponse, readQueryContentId, requireDb } from "../../lib/engagement";
import { createEdgeCacheKey, readEdgeJson } from "../../lib/edge-cache";
import { getRuntimeEnv } from "../../lib/runtime";

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const contentId = readQueryContentId(request);
    if (!contentId) return errorResponse(400, "INVALID_CONTENT_ID", "A valid published content ID is required.");

    const env = getRuntimeEnv();
    const db = requireDb(env);
    const key = createEdgeCacheKey(request, "stats", { contentId });
    return readEdgeJson((caches as CacheStorage & { default: Cache }).default, key, async () => jsonResponse(await getStats(db, contentId)), undefined, (promise: Promise<unknown>) => locals.cfContext?.waitUntil(promise));
  } catch (err) {
    if (err instanceof Response) return err;
    return errorResponse(500, "STATS_READ_FAILED", "Unable to read post statistics.");
  }
};
