import { handle } from "@astrojs/cloudflare/handler";

import { syncSteamGames } from "./server/games.js";
import { syncNeteaseRanking } from "./server/netease-music.js";

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
    for (const type of ["weekly", "total"] as const) {
      ctx.waitUntil(syncNeteaseRanking(env, type).catch((error) => {
        console.error(`Scheduled NetEase ${type} ranking sync failed`, {
          code: typeof error?.code === "string" ? error.code : "NETEASE_SYNC_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }));
    }
  },
} satisfies ExportedHandler<Cloudflare.Env>;
