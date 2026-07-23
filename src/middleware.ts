import { defineMiddleware } from "astro:middleware";

import { verifyAccess } from "./lib/comments";

export const onRequest = defineMiddleware(async ({ locals, request }, next) => {
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith("/admin/comments") || pathname.startsWith("/api/admin/comments")) {
    const identity = await verifyAccess(request, locals.runtime.env);
    if (!identity) {
      const isAdminApi = pathname.startsWith("/api/admin/comments");
      return new Response(
        isAdminApi
          ? JSON.stringify({ error: { code: "ACCESS_UNAUTHORIZED", message: "需要通过 Cloudflare Access 登录。" } })
          : "Unauthorized",
        {
          status: 401,
          headers: { "content-type": isAdminApi ? "application/json; charset=utf-8" : "text/plain; charset=utf-8" },
        },
      );
    }
  }

  return next();
});
