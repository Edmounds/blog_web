import {
  createManualGame, error, getSyncState, isGameCoverReferenced, json, listGames, readJson, requireBucket, requireDb,
  requireSameOriginJson, validateGameCreate,
} from "../../../games.js";

export async function onRequestGet({ env, request }) {
  try {
    const params = new URL(request.url).searchParams;
    const source = params.get("source") || undefined;
    const visibility = params.get("visibility") || undefined;
    if (source && !["steam", "manual"].includes(source)) return error(400, "INVALID_SOURCE", "游戏来源无效。");
    if (visibility && !["visible", "hidden"].includes(visibility)) return error(400, "INVALID_VISIBILITY_FILTER", "显示筛选无效。");
    const db = requireDb(env);
    const [items, syncState] = await Promise.all([
      listGames(db, { query: params.get("query")?.trim() ?? "", source, visibility }),
      getSyncState(db),
    ]);
    return json(
      { items, syncState },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Game list failed", err);
    return error(500, "GAME_LIST_FAILED", "暂时无法加载游戏。");
  }
}

export async function onRequestPost({ env, request }) {
  try {
    requireSameOriginJson(request);
    const validation = validateGameCreate(await readJson(request));
    if (!validation.ok) return error(400, validation.error.code, validation.error.message);
    const db = requireDb(env);
    const bucket = requireBucket(env);
    if (!await bucket.head(validation.value.coverKey)) return error(400, "STORED_COVER_NOT_FOUND", "已上传封面不存在，请重新上传。");
    if (await isGameCoverReferenced(db, validation.value.coverKey)) return error(409, "COVER_IN_USE", "该封面已被其他游戏使用。");
    const item = await createManualGame(db, validation.value);
    return json({ item }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Manual game create failed", err);
    return error(500, "GAME_CREATE_FAILED", "新增游戏失败。");
  }
}
