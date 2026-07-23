import type { APIRoute } from "astro";
import { errorResponse, getStats, jsonResponse, readQuerySlug, requireDb } from "../../lib/engagement";

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const slug = readQuerySlug(request);
    if (!slug) return errorResponse(400, "INVALID_SLUG", "A valid published post slug is required.");

    const env = locals.runtime.env;
    const stats = await getStats(requireDb(env), slug);
    return jsonResponse(stats);
  } catch (err) {
    if (err instanceof Response) return err;
    return errorResponse(500, "STATS_READ_FAILED", "Unable to read post statistics.");
  }
};
