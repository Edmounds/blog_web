import type { APIRoute } from "astro";
import { escapeXml, getCachedWakaTimeAllTime, resolveWakaTimeApiKey, svgResponse } from "../../lib/wakatime";
import { getRuntimeEnv } from "../../lib/runtime";

export const prerender = false;
export const GET: APIRoute = async () => {
  const apiKey = resolveWakaTimeApiKey(getRuntimeEnv(), import.meta.env);
  const edgeCache = (caches as CacheStorage & { default?: Cache }).default;
  const data = await getCachedWakaTimeAllTime(apiKey, { cache: edgeCache });
  if (!data) return svgResponse();
  return svgResponse(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="24" viewBox="0 0 160 24" role="img" aria-label="Code time ${escapeXml(data.duration)}"><g fill="#111"><path d="M12 0a12 12 0 1 0 0 24a12 12 0 0 0 0-24m0 2.824a9.176 9.176 0 1 1 0 18.352a9.176 9.176 0 0 1 0-18.352m5.097 5.058c-.327 0-.61.19-.764.45l-3.288 4.706-.387-.636a.9.9 0 0 0-.759-.439.9.9 0 0 0-.788.492l-.357.581-1.992-2.943a.9.9 0 0 0-.761-.446c-.514 0-.903.452-.903.96a1 1 0 0 0 .207.61l2.719 3.96c.152.272.44.47.776.47a.91.91 0 0 0 .787-.483l.314-.504.324.52.087.13.078.085.058.052.115.08.076.04.088.035.18.04.092.005c.29 0 .546-.149.707-.36l4.099-5.849A1 1 0 0 0 18 8.842c0-.508-.389-.96-.903-.96"/><text x="32" y="16.5" font-family="Arial,sans-serif" font-size="13"><tspan font-weight="600">CodeTime</tspan><tspan dx="7">${escapeXml(data.duration)}</tspan></text></g></svg>`);
};
