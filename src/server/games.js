export const STEAM_ID = "76561198437201442";
export const STEAM_API_URL = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/";
export const STEAM_COVER_HOST = "shared.akamai.steamstatic.com";
export const GAME_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_GAME_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_GAME_BODY_BYTES = 14 * 1024 * 1024;

const GAME_IMAGE_TYPE_SET = new Set(GAME_IMAGE_TYPES);
const GAME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GAME_COVER_KEY_PATTERN = /^game\/[a-f0-9-]+\.(?:jpg|png|webp|avif)$/i;

export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(status, code, message) {
  return json({ error: { code, message } }, { status });
}

export function requireDb(env) {
  if (!env?.DB) throw error(500, "DB_NOT_CONFIGURED", "游戏数据库未配置。");
  return env.DB;
}

export function requireBucket(env) {
  if (!env?.ART_COVERS) throw error(500, "R2_NOT_CONFIGURED", "游戏封面存储未配置。");
  return env.ART_COVERS;
}

export function requireSameOrigin(request) {
  const origin = request.headers.get("origin");
  const isSameOrigin = !origin || origin === new URL(request.url).origin;
  const isCrossSite = request.headers.get("sec-fetch-site") === "cross-site";
  if (isSameOrigin && !isCrossSite) return;
  throw error(403, "FORBIDDEN_REQUEST", "需要同源请求。");
}

export function requireSameOriginJson(request) {
  requireSameOrigin(request);
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw error(403, "FORBIDDEN_REQUEST", "需要同源 JSON 请求。");
}

export async function readJson(request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_GAME_BODY_BYTES) throw error(413, "BODY_TOO_LARGE", "请求数据超过大小限制。");
  try {
    return await request.json();
  } catch {
    throw error(400, "INVALID_JSON", "请求数据格式无效。");
  }
}

export function normalizeGameId(value) {
  if (typeof value !== "string") return undefined;
  const id = value.trim();
  return id.length <= 100 && GAME_ID_PATTERN.test(id) ? id : undefined;
}

export function normalizeStoredGameCoverKey(value) {
  if (typeof value !== "string") return undefined;
  const key = value.trim();
  return GAME_COVER_KEY_PATTERN.test(key) ? key : undefined;
}

export function getGameCoverUrl(key) {
  return `/media/game/${String(key).replace(/^game\//, "")}`;
}

export function getSteamCoverUrl(appId) {
  return `https://${STEAM_COVER_HOST}/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
}

export function getSteamStoreUrl(appId) {
  return `https://store.steampowered.com/app/${appId}/`;
}

export function validateGameCreate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("INVALID_GAME", "游戏数据无效。");
  const title = cleanText(value.title, 200);
  if (!title) return invalid("INVALID_TITLE", "请填写游戏标题。");
  const customPlaytimeMinutes = parsePlaytimeMinutes(value.customPlaytimeHours, { required: true });
  if (!customPlaytimeMinutes.ok) return customPlaytimeMinutes;
  const coverKey = normalizeStoredGameCoverKey(value.coverKey);
  if (!coverKey) return invalid("MANUAL_COVER_REQUIRED", "手动游戏必须上传竖版封面。");
  if (typeof value.isVisible !== "boolean") return invalid("INVALID_VISIBILITY", "显示状态无效。");
  return { ok: true, value: { title, customPlaytimeMinutes: customPlaytimeMinutes.value, coverKey, isVisible: value.isVisible } };
}

export function validateGameUpdate(value, current) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("INVALID_GAME", "游戏数据无效。");
  const result = {};
  if (Object.hasOwn(value, "title")) {
    if (current.source !== "manual") return invalid("STEAM_TITLE_READ_ONLY", "Steam 游戏标题由同步维护。");
    const title = cleanText(value.title, 200);
    if (!title) return invalid("INVALID_TITLE", "请填写游戏标题。");
    result.title = title;
  }
  if (Object.hasOwn(value, "customPlaytimeHours")) {
    const playtime = parsePlaytimeMinutes(value.customPlaytimeHours, { required: current.source === "manual" });
    if (!playtime.ok) return playtime;
    result.customPlaytimeMinutes = playtime.value;
  }
  if (Object.hasOwn(value, "coverKey")) {
    if (value.coverKey == null || value.coverKey === "") {
      if (current.source === "manual") return invalid("MANUAL_COVER_REQUIRED", "手动游戏必须保留封面。");
      result.coverKey = null;
    } else {
      const coverKey = normalizeStoredGameCoverKey(value.coverKey);
      if (!coverKey) return invalid("INVALID_STORED_COVER", "已上传封面无效。");
      result.coverKey = coverKey;
    }
  }
  if (Object.hasOwn(value, "isVisible")) {
    if (typeof value.isVisible !== "boolean") return invalid("INVALID_VISIBILITY", "显示状态无效。");
    result.isVisible = value.isVisible;
  }
  if (Object.keys(result).length === 0) return invalid("EMPTY_UPDATE", "没有可更新的字段。");
  return { ok: true, value: result };
}

