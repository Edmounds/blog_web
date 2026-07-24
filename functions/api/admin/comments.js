import { getCommentCursor, listAdminComments } from "../../_shared/comments.js";
import { error, json, normalizeContentId, requireDb } from "../../_shared/engagement.js";

export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const contentId = normalizeContentId(url.searchParams.get("contentId"));
    if (!contentId) return error(400, "INVALID_CONTENT_ID", "请选择一篇已发布的内容。");

    const status = url.searchParams.get("status") ?? "all";
    if (!new Set(["all", "visible", "hidden"]).has(status)) {
      return error(400, "INVALID_STATUS", "评论状态筛选无效。");
    }

    const rawCursor = url.searchParams.get("cursor");
    const cursor = getCommentCursor(rawCursor);
    if (rawCursor && !cursor) return error(400, "INVALID_CURSOR", "评论游标无效。");

    return json(await listAdminComments(requireDb(env), contentId, status, cursor));
  } catch (err) {
    if (err instanceof Response) return err;
    return error(500, "ADMIN_COMMENT_LIST_FAILED", "暂时无法加载评论。");
  }
}
