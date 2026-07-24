import type { APIRoute } from "astro";
import { errorResponse, incrementLike, jsonResponse, readBodyContentId, requireDb, requireSameOriginJson } from "../../lib/engagement";
import { noStore } from "../../lib/edge-cache";
import { getRuntimeEnv } from "../../lib/runtime";

export const POST: APIRoute = async ({ request }) => {
  try {
    requireSameOriginJson(request);
    const contentId = await readBodyContentId(request);
    if (!contentId) return errorResponse(400, "INVALID_CONTENT_ID", "A valid published content ID is required.");

    const env = getRuntimeEnv();
    const stats = await incrementLike(requireDb(env), contentId);
    return noStore(jsonResponse({ ok: true, ...stats }));
  } catch (err) {
    if (err instanceof Response) return err;
    return errorResponse(500, "LIKE_WRITE_FAILED", "Unable to record the post like.");
  }
};
