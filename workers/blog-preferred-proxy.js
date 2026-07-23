const ORIGIN_HOST = "new-blog-c0s.pages.dev";
const SECURITY_HEADERS = {
  "content-security-policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self' https://assets-proxy.anthropic.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
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

function isSameOriginJsonRequest(request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const origin = request.headers.get("origin");
  return contentType === "application/json" && (!origin || origin === new URL(request.url).origin);
}

export default {
  async fetch(request) {
    const incomingUrl = new URL(request.url);
    if (incomingUrl.hostname !== "blog.muelsyse.us") {
      return new Response("Not Found", { status: 404 });
    }

    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !isSameOriginJsonRequest(request)) {
      return new Response(JSON.stringify({ error: { code: "FORBIDDEN_REQUEST", message: "Forbidden request." } }), {
        status: 403,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const target = new URL(request.url);
    target.protocol = "https:";
    target.hostname = ORIGIN_HOST;
    target.port = "";

    const upstreamHeaders = new Headers(request.headers);
    if (upstreamHeaders.has("origin")) upstreamHeaders.set("origin", target.origin);
    const response = await fetch(new Request(target, { ...request, headers: upstreamHeaders }));
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
