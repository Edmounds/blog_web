import { error, json, readBodyContentId, recordView, requireDb, requireSameOriginJson, scheduleViewEventPrune } from "../_shared/engagement.js";
import { noStore } from "../_shared/edge-cache.js";

export async function onRequestPost({ env, request, waitUntil }) {
  try {
    requireSameOriginJson(request);
    const contentId = await readBodyContentId(request);
    if (!contentId) return error(400, "INVALID_CONTENT_ID", "A valid published content ID is required.");

    const db = requireDb(env);
    const stats = await recordView(db, request, contentId);
    scheduleViewEventPrune(db, { waitUntil });
    return noStore(json({ ok: true, ...stats }));
  } catch (err) {
    if (err instanceof Response) return err;
    return error(500, "VIEW_WRITE_FAILED", "Unable to record the post view.");
  }
}
