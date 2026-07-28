import { error, fetchRemoteImage, imageExtension, parsePublicHttpsUrl } from "../../../art.js";

export async function onRequestGet({ env, request }) {
  try {
    const rawUrl = new URL(request.url).searchParams.get("url");
    if (!rawUrl) return error(400, "INVALID_COVER_URL", "封面 URL 无效。");

    const url = parsePublicHttpsUrl(rawUrl);
    const image = await fetchRemoteImage(url, coverFetch(env));
    const headers = new Headers({
      "cache-control": "private, no-store",
      "content-disposition": `inline; filename="cover.${imageExtension(image.mime)}"`,
      "content-type": image.mime,
      "x-content-type-options": "nosniff",
    });
    return new Response(image.bytes, { headers });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Art cover preview failed", err);
    return error(500, "COVER_PREVIEW_FAILED", "暂时无法预览封面。");
  }
}

function coverFetch(env) {
  if (typeof env?.ART_COVER_FETCHER?.fetch !== "function") return fetch;
  return async (url, init) => {
    const request = new Request("https://cover-fetcher.internal/", init);
    request.headers.set("x-art-cover-url", String(url));
    return env.ART_COVER_FETCHER.fetch(request);
  };
}
