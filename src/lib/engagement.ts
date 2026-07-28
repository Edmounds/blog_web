import { CONTENT_IDS } from "./post-slugs.ts";

const CONTENT_ID_PATTERN = /^(blog|note|project)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VIEW_WINDOW_SECONDS = 6 * 60 * 60;
const VIEW_PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;
let nextViewPruneAt = 0;

export function normalizeContentId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const contentId = value.trim().replace(/^\/+|\/+$/g, "");
  if (!CONTENT_ID_PATTERN.test(contentId)) return undefined;
  if (!(CONTENT_IDS as readonly string[]).includes(contentId)) return undefined;

  return contentId;
}

export function getViewWindowStart(now = Date.now()): number {
  const seconds = Math.floor(now / 1000);
  return Math.floor(seconds / VIEW_WINDOW_SECONDS) * VIEW_WINDOW_SECONDS;
}

export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export function requireDb(env: Record<string, unknown>): D1Database {
  if (!env?.DB) {
    throw new Response(
      JSON.stringify({
        error: {
          code: "DB_NOT_CONFIGURED",
          message: "Statistics database is not configured.",
        },
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
      },
    );
  }

  return env.DB as D1Database;
}

export async function readBodyContentId(request: Request): Promise<string | undefined> {
  let body: { contentId?: string };

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  return normalizeContentId(body?.contentId);
}

export function requireSameOriginJson(request: Request): void {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const origin = request.headers.get("origin");
  const isSameOrigin = !origin || origin === new URL(request.url).origin;
  const isCrossSite = request.headers.get("sec-fetch-site") === "cross-site";
  if (contentType === "application/json" && isSameOrigin && !isCrossSite) return;

  throw errorResponse(403, "FORBIDDEN_REQUEST", "A same-origin JSON request is required.");
}

export function readQueryContentId(request: Request): string | undefined {
  const url = new URL(request.url);
  return normalizeContentId(url.searchParams.get("contentId"));
}

export async function ensureStatsRow(db: D1Database, contentId: string): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO post_stats (slug, views, likes, updated_at)
       VALUES (?, 0, 0, CURRENT_TIMESTAMP)`,
    )
    .bind(contentId)
    .run();
}

export interface PostStats {
  contentId: string;
  views: number;
  likes: number;
}

export async function getStats(db: D1Database, contentId: string): Promise<PostStats> {
  await ensureStatsRow(db, contentId);

  const row = await db
    .prepare(
      `SELECT slug, views, likes
       FROM post_stats
       WHERE slug = ?`,
    )
    .bind(contentId)
    .first();

  return {
    contentId,
    views: Number(row?.views ?? 0),
    likes: Number(row?.likes ?? 0),
  };
}

export async function incrementLike(db: D1Database, contentId: string): Promise<PostStats> {
  await ensureStatsRow(db, contentId);
  const row = await db
    .prepare(
      `UPDATE post_stats
       SET likes = likes + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE slug = ?
       RETURNING slug, views, likes`,
    )
    .bind(contentId)
    .first();

  return statsFromRow(contentId, row);
}

export async function recordView(
  db: D1Database,
  request: Request,
  contentId: string,
): Promise<PostStats & { counted: boolean }> {
  await ensureStatsRow(db, contentId);

  const visitorHash = await getVisitorHash(request, contentId);
  const windowStart = getViewWindowStart();
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO post_view_events (slug, visitor_hash, window_start)
       VALUES (?, ?, ?)`,
    )
    .bind(contentId, visitorHash, windowStart)
    .run();

  const counted = Number(result?.meta?.changes ?? 0) > 0;

  if (counted) {
    const row = await db
      .prepare(
        `UPDATE post_stats
         SET views = views + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE slug = ?
         RETURNING slug, views, likes`,
      )
      .bind(contentId)
      .first();

    return { ...statsFromRow(contentId, row), counted };
  }

  return {
    ...(await getStats(db, contentId)),
    counted,
  };
}

export function scheduleViewEventPrune(
  db: D1Database,
  context: { waitUntil(promise: Promise<unknown>): void } | undefined,
  now = Date.now(),
): boolean {
  if (!context || now < nextViewPruneAt) return false;
  nextViewPruneAt = now + VIEW_PRUNE_INTERVAL_MS;
  try {
    context.waitUntil(pruneOldViewEvents(db).catch(() => {}));
    return true;
  } catch {
    nextViewPruneAt = 0;
    return false;
  }
}

export function resetViewPruneScheduleForTests(): void {
  nextViewPruneAt = 0;
}

async function pruneOldViewEvents(db: D1Database): Promise<void> {
  const minimumWindow = getViewWindowStart() - VIEW_WINDOW_SECONDS * 8;
  await db
    .prepare(
      `DELETE FROM post_view_events
       WHERE window_start < ?`,
    )
    .bind(minimumWindow)
    .run();
}

function statsFromRow(contentId: string, row: Record<string, unknown> | null): PostStats {
  return { contentId, views: Number(row?.views ?? 0), likes: Number(row?.likes ?? 0) };
}

export async function getVisitorHash(request: Request, contentId: string): Promise<string> {
  const ip = getClientAddress(request);
  const userAgent = request.headers.get("user-agent") ?? "";
  const value = `${contentId}:${ip}:${userAgent}`;
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getClientAddress(request: Request): string {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || "unknown";
}
