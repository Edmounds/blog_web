import { error, STEAM_COVER_HOST } from "../../games.js";

const STEAM_STORE_ITEMS_URL = "https://api.steampowered.com/IStoreBrowseService/GetItems/v1/";
const STEAM_APP_ID_PATTERN = /^[1-9]\d{0,9}$/;
const LIBRARY_CAPSULE_PATTERN = /^(?:(?:[a-f0-9]{40}\/)?(?:library_600x900|library_capsule)(?:_2x)?\.(?:jpg|png|webp)|portrait\.png)$/i;

export async function onRequestGet({ env, params }, fetchImpl = fetch) {
  const appId = String(params.appId ?? "");
  if (!STEAM_APP_ID_PATTERN.test(appId)) return steamCoverError(400, "INVALID_STEAM_APP_ID", "Steam 游戏编号无效。");

  try {
    if (!env?.DB) return steamCoverError(503, "DB_NOT_CONFIGURED", "游戏数据库未配置。");
    const game = await env.DB.prepare(
      "SELECT id FROM game_items WHERE source = 'steam' AND steam_app_id = ? AND is_visible = 1 LIMIT 1",
    ).bind(Number(appId)).first();
    if (!game) return steamCoverError(404, "STEAM_GAME_NOT_FOUND", "未找到该 Steam 游戏。");

    const url = new URL(STEAM_STORE_ITEMS_URL);
    url.searchParams.set("input_json", JSON.stringify({
      ids: [{ appid: Number(appId) }],
      context: { language: "english", country_code: "US" },
      data_request: { include_assets: true },
    }));
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return steamCoverError(502, "STEAM_COVER_LOOKUP_FAILED", "暂时无法查询 Steam 封面。");

    const payload = await response.json();
    const item = payload?.response?.store_items?.find((entry) => Number(entry?.id) === Number(appId));
    const format = item?.assets?.asset_url_format;
    const capsule = item?.assets?.library_capsule;
    const expectedFormat = `steam/apps/${appId}/\${FILENAME}`;
    if (typeof format !== "string" || !format.startsWith(expectedFormat)
      || !/^(?:\?t=\d+)?$/.test(format.slice(expectedFormat.length))
      || typeof capsule !== "string" || !LIBRARY_CAPSULE_PATTERN.test(capsule)) {
      return steamCoverError(404, "STEAM_COVER_NOT_FOUND", "未找到 Steam 竖版封面。");
    }

    const coverUrl = `https://${STEAM_COVER_HOST}/store_item_assets/${format.replace("${FILENAME}", capsule)}`;
    return new Response(null, {
      status: 302,
      headers: {
        "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        location: coverUrl,
      },
    });
  } catch (err) {
    console.error("Steam cover lookup failed", err);
    return steamCoverError(502, "STEAM_COVER_LOOKUP_FAILED", "暂时无法查询 Steam 封面。");
  }
}

function steamCoverError(status, code, message) {
  const response = error(status, code, message);
  response.headers.set("cache-control", "no-store");
  return response;
}
