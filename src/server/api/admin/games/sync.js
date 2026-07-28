import { error, getSyncState, json, listGames, requireDb, requireSameOrigin, syncSteamGames } from "../../../games.js";

export async function onRequestPost({ env, request }) {
  try {
    requireSameOrigin(request);
    const result = await syncSteamGames(env);
    const db = requireDb(env);
    const [items, syncState] = await Promise.all([listGames(db), getSyncState(db)]);
    return json(
      { ...result, items, syncState },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (err) {
    if (err instanceof Response) return err;
    const code = typeof err?.code === "string" ? err.code : "STEAM_SYNC_FAILED";
    const message = typeof err?.message === "string" ? err.message : "Steam 同步失败，请稍后重试。";
    const status = code === "STEAM_API_KEY_MISSING" ? 503 : 502;
    console.error("Steam game sync failed", { code, message });
    return error(status, code, message);
  }
}
