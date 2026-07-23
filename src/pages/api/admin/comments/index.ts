import type { APIRoute } from "astro";

import { getCommentCursor, listAdminComments, normalizeCommentSlug } from "../../../../lib/comments";
import { errorResponse, jsonResponse, requireDb } from "../../../../lib/engagement";

export const GET: APIRoute = async ({ locals, request }) => {
  try {
    const url = new URL(request.url);
    const slug = normalizeCommentSlug(url.searchParams.get("slug"));
    if (!slug) return errorResponse(400, "INVALID_SLUG", "请选择一篇已发布的文章。");
    const status = url.searchParams.get("status") ?? "all";
    if (!new Set(["all", "visible", "hidden"]).has(status)) return errorResponse(400, "INVALID_STATUS", "评论状态筛选无效。");
    const rawCursor = url.searchParams.get("cursor");
    const cursor = getCommentCursor(rawCursor);
    if (rawCursor && !cursor) return errorResponse(400, "INVALID_CURSOR", "评论游标无效。");
    return jsonResponse(await listAdminComments(requireDb(locals.runtime.env), slug, status, cursor));
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse(500, "ADMIN_COMMENT_LIST_FAILED", "暂时无法加载评论。");
  }
};