export function parsePlaytimeMinutes(value, { required = false } = {}) {
  if (value == null || value === "") {
    return required ? invalid("INVALID_PLAYTIME", "请填写非负游玩时长。") : { ok: true, value: null };
  }
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d+(?:\.\d)?$/.test(text)) return invalid("INVALID_PLAYTIME", "游玩时长需为非负小时，最多一位小数。");
  const hours = Number(text);
  if (!Number.isFinite(hours) || hours < 0 || hours > 1_000_000) return invalid("INVALID_PLAYTIME", "游玩时长无效。");
  return { ok: true, value: Math.round(hours * 60) };
}

export function parseSteamOwnedGames(payload) {
  const games = payload?.response?.games;
  if (!Array.isArray(games)) throw new Error("Steam returned an invalid games response.");
  const unique = new Map();
  for (const raw of games) {
    const appId = Number(raw?.appid);
    const title = cleanText(raw?.name, 200);
    const playtimeMinutes = Number(raw?.playtime_forever);
    if (!Number.isInteger(appId) || appId <= 0 || !title || !Number.isFinite(playtimeMinutes) || playtimeMinutes < 0) {
      throw new Error("Steam returned an invalid game entry.");
    }
    unique.set(appId, { appId, title, playtimeMinutes: Math.floor(playtimeMinutes) });
  }
  return [...unique.values()];
}

export async function fetchSteamOwnedGames(apiKey, fetchImpl = fetch) {
  if (typeof apiKey !== "string" || !apiKey.trim()) throw syncError("STEAM_API_KEY_MISSING", "Steam API Key 未配置。");
  const url = new URL(STEAM_API_URL);
  url.searchParams.set("key", apiKey.trim());
  url.searchParams.set("steamid", STEAM_ID);
  url.searchParams.set("include_appinfo", "true");
  url.searchParams.set("include_played_free_games", "true");
  url.searchParams.set("format", "json");
  let response;
  try {
    response = await fetchImpl(url, { headers: { accept: "application/json" } });
  } catch {
    throw syncError("STEAM_FETCH_FAILED", "暂时无法连接 Steam。");
  }
  if (!response.ok) throw syncError("STEAM_FETCH_FAILED", `Steam 同步失败（HTTP ${response.status}）。`);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw syncError("STEAM_INVALID_RESPONSE", "Steam 返回了无效数据。");
  }
  try {
    return parseSteamOwnedGames(payload);
  } catch {
    throw syncError("STEAM_INVALID_RESPONSE", "Steam 返回了无效数据。");
  }
}

