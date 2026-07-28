import {
  deleteManualGame, error, getGame, isGameCoverReferenced, json, normalizeGameId, readJson, requireBucket, requireDb,
  requireSameOrigin, requireSameOriginJson, updateGame, validateGameUpdate,
} from "../../../games.js";

export async function onRequestPatch({ env, params, request }) {
  try {
    requireSameOriginJson(request);
    const id = normalizeGameId(params.id);
    if (!id) return error(400, "INVALID_GAME_ID", "游戏编号无效。");
    const db = requireDb(env);
    const current = await getGame(db, id);
    if (!current) return error(404, "GAME_NOT_FOUND", "未找到该游戏。");
    const validation = validateGameUpdate(await readJson(request), current);
    if (!validation.ok) return error(400, validation.error.code, validation.error.message);
    const replacementKey = validation.value.coverKey;
    if (replacementKey) {
      const bucket = requireBucket(env);
      if (!await bucket.head(replacementKey)) return error(400, "STORED_COVER_NOT_FOUND", "已上传封面不存在，请重新上传。");
      if (await isGameCoverReferenced(db, replacementKey, id)) return error(409, "COVER_IN_USE", "该封面已被其他游戏使用。");
    }
    const item = await updateGame(db, id, validation.value);
    if (Object.hasOwn(validation.value, "coverKey") && current.coverKey && current.coverKey !== item.coverKey) {
      await requireBucket(env).delete(current.coverKey).catch((cleanupError) => console.error("Old game cover deletion failed", cleanupError));
    }
    return json({ item });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Game update failed", err);
    return error(500, "GAME_UPDATE_FAILED", "更新游戏失败。");
  }
}

export async function onRequestDelete({ env, params, request }) {
  try {
    requireSameOrigin(request);
    const id = normalizeGameId(params.id);
    if (!id) return error(400, "INVALID_GAME_ID", "游戏编号无效。");
    const db = requireDb(env);
    const current = await getGame(db, id);
    if (!current) return error(404, "GAME_NOT_FOUND", "未找到该游戏。");
    if (current.source === "steam") return error(409, "STEAM_DELETE_FORBIDDEN", "Steam 游戏只能隐藏，不能永久删除。");
    if (current.coverKey) {
      try {
        await requireBucket(env).delete(current.coverKey);
      } catch {
        return error(502, "GAME_COVER_DELETE_FAILED", "封面删除失败，游戏数据已保留。");
      }
    }
    if (!await deleteManualGame(db, id)) throw new Error("Game disappeared during deletion.");
    return json({ deleted: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Game delete failed", err);
    return error(500, "GAME_DELETE_FAILED", "永久删除游戏失败。");
  }
}
