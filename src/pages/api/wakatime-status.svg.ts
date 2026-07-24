import type { APIRoute } from "astro";
import { escapeXml, getCachedWakaTimeToday, resolveWakaTimeApiKey, svgResponse } from "../../lib/wakatime";
import { getRuntimeEnv } from "../../lib/runtime";

export const prerender = false;
export const GET: APIRoute = async () => {
  const apiKey = resolveWakaTimeApiKey(getRuntimeEnv(), import.meta.env);
  const edgeCache = (caches as CacheStorage & { default?: Cache }).default;
  const data = await getCachedWakaTimeToday(apiKey, { cache: edgeCache });
  if (!data) return svgResponse();
  return svgResponse(`<svg xmlns="http://www.w3.org/2000/svg" width="380" height="116" viewBox="0 0 380 116" role="img" aria-label="WakaTime status"><rect width="380" height="116" rx="8" fill="#111"/><text x="20" y="31" fill="#fff" font-family="Arial,sans-serif" font-size="15" font-weight="700">Today's coding</text><text x="20" y="59" fill="#ddd" font-family="Arial,sans-serif" font-size="13">Time: ${escapeXml(data.duration)}</text><text x="20" y="81" fill="#ddd" font-family="Arial,sans-serif" font-size="13">Language: ${escapeXml(data.language)} · Editor: ${escapeXml(data.editor)}</text><text x="20" y="101" fill="#999" font-family="Arial,sans-serif" font-size="12">Last activity ${escapeXml(data.lastActivity)}</text></svg>`);
};
