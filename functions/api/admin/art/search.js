import { error, json, normalizeArtType, normalizeIsbn } from "../../../_shared/art.js";
import { searchArtCandidates } from "../../../_shared/art-search.js";

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const type = normalizeArtType(url.searchParams.get("type"));
  const query = url.searchParams.get("q")?.trim() ?? "";
  const creator = url.searchParams.get("creator")?.trim() ?? "";
  const rawIsbn = url.searchParams.get("isbn")?.trim() ?? "";
  const isbn = rawIsbn ? normalizeIsbn(rawIsbn) : "";
  if (!type || !query || query.length > 200 || (type !== "music" && creator.length > 200)) return error(400, "INVALID_SEARCH", "搜索参数无效。");
  if (rawIsbn && !isbn) return error(400, "INVALID_ISBN", "ISBN 格式无效。");
  try {
    const items = await searchArtCandidates({ type, query, creator: type === "music" ? "" : creator, isbn, env });
    return json({ items });
  } catch (err) {
    console.error("Art search failed", {
      provider: err?.provider ?? "unknown",
      status: err?.status ?? 0,
      retryAfter: err?.retryAfter ?? "",
      type,
    });
    const status = err?.status === 429 ? 429 : 502;
    return error(status, status === 429 ? "SEARCH_RATE_LIMITED" : "SEARCH_FAILED", status === 429 ? "搜索服务请求过于频繁，请稍后重试。" : "搜索服务暂时不可用。");
  }
}