export async function syncSteamGames(env, { fetchImpl = fetch, now = new Date() } = {}) {
  const db = requireDb(env);
  const attemptedAt = now.toISOString();
  await recordSyncAttempt(db, attemptedAt);
  try {
    const games = await fetchSteamOwnedGames(env?.STEAM_API_KEY, fetchImpl);
    const existing = await listSteamGameRows(db);
    const existingByAppId = new Map(existing.map((row) => [Number(row.steam_app_id), row]));
    let added = 0;
    let updated = 0;
    let unchanged = 0;
    const statements = [];
    for (const game of games) {
      const current = existingByAppId.get(game.appId);
      if (!current) {
        added += 1;
        statements.push(db.prepare(
          `INSERT INTO game_items
           (id, source, steam_app_id, title, steam_playtime_minutes, custom_playtime_minutes, is_visible, cover_key, last_seen_at, created_at, updated_at)
           VALUES (?, 'steam', ?, ?, ?, NULL, 1, NULL, ?, ?, ?)`,
        ).bind(crypto.randomUUID(), game.appId, game.title, game.playtimeMinutes, attemptedAt, attemptedAt, attemptedAt));
      } else if (current.title !== game.title || Number(current.steam_playtime_minutes) !== game.playtimeMinutes) {
        updated += 1;
        statements.push(db.prepare(
          "UPDATE game_items SET title = ?, steam_playtime_minutes = ?, last_seen_at = ?, updated_at = ? WHERE id = ?",
        ).bind(game.title, game.playtimeMinutes, attemptedAt, attemptedAt, current.id));
      } else {
        unchanged += 1;
        statements.push(db.prepare("UPDATE game_items SET last_seen_at = ? WHERE id = ?").bind(attemptedAt, current.id));
      }
    }
    await db.batch(statements);
    await db.prepare(
      "UPDATE game_sync_state SET last_attempt_at = ?, last_success_at = ?, last_synced_count = ?, last_error = NULL WHERE id = 1",
    ).bind(attemptedAt, attemptedAt, games.length).run();
    return { added, updated, unchanged, total: games.length, syncedAt: attemptedAt };
  } catch (err) {
    const publicError = normalizeSyncError(err);
    try {
      await recordSyncFailure(db, attemptedAt, publicError.message);
    } catch (stateError) {
      console.error("Steam sync failure state could not be recorded", stateError);
    }
    throw publicError;
  }
}

export async function listGames(db, { query = "", source, visibility } = {}) {
  const clauses = [];
  const args = [];
  if (query) { clauses.push("title LIKE ? ESCAPE '\\'"); args.push(`%${escapeLike(query)}%`); }
  if (source === "steam" || source === "manual") { clauses.push("source = ?"); args.push(source); }
  if (visibility === "visible" || visibility === "hidden") { clauses.push("is_visible = ?"); args.push(visibility === "visible" ? 1 : 0); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = (await db.prepare(
    `SELECT * FROM game_items ${where}
     ORDER BY COALESCE(custom_playtime_minutes, steam_playtime_minutes) DESC, title COLLATE NOCASE ASC, id ASC`,
  ).bind(...args).all()).results ?? [];
  return rows.map(toGameItem);
}

export async function listPublicGames(db) {
  return listGames(db, { visibility: "visible" });
}

export async function getGame(db, id) {
  const row = await db.prepare("SELECT * FROM game_items WHERE id = ?").bind(id).first();
  return row ? toGameItem(row) : undefined;
}

export async function getSyncState(db) {
  const row = await db.prepare("SELECT * FROM game_sync_state WHERE id = 1").first();
  return {
    lastAttemptAt: row?.last_attempt_at ?? null,
    lastSuccessAt: row?.last_success_at ?? null,
    lastSyncedCount: Number(row?.last_synced_count ?? 0),
    lastError: row?.last_error ?? null,
  };
}

export async function createManualGame(db, input, { id = crypto.randomUUID(), now = new Date() } = {}) {
  const createdAt = now.toISOString();
  await db.prepare(
    `INSERT INTO game_items
     (id, source, steam_app_id, title, steam_playtime_minutes, custom_playtime_minutes, is_visible, cover_key, last_seen_at, created_at, updated_at)
     VALUES (?, 'manual', NULL, ?, 0, ?, ?, ?, NULL, ?, ?)`,
  ).bind(id, input.title, input.customPlaytimeMinutes, input.isVisible ? 1 : 0, input.coverKey, createdAt, createdAt).run();
  return getGame(db, id);
}

export async function updateGame(db, id, input, now = new Date()) {
  const sets = [];
  const args = [];
  for (const [field, column] of [["title", "title"], ["customPlaytimeMinutes", "custom_playtime_minutes"], ["coverKey", "cover_key"]]) {
    if (Object.hasOwn(input, field)) { sets.push(`${column} = ?`); args.push(input[field]); }
  }
  if (Object.hasOwn(input, "isVisible")) { sets.push("is_visible = ?"); args.push(input.isVisible ? 1 : 0); }
  sets.push("updated_at = ?");
  args.push(now.toISOString(), id);
  await db.prepare(`UPDATE game_items SET ${sets.join(", ")} WHERE id = ?`).bind(...args).run();
  return getGame(db, id);
}

export async function deleteManualGame(db, id) {
  const result = await db.prepare("DELETE FROM game_items WHERE id = ? AND source = 'manual'").bind(id).run();
  return Number(result.meta?.changes ?? 0) > 0;
}

export async function isGameCoverReferenced(db, key, excludedItemId) {
  const query = excludedItemId
    ? db.prepare("SELECT id FROM game_items WHERE cover_key = ? AND id != ? LIMIT 1").bind(key, excludedItemId)
    : db.prepare("SELECT id FROM game_items WHERE cover_key = ? LIMIT 1").bind(key);
  return Boolean(await query.first());
}

export async function storeUploadedGameCover(bucket, file, now = new Date()) {
  const mime = normalizeImageType(file?.type);
  if (!mime || typeof file?.arrayBuffer !== "function") throw error(400, "INVALID_COVER_UPLOAD", "上传封面无效。");
  if (Number(file.size ?? 0) > MAX_GAME_IMAGE_BYTES) throw error(413, "COVER_TOO_LARGE", "封面不能超过 10 MB。");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_GAME_IMAGE_BYTES) throw error(413, "COVER_TOO_LARGE", "封面不能超过 10 MB。");
  if (!matchesImageSignature(bytes, mime)) throw error(400, "INVALID_COVER_CONTENT", "封面内容与图片格式不符。");
  const key = `game/${crypto.randomUUID()}.${imageExtension(mime)}`;
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: mime, cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: { uploadedAt: now.toISOString() },
  });
  return { key, url: getGameCoverUrl(key), mime };
}

