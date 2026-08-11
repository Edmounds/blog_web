import { syncNeteaseRankingsWithRefresh } from "../../../netease-music.js";
import { getAdminStatus, handleError, json, publicOutcome, requireSameOrigin } from "./common.js";

export async function onRequestPost({ env, request }) {
  try {
    requireSameOrigin(request);
    const result = await syncNeteaseRankingsWithRefresh(env);
    return json({
      result: {
        refresh: publicOutcome(result.refresh),
        weekly: publicOutcome(result.weekly),
        total: publicOutcome(result.total),
      },
      status: await getAdminStatus(env),
    });
  } catch (err) {
    return handleError(err, "sync");
  }
}
