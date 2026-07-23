import {
  MAX_COMMENT_BODY_BYTES,
  createComment,
  getCommentCursor,
  listPublicComments,
  validateCommentInput,
} from "../_shared/comments.js";
import { error, json, normalizeSlug, requireDb, requireSameOriginJson } from "../_shared/engagement.js";

export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const slug = normalizeSlug(url.searchParams.get("slug"));
    if (!slug) return error(400, "INVALID_SLUG", "请选择一篇已发布的文章。");

    const rawCursor = url.searchParams.get("cursor");
    const cursor = getCommentCursor(rawCursor);
    if (rawCursor && !cursor) return error(400, "INVALID_CURSOR", "评论游标无效。");

    return json(await listPublicComments(requireDb(env), slug, cursor));
  } catch (err) {
    if (err instanceof Response) return err;
    return error(500, "COMMENT_LIST_FAILED", "暂时无法加载评论，请稍后重试。");
  }
}

export async function onRequestPost({ env, request }) {
  try {
    requireSameOriginJson(request);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_COMMENT_BODY_BYTES) return error(413, "COMMENT_TOO_LARGE", "评论请求过大。");

    let body;
    try {
      const text = await request.text();
      if (new TextEncoder().encode(text).byteLength > MAX_COMMENT_BODY_BYTES) {
        return error(413, "COMMENT_TOO_LARGE", "评论请求过大。");
      }
      body = JSON.parse(text);
    } catch {
      return error(400, "INVALID_JSON", "评论数据格式无效。");
    }

    const validation = validateCommentInput(body);
    if (!validation.ok) return error(400, validation.error.code, validation.error.message);

    const salt = typeof env.COMMENT_HASH_SALT === "string" ? env.COMMENT_HASH_SALT.trim() : "";
    if (!salt) return error(503, "COMMENT_WRITES_DISABLED", "评论发布暂不可用，请稍后重试。");

    const result = await createComment(requireDb(env), request, validation.value, salt);
    if (!result.ok) {
      return json(
        { error: { code: "RATE_LIMITED", message: "发布过于频繁，请稍后再试。" } },
        { status: 429, headers: { "retry-after": String(Math.max(1, result.retryAfter)) } },
      );
    }

    return json({ item: result.comment }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    return error(500, "COMMENT_WRITE_FAILED", "评论发布失败，请稍后重试。");
  }
}
