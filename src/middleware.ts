import { defineMiddleware } from "astro:middleware";

import { verifyAccess } from "./lib/comments";
import { getRuntimeEnv } from "./lib/runtime";

export const onRequest = defineMiddleware(async ({ request }, next) => {
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/")) {
    const identity = await verifyAccess(request, getRuntimeEnv());
    if (!identity) {
      const isAdminApi = pathname.startsWith("/api/admin/");
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

  const response = await next();
  const secured = new Response(response.body, response);
  secured.headers.set("content-security-policy", "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  secured.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  secured.headers.set("x-content-type-options", "nosniff");
  secured.headers.set("x-frame-options", "DENY");
  secured.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  secured.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  if (pathname.startsWith("/admin/") || request.method !== "GET") secured.headers.set("cache-control", "no-store");
  return secured;
});
