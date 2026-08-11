import { handle } from "@astrojs/cloudflare/handler";

import { syncSteamGames } from "./server/games.js";
import { syncNeteaseRankingsWithRefresh } from "./server/netease-music.js";

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return handle(request, env, ctx);
  },
  scheduled(_controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    ctx.waitUntil(syncSteamGames(env).catch((error) => {
      console.error("Scheduled Steam game sync failed", {
        code: typeof error?.code === "string" ? error.code : "STEAM_SYNC_FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }));
    ctx.waitUntil(syncNeteaseRankingsWithRefresh(env).then((result) => {
      for (const name of ["refresh", "weekly", "total"] as const) {
        const outcome = result[name];
        if (outcome.status === "fulfilled") continue;
        const reason = outcome.reason;
        console.error(`Scheduled NetEase ${name} failed`, {
          code: reason && typeof reason === "object" && "code" in reason && typeof reason.code === "string"
            ? reason.code
            : "NETEASE_SYNC_FAILED",
          message: reason instanceof Error ? reason.message : "Unknown error",
        });
      }
    }).catch((error) => {
      console.error("Scheduled NetEase sync failed", {
        code: typeof error?.code === "string" ? error.code : "NETEASE_SYNC_FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }));
  },
} satisfies ExportedHandler<Cloudflare.Env>;
