// Serves the blog-images R2 bucket's content images (blog/ and legacy bed/
// prefixes) same-origin so they ride the preferred-proxy route instead of a
// separate img.muelsyse.us connection, which is slow from mainland China.
const CONTENT_IMAGE_KEY = /^(?:blog|bed)\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]+)*\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

export async function onRequestGet({ env, params, request }) {
  if (!env?.ART_COVERS) return new Response("Not found", { status: 404 });
  const key = Array.isArray(params.path) ? params.path.join("/") : String(params.path ?? "");
  if (!CONTENT_IMAGE_KEY.test(key)) return new Response("Not found", { status: 404 });
  const object = await env.ART_COVERS.get(key, { onlyIf: request.headers });
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.get("content-type")) headers.set("content-type", mimeForKey(key));
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  if (!object.body) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
}

function mimeForKey(key) {
  if (key.endsWith(".svg")) return "image/svg+xml";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".avif")) return "image/avif";
  if (key.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
