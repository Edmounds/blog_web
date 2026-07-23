import type { APIRoute } from "astro";
import { errorResponse, incrementLike, jsonResponse, readBodySlug, requireDb } from "../../lib/engagement";

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const slug = await readBodySlug(request);
    if (!slug) return errorResponse(400, "INVALID_SLUG", "A valid published post slug is required.");

    const env = locals.runtime.env;
    const stats = await incrementLike(requireDb(env), slug);
    return jsonResponse({ ok: true, ...stats });
  } catch (err) {
    if (err instanceof Response) return err;
    return errorResponse(500, "LIKE_WRITE_FAILED", "Unable to record the post like.");
  }
};
