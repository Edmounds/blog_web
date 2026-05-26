import { error, getStats, json, readQuerySlug, requireDb } from "../_shared/engagement.js";

export async function onRequestGet({ env, request }) {
  try {
    const slug = readQuerySlug(request);
    if (!slug) return error(400, "INVALID_SLUG", "A valid published post slug is required.");

    const stats = await getStats(requireDb(env), slug);
    return json(stats);
  } catch (err) {
    if (err instanceof Response) return err;
    return error(500, "STATS_READ_FAILED", "Unable to read post statistics.");
  }
}
