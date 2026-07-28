import {
  createArtItem, deleteCoverIfUnreferenced, error, findArtItemBySourceId, isArtSourceIdConflict, json, listArtItems,
  normalizeArtMusicKind, normalizeArtType, readJson, requireBucket, requireDb, requireSameOriginJson, storeCover, validateArtItemInput,
} from "../../../art.js";

export async function onRequestGet({ env, request }) {
  try {
    const rawType = new URL(request.url).searchParams.get("type");
    const type = rawType ? normalizeArtType(rawType) : undefined;
    const rawMusicKind = new URL(request.url).searchParams.get("musicKind");
    const musicKind = rawMusicKind ? normalizeArtMusicKind(rawMusicKind) : undefined;
    if (rawType && !type) return error(400, "INVALID_TYPE", "收藏类型无效。");
    if (rawMusicKind && (!musicKind || type !== "music")) return error(400, "INVALID_MUSIC_KIND", "音乐分类无效。");
    return json(
      { items: await listArtItems(requireDb(env), { type, musicKind }) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Art item list failed", err);
    return error(500, "ART_LIST_FAILED", "暂时无法加载收藏。");
  }
}

export async function onRequestPost({ env, request }) {
  let stored;
  try {
    requireSameOriginJson(request);
    const validation = validateArtItemInput(await readJson(request));
    if (!validation.ok) return error(400, validation.error.code, validation.error.message);
    const id = crypto.randomUUID();
    const bucket = requireBucket(env);
    const db = requireDb(env);
    if (await findArtItemBySourceId(db, validation.value.source, validation.value.sourceId)) return alreadyExists();
    stored = await storeCover(bucket, id, validation.value.cover, coverFetch(env), { db });
    const item = await createArtItem(db, validation.value, stored, { id });
    return json({ item }, { status: 201 });
  } catch (err) {
    if (stored?.key) await deleteCoverIfUnreferenced(env.ART_COVERS, env.DB, stored.key).catch((cleanupError) => console.error("New cover cleanup failed", cleanupError));
    if (err instanceof Response) return err;
    if (isArtSourceIdConflict(err)) return alreadyExists();
    console.error("Art item create failed", err);
    return error(500, "ART_CREATE_FAILED", "新增收藏失败。");
  }
}

function alreadyExists() {
  return error(409, "ART_ALREADY_EXISTS", "该收藏已经存在。");
}

function coverFetch(env) {
  if (typeof env?.ART_COVER_FETCHER?.fetch !== "function") return fetch;
  return async (url, init) => {
    const request = new Request("https://cover-fetcher.internal/", init);
    request.headers.set("x-art-cover-url", String(url));
    return env.ART_COVER_FETCHER.fetch(request);
  };
}
