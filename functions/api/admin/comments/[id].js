import { setCommentHidden } from "../../../_shared/comments.js";
import { error, json, requireDb, requireSameOriginJson } from "../../../_shared/engagement.js";

export async function onRequestPatch({ env, params, request }) {
  try {
    requireSameOriginJson(request);
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return error(400, "INVALID_COMMENT_ID", "评论编号无效。");

    let body;
    try {
      body = await request.json();
    } catch {
      return error(400, "INVALID_JSON", "请求数据格式无效。");
    }
    if (typeof body?.hidden !== "boolean") return error(400, "INVALID_HIDDEN_STATE", "隐藏状态无效。");

    const item = await setCommentHidden(requireDb(env), id, body.hidden);
    if (!item) return error(404, "COMMENT_NOT_FOUND", "未找到该评论。");
    return json({ item });
  } catch (err) {
    if (err instanceof Response) return err;
    return error(500, "ADMIN_COMMENT_UPDATE_FAILED", "评论状态更新失败。");
  }
}
