import type { APIRoute } from "astro";
import { errorResponse, jsonResponse, readBodySlug, recordView, requireDb } from "../../lib/engagement";

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const slug = await readBodySlug(request);
    if (!slug) return errorResponse(400, "INVALID_SLUG", "A valid published post slug is required.");

    const env = locals.runtime.env;
    const stats = await recordView(requireDb(env), request, slug);
    return jsonResponse({ ok: true, ...stats });
  } catch (err) {
    if (err instanceof Response) return err;
    return errorResponse(500, "VIEW_WRITE_FAILED", "Unable to record the post view.");
  }
};
