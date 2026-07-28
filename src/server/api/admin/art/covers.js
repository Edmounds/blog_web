import {
  cleanupOrphanUploadedCovers, error, isCoverKeyReferenced, json, normalizeStoredCoverKey, readJson,
  requireBucket, requireDb, requireSameOrigin, requireSameOriginJson, storeUploadedCover,
} from "../../../art.js";

export async function onRequestPost({ env, request, waitUntil }) {
  try {
    requireSameOrigin(request);
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > 14 * 1024 * 1024) return error(413, "BODY_TOO_LARGE", "请求数据超过大小限制。");
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("multipart/form-data;")) return error(400, "INVALID_COVER_UPLOAD", "请选择要上传的封面。");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return error(400, "INVALID_COVER_UPLOAD", "请选择要上传的封面。");
    const bucket = requireBucket(env);
    const cover = await storeUploadedCover(bucket, file);
    if (env?.DB) {
      const cleanup = cleanupOrphanUploadedCovers(bucket, requireDb(env)).catch((cleanupError) => console.error("Orphan art cover cleanup failed", cleanupError));
      if (typeof waitUntil === "function") waitUntil(cleanup);
      else await cleanup;
    }
    return json({ cover: { kind: "stored", key: cover.key, url: cover.url } }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Art cover upload failed", err);
    return error(500, "ART_COVER_UPLOAD_FAILED", "封面上传失败。");
  }
}

export async function onRequestDelete({ env, request }) {
  try {
    requireSameOriginJson(request);
    const body = await readJson(request);
    const key = normalizeStoredCoverKey(body?.key);
    if (!key) return error(400, "INVALID_STORED_COVER", "已上传封面无效。");
    const db = requireDb(env);
    if (await isCoverKeyReferenced(db, key)) return error(409, "COVER_IN_USE", "该封面已被收藏使用，不能删除。");
    await requireBucket(env).delete(key);
    return json({ deleted: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Temporary art cover deletion failed", err);
    return error(500, "ART_COVER_DELETE_FAILED", "暂时无法清理封面。");
  }
}
