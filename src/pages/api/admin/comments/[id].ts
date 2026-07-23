import type { APIRoute } from "astro";

import { setCommentHidden } from "../../../../lib/comments";
import { errorResponse, jsonResponse, requireDb, requireSameOriginJson } from "../../../../lib/engagement";

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  try {
    requireSameOriginJson(request);
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return errorResponse(400, "INVALID_COMMENT_ID", "评论编号无效。");
    let body: { hidden?: unknown };
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_JSON", "请求数据格式无效。");
    }
    if (typeof body.hidden !== "boolean") return errorResponse(400, "INVALID_HIDDEN_STATE", "隐藏状态无效。");
    const item = await setCommentHidden(requireDb(locals.runtime.env), id, body.hidden);
    if (!item) return errorResponse(404, "COMMENT_NOT_FOUND", "未找到该评论。");
    return jsonResponse({ item });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse(500, "ADMIN_COMMENT_UPDATE_FAILED", "评论状态更新失败。");
  }
};
