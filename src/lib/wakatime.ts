const WAKATIME_API = "https://wakatime.com/api/v1/users/current";
export const WAKATIME_TIMEOUT_MS = 3_500;
const WAKATIME_EDGE_CACHE_SECONDS = 15 * 60;

export interface WakaTimeToday {
  duration: string;
  language: string;
  editor: string;
  lastActivity: string;
}

export interface WakaTimeAllTime {
  duration: string;
}

interface WakaTimeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

interface RequestOptions {
  fetchImpl?: typeof fetch;
  now?: Date;
  timeoutMs?: number;
}

interface WakaTimeEnv {
  WAKA_TIME_API_KEY?: unknown;
  WAKATIME_API_KEY?: unknown;
}

export function resolveWakaTimeApiKey(runtimeEnv: WakaTimeEnv, buildEnv: WakaTimeEnv = {}): string {
  for (const value of [
    runtimeEnv.WAKA_TIME_API_KEY,
    runtimeEnv.WAKATIME_API_KEY,
    buildEnv.WAKA_TIME_API_KEY,
    buildEnv.WAKATIME_API_KEY,
  ]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export async function getWakaTimeAllTime(apiKey: string, options: RequestOptions = {}): Promise<WakaTimeAllTime | undefined> {
  const key = apiKey.trim();
  if (!key) return undefined;

  const authorization = `Basic ${encodeBase64(key)}`;
  const result = await requestJson(
    `${WAKATIME_API}/all_time_since_today`,
    authorization,
    options.fetchImpl ?? fetch,
    options.timeoutMs,
    true,
  );
  const data = isRecord(result) && isRecord(result.data) ? result.data : undefined;
  if (!data || data.is_up_to_date !== true) return undefined;

  const seconds = numberValue(data.total_seconds);
  if (seconds === undefined || seconds <= 0) return undefined;
  return { duration: formatDuration(seconds) };
}

export async function getWakaTimeToday(apiKey: string, options: RequestOptions = {}): Promise<WakaTimeToday | undefined> {
  const key = apiKey.trim();
  if (!key) return undefined;

  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const authorization = `Basic ${encodeBase64(key)}`;
  const [status, durations] = await Promise.all([
    requestJson(`${WAKATIME_API}/status_bar/today`, authorization, fetchImpl, options.timeoutMs),
    requestJson(`${WAKATIME_API}/durations?date=${now.toISOString().slice(0, 10)}`, authorization, fetchImpl, options.timeoutMs),
  ]);

  if (!status || !durations) return undefined;
  const statusData = isRecord(status) && isRecord(status.data) ? status.data : {};
  const durationRows: unknown[] = isRecord(durations) && Array.isArray(durations.data) ? durations.data : Array.isArray(durations) ? durations : [];
  const seconds = numberValue(isRecord(statusData.grand_total) ? statusData.grand_total.total_seconds : undefined)
    ?? durationRows.reduce<number>((total, row) => total + (numberValue(isRecord(row) ? row.duration : undefined) ?? 0), 0);

  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const lastRow = durationRows.findLast((row: unknown) => isRecord(row) && numberValue(row.time) !== undefined);
  const lastTime = isRecord(lastRow) ? numberValue(lastRow.time) : undefined;

  return {
    duration: formatDuration(seconds),
    language: firstNamedValue(statusData.languages) ?? "No language data",
    editor: firstNamedValue(statusData.editors) ?? firstNamedValue(statusData.machines) ?? "No editor data",
    lastActivity: formatLastActivity(lastTime === undefined ? now : new Date(lastTime * 1000)),
  };
}

export async function getCachedWakaTimeToday(
  apiKey: string,
  options: RequestOptions & { cache?: WakaTimeCache } = {},
): Promise<WakaTimeToday | undefined> {
  const key = apiKey.trim();
  if (!key) return undefined;

  const cache = options.cache;
  const cacheRequest = new Request("https://wakatime-cache.internal/today");
  if (cache) {
    try {
      const cached = await cache.match(cacheRequest);
      if (cached?.ok) return await cached.json() as WakaTimeToday;
    } catch {}
  }

  const data = await getWakaTimeToday(key, options);
  if (!data || !cache) return data;
  try {
    await cache.put(cacheRequest, new Response(JSON.stringify(data), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": `public, max-age=${WAKATIME_EDGE_CACHE_SECONDS}`,
      },
    }));
  } catch {}
  return data;
}

export async function getCachedWakaTimeAllTime(
  apiKey: string,
  options: RequestOptions & { cache?: WakaTimeCache } = {},
): Promise<WakaTimeAllTime | undefined> {
  const key = apiKey.trim();
  if (!key) return undefined;

  const cache = options.cache;
  const cacheRequest = new Request("https://wakatime-cache.internal/all-time");
  if (cache) {
    try {
      const cached = await cache.match(cacheRequest);
      if (cached?.ok) return await cached.json() as WakaTimeAllTime;
    } catch {}
  }

  const data = await getWakaTimeAllTime(key, options);
  if (!data || !cache) return data;
  try {
    await cache.put(cacheRequest, new Response(JSON.stringify(data), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": `public, max-age=${WAKATIME_EDGE_CACHE_SECONDS}`,
      },
    }));
  } catch {}
  return data;
}

async function requestJson(
  url: string,
  authorization: string,
  fetchImpl: typeof fetch,
  timeoutMs = WAKATIME_TIMEOUT_MS,
  rejectAccepted = false,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { authorization, accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok || (rejectAccepted && response.status === 202)) return undefined;
    const value = await response.json();
    return isRecord(value) || Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function firstNamedValue(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const first = value.find((item) => isRecord(item) && typeof item.name === "string" && item.name.trim());
  return isRecord(first) ? first.name.trim() : undefined;
}

function formatDuration(seconds: number) {
  const roundedMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatLastActivity(date: Date) {
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export function svgResponse(svg?: string) {
  return new Response(svg ? svg : null, {
    status: svg ? 200 : 204,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": svg ? "public, max-age=300, s-maxage=900, stale-while-revalidate=86400" : "public, max-age=60, s-maxage=60",
      "x-content-type-options": "nosniff",
    },
  });
}

export const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
