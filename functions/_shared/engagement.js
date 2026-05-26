import { POST_SLUGS } from "./post-slugs.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VIEW_WINDOW_SECONDS = 6 * 60 * 60;

export function normalizeSlug(value) {
  if (typeof value !== "string") return undefined;

  const slug = value.trim().replace(/^\/+|\/+$/g, "");
  if (!SLUG_PATTERN.test(slug)) return undefined;
  if (!POST_SLUGS.includes(slug)) return undefined;

  return slug;
}

export function getViewWindowStart(now = Date.now()) {
  const seconds = Math.floor(now / 1000);
  return Math.floor(seconds / VIEW_WINDOW_SECONDS) * VIEW_WINDOW_SECONDS;
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function error(status, code, message) {
  return json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export function requireDb(env) {
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

  return env.DB;
}

export async function readBodySlug(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  return normalizeSlug(body?.slug);
}

export function readQuerySlug(request) {
  const url = new URL(request.url);
  return normalizeSlug(url.searchParams.get("slug"));
}

export async function ensureStatsRow(db, slug) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO post_stats (slug, views, likes, updated_at)
       VALUES (?, 0, 0, CURRENT_TIMESTAMP)`,
    )
    .bind(slug)
    .run();
}

export async function getStats(db, slug) {
  await ensureStatsRow(db, slug);

  const row = await db
    .prepare(
      `SELECT slug, views, likes
       FROM post_stats
       WHERE slug = ?`,
    )
    .bind(slug)
    .first();

  return {
    slug,
    views: Number(row?.views ?? 0),
    likes: Number(row?.likes ?? 0),
  };
}

export async function incrementLike(db, slug) {
  await ensureStatsRow(db, slug);
  await db
    .prepare(
      `UPDATE post_stats
       SET likes = likes + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE slug = ?`,
    )
    .bind(slug)
    .run();

  return getStats(db, slug);
}

export async function recordView(db, request, slug) {
  await ensureStatsRow(db, slug);
  await pruneOldViewEvents(db);

  const visitorHash = await getVisitorHash(request, slug);
  const windowStart = getViewWindowStart();
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO post_view_events (slug, visitor_hash, window_start)
       VALUES (?, ?, ?)`,
    )
    .bind(slug, visitorHash, windowStart)
    .run();

  const counted = Number(result?.meta?.changes ?? 0) > 0;

  if (counted) {
    await db
      .prepare(
        `UPDATE post_stats
         SET views = views + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE slug = ?`,
      )
      .bind(slug)
      .run();
  }

  return {
    ...(await getStats(db, slug)),
    counted,
  };
}

async function pruneOldViewEvents(db) {
  const minimumWindow = getViewWindowStart() - VIEW_WINDOW_SECONDS * 8;
  await db
    .prepare(
      `DELETE FROM post_view_events
       WHERE window_start < ?`,
    )
    .bind(minimumWindow)
    .run();
}

async function getVisitorHash(request, slug) {
  const ip = getClientAddress(request);
  const userAgent = request.headers.get("user-agent") ?? "";
  const value = `${slug}:${ip}:${userAgent}`;
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getClientAddress(request) {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || "unknown";
}
