import {
  deleteCoverIfUnreferenced, error, getArtItem, isArtSourceIdConflict, json, normalizeArtId, readJson, requireBucket,
  requireDb, requireSameOrigin, requireSameOriginJson, storeCover, updateArtItem, validateArtItemInput,
} from "../../../../_shared/art.js";

export async function onRequestPatch({ env, params, request }) {
  let stored;
  try {
    requireSameOriginJson(request);
    const id = normalizeArtId(params.id);
    if (!id) return error(400, "INVALID_ITEM_ID", "收藏编号无效。");
    const db = requireDb(env);
    const current = await getArtItem(db, id);
    if (!current) return error(404, "ART_NOT_FOUND", "未找到该收藏。");
    const validation = validateArtItemInput(await readJson(request), { partial: true, currentType: current.type });
    if (!validation.ok) return error(400, validation.error.code, validation.error.message);
    const bucket = requireBucket(env);
    if (validation.value.cover) stored = await storeCover(bucket, id, validation.value.cover, coverFetch(env), { db, currentItemId: id });
    const item = await updateArtItem(db, id, current, validation.value, stored);
    if (stored && current.coverKey !== stored.key) {
      await bucket.delete(current.coverKey).catch((cleanupError) => console.error("Old art cover deletion failed", cleanupError));
    }
    return json({ item });
  } catch (err) {
    if (stored?.key) await deleteCoverIfUnreferenced(env.ART_COVERS, env.DB, stored.key).catch((cleanupError) => console.error("Replacement cover cleanup failed", cleanupError));
    if (err instanceof Response) return err;
    if (isArtSourceIdConflict(err)) return error(409, "ART_ALREADY_EXISTS", "该专辑已经收藏。");
    console.error("Art item update failed", err);
    return error(500, "ART_UPDATE_FAILED", "更新收藏失败。");
  }
}

function coverFetch(env) {
  if (typeof env?.ART_COVER_FETCHER?.fetch !== "function") return fetch;
  return async (url, init) => {
    const request = new Request("https://cover-fetcher.internal/", init);
    request.headers.set("x-art-cover-url", String(url));
    return env.ART_COVER_FETCHER.fetch(request);
  };
}

export async function onRequestDelete({ env, params, request }) {
  try {
    requireSameOrigin(request);
    const id = normalizeArtId(params.id);
    if (!id) return error(400, "INVALID_ITEM_ID", "收藏编号无效。");
    const db = requireDb(env);
    const current = await getArtItem(db, id);
    if (!current) return error(404, "ART_NOT_FOUND", "未找到该收藏。");
    const bucket = requireBucket(env);
    await bucket.delete(current.coverKey);
    const result = await db.prepare("DELETE FROM art_items WHERE id = ?").bind(id).run();
    if (Number(result.meta?.changes ?? 0) === 0) throw new Error("Art item disappeared during deletion.");
    return json({ deleted: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Art item delete failed", err);
    return error(500, "ART_DELETE_FAILED", "永久删除收藏失败。");
  }
}
