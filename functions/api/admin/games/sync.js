import { error, json, requireSameOrigin, syncSteamGames } from "../../../_shared/games.js";

export async function onRequestPost({ env, request }) {
  try {
    requireSameOrigin(request);
    return json(await syncSteamGames(env));
  } catch (err) {
    if (err instanceof Response) return err;
    const code = typeof err?.code === "string" ? err.code : "STEAM_SYNC_FAILED";
    const message = typeof err?.message === "string" ? err.message : "Steam 同步失败，请稍后重试。";
    const status = code === "STEAM_API_KEY_MISSING" ? 503 : 502;
    console.error("Steam game sync failed", { code, message });
    return error(status, code, message);
  }
}
