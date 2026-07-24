import { error, getStats, json, readQueryContentId, requireDb } from "../_shared/engagement.js";
import { createEdgeCacheKey, readEdgeJson } from "../_shared/edge-cache.js";

export async function onRequestGet({ env, request, waitUntil }) {
  try {
    const contentId = readQueryContentId(request);
    if (!contentId) return error(400, "INVALID_CONTENT_ID", "A valid published content ID is required.");

    const db = requireDb(env);
    const key = createEdgeCacheKey(request, "stats", { contentId });
    return readEdgeJson(caches.default, key, async () => json(await getStats(db, contentId)), undefined, waitUntil);
  } catch (err) {
    if (err instanceof Response) return err;
    return error(500, "STATS_READ_FAILED", "Unable to read post statistics.");
  }
}
