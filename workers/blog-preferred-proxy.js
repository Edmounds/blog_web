const SECURITY_HEADERS = {
  "content-security-policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self' https://assets-proxy.anthropic.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: https://img.muelsyse.us https://raw.githubusercontent.com https://shared.akamai.steamstatic.com https://p1.music.126.net https://*.doubanio.com",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "upgrade-insecure-requests",
  ].join("; "),
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(), geolocation=(), microphone=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

function isSameOriginRequest(request) {
  const origin = request.headers.get("origin");
  const isCrossSite = request.headers.get("sec-fetch-site") === "cross-site";
  return !isCrossSite && (!origin || origin === new URL(request.url).origin);
}

export default {
  async fetch(request, env) {
    const incomingUrl = new URL(request.url);
    if (incomingUrl.hostname !== "blog.muelsyse.us" && !incomingUrl.hostname.endsWith(".workers.dev")) {
      return new Response("Not Found", { status: 404 });
    }

    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !isSameOriginRequest(request)) {
      return new Response(JSON.stringify({ error: { code: "FORBIDDEN_REQUEST", message: "Forbidden request." } }), {
        status: 403,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const upstreamHeaders = new Headers(request.headers);
    const response = await env.ORIGIN.fetch(new Request(request, { headers: upstreamHeaders }));
    const headers = new Headers(response.headers);
    headers.delete("access-control-allow-origin");
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }
    headers.set("x-blog-edge", "preferred-worker");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
