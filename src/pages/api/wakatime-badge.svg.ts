import type { APIRoute } from "astro";
import { escapeXml, getCachedWakaTimeAllTime, resolveWakaTimeApiKey, svgResponse } from "../../lib/wakatime";
import { getRuntimeEnv } from "../../lib/runtime";

export const prerender = false;
export const GET: APIRoute = async () => {
  const apiKey = resolveWakaTimeApiKey(getRuntimeEnv(), import.meta.env);
  const edgeCache = (caches as CacheStorage & { default?: Cache }).default;
  const data = await getCachedWakaTimeAllTime(apiKey, { cache: edgeCache });
  if (!data) return svgResponse();
  return svgResponse(`<svg xmlns="http://www.w3.org/2000/svg" width="424" height="52" viewBox="0 0 424 52" role="img" aria-label="Code time ${escapeXml(data.duration)}">
    <g font-family="Arial,Helvetica,sans-serif" fill="#333">
      <rect x="1.5" y="1.5" width="205" height="49" rx="5" fill="#f7f7f7" stroke="#d4d4d4" stroke-width="3"/>
      <rect x="221.5" y="1.5" width="201" height="49" rx="5" fill="#f7f7f7" stroke="#d4d4d4" stroke-width="3"/>
      <circle cx="31" cy="26" r="17" fill="none" stroke="#1877a9" stroke-width="3"/>
      <path d="M35.5 19.5 27 26l8.5 6.5" fill="none" stroke="#333" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="57" y="36" font-size="29" font-weight="700">Codetime</text>
      <text x="232" y="36" font-size="28" font-weight="700">${escapeXml(data.duration)}</text>
    </g>
  </svg>`);
};
