import type { APIRoute } from "astro";

import {
  MAX_COMMENT_BODY_BYTES,
  createComment,
  getCommentCursor,
  listPublicComments,
  normalizeCommentSlug,
  validateCommentInput,
} from "../../lib/comments";
import { errorResponse, jsonResponse, requireDb, requireSameOriginJson } from "../../lib/engagement";

export const GET: APIRoute = async ({ locals, request }) => {
  try {
    const url = new URL(request.url);
    const slug = normalizeCommentSlug(url.searchParams.get("slug"));
    if (!slug) return errorResponse(400, "INVALID_SLUG", "请选择一篇已发布的文章。");
    const rawCursor = url.searchParams.get("cursor");
    const cursor = getCommentCursor(rawCursor);
    if (rawCursor && !cursor) return errorResponse(400, "INVALID_CURSOR", "评论游标无效。");
    return jsonResponse(await listPublicComments(requireDb(locals.runtime.env), slug, cursor));
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse(500, "COMMENT_LIST_FAILED", "暂时无法加载评论，请稍后重试。");
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
  try {
    requireSameOriginJson(request);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_COMMENT_BODY_BYTES) return errorResponse(413, "COMMENT_TOO_LARGE", "评论请求过大。");

    let body: unknown;
    try {
      const text = await request.text();
      if (new TextEncoder().encode(text).byteLength > MAX_COMMENT_BODY_BYTES) {
        return errorResponse(413, "COMMENT_TOO_LARGE", "评论请求过大。");
      }
      body = JSON.parse(text);
    } catch {
      return errorResponse(400, "INVALID_JSON", "评论数据格式无效。");
    }

    const validation = validateCommentInput(body);
    if (!validation.ok) return errorResponse(400, validation.error.code, validation.error.message);
    const env = locals.runtime.env;
    const salt = env.COMMENT_HASH_SALT?.trim();
    if (!salt) return errorResponse(503, "COMMENT_WRITES_DISABLED", "评论发布暂不可用，请稍后重试。");

    const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf;
    const result = await createComment(requireDb(env), request, validation.value, salt, cf);
    if (!result.ok) {
      return jsonResponse(
        { error: { code: "RATE_LIMITED", message: "发布过于频繁，请稍后再试。" } },
        { status: 429, headers: { "retry-after": String(Math.max(1, result.retryAfter)) } },
      );
    }
    return jsonResponse({ item: result.comment }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse(500, "COMMENT_WRITE_FAILED", "评论发布失败，请稍后重试。");
  }
};
