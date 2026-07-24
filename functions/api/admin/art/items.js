import {
  createArtItem, error, json, listArtItems, normalizeArtType, readJson, requireBucket, requireDb,
  requireSameOriginJson, storeCover, validateArtItemInput,
} from "../../../_shared/art.js";

export async function onRequestGet({ env, request }) {
  try {
    const rawType = new URL(request.url).searchParams.get("type");
    const type = rawType ? normalizeArtType(rawType) : undefined;
    if (rawType && !type) return error(400, "INVALID_TYPE", "收藏类型无效。");
    return json({ items: await listArtItems(requireDb(env), { type }) });
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
    stored = await storeCover(bucket, id, validation.value.cover, coverFetch(env));
    const item = await createArtItem(requireDb(env), validation.value, stored, { id });
    return json({ item }, { status: 201 });
  } catch (err) {
    if (stored?.key) await env.ART_COVERS?.delete(stored.key).catch((cleanupError) => console.error("New cover cleanup failed", cleanupError));
    if (err instanceof Response) return err;
    console.error("Art item create failed", err);
    return error(500, "ART_CREATE_FAILED", "新增收藏失败。");
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
