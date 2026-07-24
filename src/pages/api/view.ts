import type { APIRoute } from "astro";
import { errorResponse, jsonResponse, readBodyContentId, recordView, requireDb, requireSameOriginJson, scheduleViewEventPrune } from "../../lib/engagement";
import { noStore } from "../../lib/edge-cache";
import { getRuntimeEnv } from "../../lib/runtime";

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    requireSameOriginJson(request);
    const contentId = await readBodyContentId(request);
    if (!contentId) return errorResponse(400, "INVALID_CONTENT_ID", "A valid published content ID is required.");

    const env = getRuntimeEnv();
    const db = requireDb(env);
    const stats = await recordView(db, request, contentId);
    scheduleViewEventPrune(db, locals.cfContext);
    return noStore(jsonResponse({ ok: true, ...stats }));
  } catch (err) {
    if (err instanceof Response) return err;
    return errorResponse(500, "VIEW_WRITE_FAILED", "Unable to record the post view.");
  }
};
