import type { APIRoute } from "astro";
import { escapeXml, getCachedWakaTimeAllTime, resolveWakaTimeApiKey, svgResponse } from "../../lib/wakatime";
import { getRuntimeEnv } from "../../lib/runtime";

export const prerender = false;
export const GET: APIRoute = async () => {
  const apiKey = resolveWakaTimeApiKey(getRuntimeEnv(), import.meta.env);
  const edgeCache = (caches as CacheStorage & { default?: Cache }).default;
  const data = await getCachedWakaTimeAllTime(apiKey, { cache: edgeCache });
  if (!data) return svgResponse();
  return svgResponse(`<svg class="lucide lucide-timer" xmlns="http://www.w3.org/2000/svg" width="320" height="32" viewBox="0 0 320 32" role="img" aria-label="${escapeXml(data.duration)}"><rect width="320" height="32" rx="6" fill="#111"/><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(10 5) scale(.9)"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></g><text x="42" y="21" fill="#fff" font-family="Arial,sans-serif" font-size="13">${escapeXml(data.duration)}</text></svg>`);
};
