import { error, incrementLike, json, readBodyContentId, requireDb, requireSameOriginJson } from "../_shared/engagement.js";
import { noStore } from "../_shared/edge-cache.js";

export async function onRequestPost({ env, request }) {
  try {
    requireSameOriginJson(request);
    const contentId = await readBodyContentId(request);
    if (!contentId) return error(400, "INVALID_CONTENT_ID", "A valid published content ID is required.");

    const stats = await incrementLike(requireDb(env), contentId);
    return noStore(json({ ok: true, ...stats }));
  } catch (err) {
    if (err instanceof Response) return err;
    return error(500, "LIKE_WRITE_FAILED", "Unable to record the post like.");
  }
}
