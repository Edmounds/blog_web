import { error, normalizeArtId, parseExternalArtCoverUrl, requireDb } from "../../art.js";

export async function onRequestGet({ env, params }) {
  try {
    const id = normalizeArtId(params.id);
    if (!id) return error(400, "INVALID_ITEM_ID", "收藏编号无效。");
    const row = await requireDb(env).prepare(
      "SELECT source, cover_source_url FROM art_items WHERE id = ? AND is_visible = 1 LIMIT 1",
    ).bind(id).first();
    const sourceUrl = row ? parseExternalArtCoverUrl(row.source, row.cover_source_url) : null;
    if (!sourceUrl || row.source !== "douban_books") return error(404, "ART_COVER_NOT_FOUND", "未找到该封面。");
    if (typeof env?.ART_COVER_FETCHER?.fetch !== "function") {
      return error(503, "COVER_FETCHER_NOT_CONFIGURED", "封面代理暂不可用。");
    }

    const request = new Request("https://cover-fetcher.internal/", {
      headers: {
        accept: "image/jpeg,image/png,image/webp,image/avif",
        "user-agent": "blog-art-cover-fetcher/1.0",
        "x-art-cover-url": sourceUrl,
      },
    });
    const response = await env.ART_COVER_FETCHER.fetch(request);
    if (!response.ok || !response.body) return error(502, "COVER_FETCH_FAILED", "暂时无法加载封面。");

    return new Response(response.body, {
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "content-type": response.headers.get("content-type") ?? "image/jpeg",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Douban cover proxy failed", err);
    return error(500, "DOUBAN_COVER_FAILED", "暂时无法加载封面。");
  }
}
