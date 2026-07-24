export async function onRequestGet({ env, params, request }) {
  if (!env?.ART_COVERS) return new Response("Not found", { status: 404 });
  const path = Array.isArray(params.path) ? params.path.join("/") : String(params.path ?? "");
  const key = `game/${path}`;
  if (!/^game\/[a-f0-9-]+\.(?:jpg|png|webp|avif)$/i.test(key)) return new Response("Not found", { status: 404 });
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
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}