function toGameItem(row) {
  const steamAppId = row.steam_app_id == null ? null : Number(row.steam_app_id);
  const customPlaytimeMinutes = row.custom_playtime_minutes == null ? null : Number(row.custom_playtime_minutes);
  const steamPlaytimeMinutes = Number(row.steam_playtime_minutes ?? 0);
  const coverKey = row.cover_key ?? null;
  return {
    id: row.id,
    source: row.source,
    steamAppId,
    title: row.title,
    steamPlaytimeMinutes,
    customPlaytimeMinutes,
    playtimeMinutes: customPlaytimeMinutes ?? steamPlaytimeMinutes,
    isVisible: Number(row.is_visible) === 1,
    coverKey,
    cover: coverKey ? getGameCoverUrl(coverKey) : steamAppId ? getSteamCoverUrl(steamAppId) : "/images/placeholders/default-cover.webp",
    defaultCover: steamAppId ? getSteamCoverUrl(steamAppId) : "/images/placeholders/default-cover.webp",
    storeUrl: steamAppId ? getSteamStoreUrl(steamAppId) : null,
    lastSeenAt: row.last_seen_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listSteamGameRows(db) {
  return (await db.prepare("SELECT * FROM game_items WHERE source = 'steam'").all()).results ?? [];
}

async function recordSyncAttempt(db, attemptedAt) {
  await db.prepare(
    "INSERT INTO game_sync_state (id, last_attempt_at, last_synced_count, last_error) VALUES (1, ?, 0, NULL) ON CONFLICT(id) DO UPDATE SET last_attempt_at = excluded.last_attempt_at",
  ).bind(attemptedAt).run();
}

async function recordSyncFailure(db, attemptedAt, message) {
  await db.prepare(
    "INSERT INTO game_sync_state (id, last_attempt_at, last_synced_count, last_error) VALUES (1, ?, 0, ?) ON CONFLICT(id) DO UPDATE SET last_attempt_at = excluded.last_attempt_at, last_error = excluded.last_error",
  ).bind(attemptedAt, message).run();
}

function syncError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function normalizeSyncError(err) {
  if (err && typeof err === "object" && typeof err.code === "string" && typeof err.message === "string") return err;
  return syncError("STEAM_SYNC_FAILED", "Steam 同步失败，请稍后重试。");
}

function cleanText(value, limit) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text && Array.from(text).length <= limit ? text : undefined;
}

function invalid(code, message) {
  return { ok: false, error: { code, message } };
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, "\\$&");
}

function normalizeImageType(value) {
  if (typeof value !== "string") return undefined;
  const mime = value.split(";", 1)[0].trim().toLowerCase();
  return GAME_IMAGE_TYPE_SET.has(mime) ? mime : undefined;
}

function imageExtension(mime) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" }[mime];
}

function matchesImageSignature(bytes, mime) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mime === "image/webp") return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP";
  if (mime === "image/avif") return ascii(bytes, 4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 12));
  return false;
}

function ascii(bytes, start, end) {
  return String.fromCharCode(...bytes.slice(start, end));
}
