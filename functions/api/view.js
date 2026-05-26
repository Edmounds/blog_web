import { error, json, readBodySlug, recordView, requireDb } from "../_shared/engagement.js";

export async function onRequestPost({ env, request }) {
  try {
    const slug = await readBodySlug(request);
    if (!slug) return error(400, "INVALID_SLUG", "A valid published post slug is required.");

    const stats = await recordView(requireDb(env), request, slug);
    return json({ ok: true, ...stats });
  } catch (err) {
    if (err instanceof Response) return err;
    return error(500, "VIEW_WRITE_FAILED", "Unable to record the post view.");
  }
}
