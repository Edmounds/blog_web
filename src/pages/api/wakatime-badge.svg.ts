import type { APIRoute } from "astro";
import { escapeXml, getCachedWakaTimeAllTime, resolveWakaTimeApiKey, svgResponse } from "../../lib/wakatime";
import { getRuntimeEnv } from "../../lib/runtime";

export const prerender = false;
export const GET: APIRoute = async () => {
  const apiKey = resolveWakaTimeApiKey(getRuntimeEnv(), import.meta.env);
  const edgeCache = (caches as CacheStorage & { default?: Cache }).default;
  const data = await getCachedWakaTimeAllTime(apiKey, { cache: edgeCache });
  if (!data) return svgResponse();
  return svgResponse(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="28" viewBox="0 0 240 28" role="img" aria-label="Code time ${escapeXml(data.duration)}">
    <text x="120" y="20" fill="#333" font-family="Arial,Helvetica,sans-serif" font-size="16" text-anchor="middle">Codetime ${escapeXml(data.duration)}</text>
  </svg>`);
};
