import {
  error, isGameCoverReferenced, json, normalizeStoredGameCoverKey, readJson, requireBucket, requireDb,
  requireSameOrigin, requireSameOriginJson, storeUploadedGameCover,
} from "../../../_shared/games.js";

export async function onRequestPost({ env, request }) {
  try {
    requireSameOrigin(request);
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > 14 * 1024 * 1024) return error(413, "BODY_TOO_LARGE", "请求数据超过大小限制。");
    if (!(request.headers.get("content-type")?.toLowerCase() ?? "").startsWith("multipart/form-data;")) {
      return error(400, "INVALID_COVER_UPLOAD", "请选择要上传的封面。");
    }
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return error(400, "INVALID_COVER_UPLOAD", "请选择要上传的封面。");
    const cover = await storeUploadedGameCover(requireBucket(env), file);
    return json({ cover: { key: cover.key, url: cover.url } }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Game cover upload failed", err);
    return error(500, "GAME_COVER_UPLOAD_FAILED", "封面上传失败。");
  }
}

export async function onRequestDelete({ env, request }) {
  try {
    requireSameOriginJson(request);
    const key = normalizeStoredGameCoverKey((await readJson(request))?.key);
    if (!key) return error(400, "INVALID_STORED_COVER", "已上传封面无效。");
    if (await isGameCoverReferenced(requireDb(env), key)) return error(409, "COVER_IN_USE", "该封面已被游戏使用，不能删除。");
    await requireBucket(env).delete(key);
    return json({ deleted: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Temporary game cover deletion failed", err);
    return error(500, "GAME_COVER_DELETE_FAILED", "暂时无法清理封面。");
  }
}
