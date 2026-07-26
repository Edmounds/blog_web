export interface GitHubContributionCell {
  count: number;
  date: string;
  dayIndex: number;
  isBlank: boolean;
  label: string;
  level: number;
  weekIndex: number;
}

export interface GitHubContributionHeatmap {
  days: GitHubContributionCell[];
  months: GitHubContributionMonth[];
  rangeEnd: string;
  rangeStart: string;
  total: number;
  weekCount: number;
}

export interface GitHubContributionMonth {
  label: string;
  weekIndex: number;
}

interface ParsedGitHubContributionDay {
  count: number;
  date: string;
  label: string;
  level: number;
}

interface GitHubContributionCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

interface GitHubContributionOptions {
  cache?: GitHubContributionCache;
  fetchImpl?: typeof fetch;
  now?: Date;
  timeoutMs?: number;
  token?: string;
}

const CACHE_SECONDS = 6 * 60 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;
const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

function clampContributionLevel(level: number) {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(4, Math.trunc(level)));
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, codePoint: string) => String.fromCodePoint(Number(codePoint)))
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint: string) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeText(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getHtmlAttribute(attributes: string, name: string) {
  const match = attributes.match(new RegExp(`\\b${escapeRegExp(name)}="([^"]*)"`, "i"));
  return match?.[1] ? decodeHtmlEntities(match[1]) : "";
}

function getContributionLabel(count: number, date: Date) {
  if (count <= 0) return `No contributions on ${dateFormatter.format(date)}.`;
  return `${count.toLocaleString("en-US")} ${count === 1 ? "contribution" : "contributions"} on ${dateFormatter.format(date)}.`;
}

function parseContributionCount(label: string) {
  if (/^No contributions\b/i.test(label)) return 0;
  const match = label.match(/^([\d,]+)\s+contributions?\b/i);
  const count = match?.[1] ? Number.parseInt(match[1].replace(/,/g, ""), 10) : 0;
  return Number.isFinite(count) ? count : 0;
}

export function parseGitHubContributionHtml(html: string): ParsedGitHubContributionDay[] {
  const days: ParsedGitHubContributionDay[] = [];
  const pattern = /<td\b([^>]*)><\/td>\s*(?:<tool-tip\b[^>]*>([\s\S]*?)<\/tool-tip>)?/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html))) {
    const attributes = match[1] ?? "";
    if (!/\bContributionCalendar-day\b/.test(getHtmlAttribute(attributes, "class"))) continue;
    const date = getHtmlAttribute(attributes, "data-date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const label = normalizeText(match[2] ?? "") || getContributionLabel(0, new Date(`${date}T00:00:00.000Z`));
    days.push({
      count: parseContributionCount(label),
      date,
      label,
      level: clampContributionLevel(Number.parseInt(getHtmlAttribute(attributes, "data-level"), 10)),
    });
  }

  return days;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, count: number) {
  return new Date(date.getTime() + count * DAY_MS);
}

function formatUtcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getUtcWeekStart(date: Date) {
  return addUtcDays(date, -date.getUTCDay());
}

export function createGitHubContributionHeatmap(
  contributions: ParsedGitHubContributionDay[],
  now = new Date(),
): GitHubContributionHeatmap {
  const contributionsByDate = new Map(contributions.map((day) => [day.date, day]));
  const rangeEndDate = startOfUtcDay(now);
  const rangeStartDate = addUtcDays(rangeEndDate, -364);
  const calendarStartDate = getUtcWeekStart(rangeStartDate);
  const weekCount = Math.ceil(((rangeEndDate.getTime() - calendarStartDate.getTime()) / DAY_MS + 1) / 7);
  const days: GitHubContributionCell[] = [];
  const months: GitHubContributionMonth[] = [];
  const labeledMonths = new Set<string>();
  let total = 0;

  for (let index = 0; index < weekCount * 7; index += 1) {
    const date = addUtcDays(calendarStartDate, index);
    const dateKey = formatUtcDateKey(date);
    const isBlank = date < rangeStartDate || date > rangeEndDate;
    const contribution = contributionsByDate.get(dateKey);
    const count = isBlank ? 0 : contribution?.count ?? 0;
    const weekIndex = Math.floor(index / 7);
    const monthKey = dateKey.slice(0, 7);

    if (!isBlank && !labeledMonths.has(monthKey) && (date.getUTCDate() <= 7 || date.getTime() === rangeStartDate.getTime())) {
      labeledMonths.add(monthKey);
      const label = { label: monthFormatter.format(date), weekIndex };
      const existingIndex = months.findIndex((month) => month.weekIndex === weekIndex);
      if (existingIndex >= 0) months[existingIndex] = label;
      else months.push(label);
    }
    total += count;
    days.push({
      count,
      date: dateKey,
      dayIndex: date.getUTCDay(),
      isBlank,
      label: isBlank ? "" : contribution?.label ?? getContributionLabel(count, date),
      level: isBlank ? 0 : contribution?.level ?? 0,
      weekIndex,
    });
  }

  return {
    days,
    months,
    rangeEnd: formatUtcDateKey(rangeEndDate),
    rangeStart: formatUtcDateKey(rangeStartDate),
    total,
    weekCount,
  };
}

export function createGitHubContributionHeatmapSkeleton(now = new Date()) {
  return createGitHubContributionHeatmap([], now);
}

async function fetchContributionYear(username: string, year: number, options: GitHubContributionOptions) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? FETCH_TIMEOUT_MS);
  const headers: Record<string, string> = { accept: "text/html", "user-agent": "blog.muelsyse.us" };
  if (options.token?.trim()) headers.authorization = `Bearer ${options.token.trim()}`;
  const params = new URLSearchParams({ from: `${year}-01-01`, to: `${year}-12-31` });

  try {
    const response = await (options.fetchImpl ?? fetch)(
      `https://github.com/users/${encodeURIComponent(username)}/contributions?${params}`,
      { headers, signal: controller.signal },
    );
    if (!response.ok) return [];
    return parseGitHubContributionHtml(await response.text());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function getGitHubContributionHeatmap(username: string, options: GitHubContributionOptions = {}) {
  const normalizedUsername = username.trim();
  if (!USERNAME_PATTERN.test(normalizedUsername)) return undefined;
  const now = options.now ?? new Date();
  const skeleton = createGitHubContributionHeatmapSkeleton(now);
  const startYear = Number(skeleton.rangeStart.slice(0, 4));
  const endYear = Number(skeleton.rangeEnd.slice(0, 4));
  const yearResults = await Promise.all(
    Array.from({ length: endYear - startYear + 1 }, (_, index) => fetchContributionYear(normalizedUsername, startYear + index, options)),
  );
  const days = yearResults.flat();
  return days.length > 0 ? createGitHubContributionHeatmap(days, now) : undefined;
}

export async function getCachedGitHubContributionHeatmap(username: string, options: GitHubContributionOptions = {}) {
  const key = new Request(`https://github-contributions-cache.internal/v2/${encodeURIComponent(username)}`);
  if (options.cache) {
    try {
      const cached = await options.cache.match(key);
      if (cached?.ok) return await cached.json() as GitHubContributionHeatmap;
    } catch {}
  }

  const heatmap = await getGitHubContributionHeatmap(username, options);
  if (!heatmap || !options.cache) return heatmap;
  try {
    await options.cache.put(key, new Response(JSON.stringify(heatmap), {
      headers: { "content-type": "application/json", "cache-control": `public, max-age=${CACHE_SECONDS}` },
    }));
  } catch {}
  return heatmap;
}
