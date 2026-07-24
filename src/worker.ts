import { handle } from "@astrojs/cloudflare/handler";

import { syncSteamGames } from "../functions/_shared/games.js";

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
  },
} satisfies ExportedHandler<Cloudflare.Env>;
