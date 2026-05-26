import { error, incrementLike, json, readBodySlug, requireDb } from "../_shared/engagement.js";

export async function onRequestPost({ env, request }) {
  try {
    const slug = await readBodySlug(request);
    if (!slug) return error(400, "INVALID_SLUG", "A valid published post slug is required.");

    const stats = await incrementLike(requireDb(env), slug);
    return json({ ok: true, ...stats });
  } catch (err) {
    if (err instanceof Response) return err;
    return error(500, "LIKE_WRITE_FAILED", "Unable to record the post like.");
  }
}
