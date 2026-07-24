export const ART_TYPES = ["book", "music", "movie", "series", "anime"];
export const ART_LOCALES = ["zh-CN", "zh-TW", "en", "ja"];
export const ART_SOURCES = ["douban_books", "apple_books", "google_books", "apple_music", "deezer_music", "tmdb", "legacy"];
export const ART_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const ART_STORED_IMAGE_TYPES = [...ART_IMAGE_TYPES, "image/svg+xml"];

export const MAX_ART_BODY_BYTES = 14 * 1024 * 1024;
export const MAX_ART_IMAGE_BYTES = 10 * 1024 * 1024;
export const ART_COVER_BASE_URL = "https://img.muelsyse.us";

const TYPE_SET = new Set(ART_TYPES);
const LOCALE_SET = new Set(ART_LOCALES);
const SOURCE_SET = new Set(ART_SOURCES);
const IMAGE_TYPE_SET = new Set(ART_IMAGE_TYPES);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISBN_PATTERN = /^(?:\d{10}|\d{13})$/;
const STORED_COVER_KEY_PATTERN = /^art\/[a-f0-9-]+\.(?:jpg|png|webp|avif)$/i;

export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(status, code, message) {
  return json({ error: { code, message } }, { status });
}

export function requireDb(env) {
  if (!env?.DB) throw error(500, "DB_NOT_CONFIGURED", "收藏数据库未配置。");
  return env.DB;
}

export function requireBucket(env) {
  if (!env?.ART_COVERS) throw error(500, "R2_NOT_CONFIGURED", "收藏封面存储未配置。");
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
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_ART_BODY_BYTES) throw error(413, "BODY_TOO_LARGE", "请求数据超过大小限制。");
  try {
    return await request.json();
  } catch {
    throw error(400, "INVALID_JSON", "请求数据格式无效。");
  }
}

export function normalizeArtType(value) {
  return typeof value === "string" && TYPE_SET.has(value) ? value : undefined;
}

export function normalizeArtLocale(value) {
  return typeof value === "string" && LOCALE_SET.has(value) ? value : undefined;
}

export function normalizeArtId(value) {
  if (typeof value !== "string") return undefined;
  const id = value.trim();
  return id.length <= 100 && ID_PATTERN.test(id) ? id : undefined;
}

export function normalizeIsbn(value) {
  if (typeof value !== "string") return undefined;
  const isbn = value.replace(/[\s-]/g, "");
  return ISBN_PATTERN.test(isbn) ? isbn : undefined;
}

export function getShanghaiDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function validateTranslations(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("INVALID_TRANSLATIONS", "请填写多语言内容。");
  }
  const translations = {};
  for (const locale of ART_LOCALES) {
    const raw = value[locale];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const title = cleanText(raw.title, 200);
    const creator = cleanText(raw.creator, 200);
    const extra = cleanText(raw.extra, 500, true);
    if (locale === "zh-CN" && (!title || !creator)) {
      return invalid("INVALID_ZH_TRANSLATION", "简中标题和作者不能为空。");
    }
    if (title && creator) translations[locale] = { title, creator, extra };
  }
  if (!translations["zh-CN"]) return invalid("INVALID_ZH_TRANSLATION", "简中标题和作者不能为空。");
  return { ok: true, value: translations };
}

export function validateArtItemInput(value, { partial = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("INVALID_ITEM", "收藏数据无效。");
  const result = {};

  if (!partial || Object.hasOwn(value, "type")) {
    const type = normalizeArtType(value.type);
    if (!type) return invalid("INVALID_TYPE", "收藏类型无效。");
    result.type = type;
  }
  if (!partial || Object.hasOwn(value, "source")) {
    const source = typeof value.source === "string" && SOURCE_SET.has(value.source) ? value.source : undefined;
    if (!source) return invalid("INVALID_SOURCE", "数据来源无效。");
    result.source = source;
  }
  for (const [key, limit] of [["sourceId", 200], ["originalTitle", 300], ["releaseDate", 40]]) {
    if (!partial || Object.hasOwn(value, key)) result[key] = cleanText(value[key], limit, true);
  }
  if (!partial || Object.hasOwn(value, "isbn")) {
    if (value.isbn == null || value.isbn === "") result.isbn = "";
    else {
      const isbn = normalizeIsbn(value.isbn);
      if (!isbn) return invalid("INVALID_ISBN", "ISBN 格式无效。");
      result.isbn = isbn;
    }
  }
  if (!partial || Object.hasOwn(value, "collectedOn")) {
    const collectedOn = typeof value.collectedOn === "string" ? value.collectedOn : "";
    if (!isValidDate(collectedOn)) return invalid("INVALID_COLLECTED_DATE", "收藏日期无效。");
    result.collectedOn = collectedOn;
  }
  if (!partial || Object.hasOwn(value, "isVisible")) {
    if (typeof value.isVisible !== "boolean") return invalid("INVALID_VISIBILITY", "显示状态无效。");
    result.isVisible = value.isVisible;
  }
  if (!partial || Object.hasOwn(value, "translations")) {
    const translations = validateTranslations(value.translations);
    if (!translations.ok) return translations;
    result.translations = translations.value;
  }
  if (!partial || Object.hasOwn(value, "cover")) {
    const cover = validateCover(value.cover, { required: !partial });
    if (!cover.ok) return cover;
    result.cover = cover.value;
  }
  if (partial && Object.keys(result).length === 0) return invalid("EMPTY_UPDATE", "没有可更新的字段。");
  return { ok: true, value: result };
}

export function validateCover(value, { required = true } = {}) {
  if (value == null && !required) return { ok: true, value: undefined };
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("INVALID_COVER", "请选择封面。");
  if (value.kind === "url") {
    const url = cleanText(value.url, 2_000);
    if (!url) return invalid("INVALID_COVER_URL", "封面 URL 无效。");
    return { ok: true, value: { kind: "url", url } };
  }
  if (value.kind === "upload") {
    const data = typeof value.data === "string" ? value.data : "";
    const mime = normalizeImageType(value.mime);
    if (!mime || !data) return invalid("INVALID_COVER_UPLOAD", "上传封面无效。");
    if (data.length > Math.ceil(MAX_ART_IMAGE_BYTES * 4 / 3) + 128) return invalid("COVER_TOO_LARGE", "封面不能超过 10 MB。");
    return { ok: true, value: { kind: "upload", data, mime } };
  }
  if (value.kind === "stored") {
    const key = normalizeStoredCoverKey(value.key);
    if (!key) return invalid("INVALID_STORED_COVER", "已上传封面无效。");
    return { ok: true, value: { kind: "stored", key } };
  }
  return invalid("INVALID_COVER", "请选择封面。");
}

export function normalizeStoredCoverKey(value) {
  if (typeof value !== "string") return undefined;
  const key = value.trim();
  return STORED_COVER_KEY_PATTERN.test(key) ? key : undefined;
}

export function getArtCoverUrl(key) {
  return `${ART_COVER_BASE_URL}/${String(key).replace(/^\/+/, "")}`;
}

export function normalizeImageType(value) {
  if (typeof value !== "string") return undefined;
  const mime = value.split(";", 1)[0].trim().toLowerCase();
  return IMAGE_TYPE_SET.has(mime) ? mime : undefined;
}

export function imageExtension(mime) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/svg+xml": "svg" }[mime];
}

export function decodeBase64(value) {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    throw error(400, "INVALID_COVER_UPLOAD", "上传封面无法解码。");
  }
}

export async function storeCover(bucket, itemId, cover, fetchImpl = fetch, { db, currentItemId } = {}) {
  if (cover.kind === "stored") {
    if (db) await assertStoredCoverAvailable(bucket, db, cover.key, currentItemId);
    else if (!await bucket.head(cover.key)) throw error(400, "STORED_COVER_NOT_FOUND", "已上传封面不存在，请重新上传。");
    return { key: cover.key, sourceUrl: "", mime: imageMimeForKey(cover.key) };
  }
  const image = cover.kind === "upload" ? imageFromUpload(cover) : await fetchRemoteImage(cover.url, fetchImpl);
  const extension = imageExtension(image.mime);
  const key = `art/${itemId}/${crypto.randomUUID()}.${extension}`;
  await bucket.put(key, image.bytes, {
    httpMetadata: { contentType: image.mime, cacheControl: "public, max-age=31536000, immutable" },
  });
  return { key, sourceUrl: cover.kind === "url" ? cover.url : "", mime: image.mime };
}

export async function storeUploadedCover(bucket, file, now = new Date()) {
  const mime = normalizeImageType(file?.type);
  if (!mime || typeof file?.arrayBuffer !== "function") throw error(400, "INVALID_COVER_UPLOAD", "上传封面无效。");
  if (Number(file.size ?? 0) > MAX_ART_IMAGE_BYTES) throw error(413, "COVER_TOO_LARGE", "封面不能超过 10 MB。");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ART_IMAGE_BYTES) throw error(413, "COVER_TOO_LARGE", "封面不能超过 10 MB。");
  if (!matchesImageSignature(bytes, mime)) throw error(400, "INVALID_COVER_CONTENT", "封面内容与图片格式不符。");
  const key = `art/${crypto.randomUUID()}.${imageExtension(mime)}`;
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: mime, cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: { uploadedAt: now.toISOString() },
  });
  return { key, url: getArtCoverUrl(key), mime };
}

export async function isCoverKeyReferenced(db, key, excludedItemId) {
  const query = excludedItemId
    ? db.prepare("SELECT id FROM art_items WHERE cover_key = ? AND id != ? LIMIT 1").bind(key, excludedItemId)
    : db.prepare("SELECT id FROM art_items WHERE cover_key = ? LIMIT 1").bind(key);
  return Boolean(await query.first());
}

export async function assertStoredCoverAvailable(bucket, db, key, excludedItemId) {
  if (!await bucket.head(key)) throw error(400, "STORED_COVER_NOT_FOUND", "已上传封面不存在，请重新上传。");
  if (await isCoverKeyReferenced(db, key, excludedItemId)) {
    throw error(409, "STORED_COVER_IN_USE", "该封面已被其他收藏使用。");
  }
}

export async function deleteCoverIfUnreferenced(bucket, db, key) {
  if (!key || await isCoverKeyReferenced(db, key)) return false;
  await bucket.delete(key);
  return true;
}

export async function cleanupOrphanUploadedCovers(bucket, db, { now = new Date(), maxAgeMs = 24 * 60 * 60 * 1000 } = {}) {
  const referenced = new Set(((await db.prepare("SELECT cover_key FROM art_items").all()).results ?? []).map((row) => row.cover_key));
  let cursor;
  do {
    const page = await bucket.list({ prefix: "art/", cursor, include: ["customMetadata"] });
    for (const object of page.objects ?? []) {
      if (!STORED_COVER_KEY_PATTERN.test(object.key) || referenced.has(object.key)) continue;
      const uploadedAt = object.customMetadata?.uploadedAt ?? object.uploaded;
      const uploadedTime = new Date(uploadedAt ?? 0).getTime();
      if (Number.isFinite(uploadedTime) && now.getTime() - uploadedTime >= maxAgeMs) await bucket.delete(object.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

export async function fetchRemoteImage(rawUrl, fetchImpl = fetch, maxRedirects = 4) {
  let current = parsePublicHttpsUrl(rawUrl);
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const response = await fetchImpl(current, {
      redirect: "manual",
      headers: { accept: ART_IMAGE_TYPES.join(", "), "user-agent": "blog-art-cover-fetcher/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === maxRedirects) throw error(400, "INVALID_COVER_REDIRECT", "封面地址重定向无效。");
      current = parsePublicHttpsUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw error(400, "COVER_FETCH_FAILED", "无法下载封面图片。");
    const mime = normalizeImageType(response.headers.get("content-type"));
    if (!mime) throw error(400, "INVALID_COVER_TYPE", "封面必须是 JPEG、PNG、WebP 或 AVIF 图片。");
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_ART_IMAGE_BYTES) throw error(413, "COVER_TOO_LARGE", "封面不能超过 10 MB。");
    const bytes = new Uint8Array(await readLimitedBody(response.body, MAX_ART_IMAGE_BYTES));
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_ART_IMAGE_BYTES) throw error(413, "COVER_TOO_LARGE", "封面不能超过 10 MB。");
    if (!matchesImageSignature(bytes, mime)) throw error(400, "INVALID_COVER_CONTENT", "封面内容与图片格式不符。");
    return { bytes, mime };
  }
  throw error(400, "COVER_FETCH_FAILED", "无法下载封面图片。");
}

async function readLimitedBody(body, limit) {
  if (!body) return new ArrayBuffer(0);
  const reader = body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw error(413, "COVER_TOO_LARGE", "封面不能超过 10 MB。");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

export function parsePublicHttpsUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw error(400, "INVALID_COVER_URL", "封面 URL 无效。"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw error(400, "INVALID_COVER_URL", "封面仅支持公开 HTTPS 地址。");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw error(400, "PRIVATE_COVER_URL", "封面地址不能指向私有网络。");
  }
  if (isPrivateAddress(host)) throw error(400, "PRIVATE_COVER_URL", "封面地址不能指向私有网络。");
  return url;
}

export function assertResolvedPublicAddress(address) {
  const value = String(address ?? "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!value || isPrivateAddress(value)) throw error(400, "PRIVATE_COVER_URL", "封面地址不能指向私有网络。");
  return value;
}

export async function listArtItems(db, { type, visibleOnly = false } = {}) {
  const clauses = [];
  const args = [];
  if (type) { clauses.push("item.type = ?"); args.push(type); }
  if (visibleOnly) clauses.push("item.is_visible = 1");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = (await db.prepare(
    `SELECT item.*, translation.locale, translation.title, translation.creator, translation.extra
     FROM art_items item
     LEFT JOIN art_item_translations translation ON translation.item_id = item.id
     ${where}
     ORDER BY item.collected_on DESC, item.created_at DESC, item.id DESC, translation.locale ASC`,
  ).bind(...args).all()).results ?? [];
  return groupArtRows(rows);
}

export async function getArtItem(db, id) {
  const rows = (await db.prepare(
    `SELECT item.*, translation.locale, translation.title, translation.creator, translation.extra
     FROM art_items item
     LEFT JOIN art_item_translations translation ON translation.item_id = item.id
     WHERE item.id = ?
     ORDER BY translation.locale ASC`,
  ).bind(id).all()).results ?? [];
  return groupArtRows(rows)[0];
}

export async function createArtItem(db, input, storedCover, { id = crypto.randomUUID(), now = new Date() } = {}) {
  const createdAt = now.toISOString();
  const statements = [
    db.prepare(
      `INSERT INTO art_items
       (id, type, source, source_id, isbn, original_title, release_date, cover_key, cover_source_url, collected_on, is_visible, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, input.type, input.source, input.sourceId || null, input.isbn || null, input.originalTitle || null,
      input.releaseDate || null, storedCover.key, storedCover.sourceUrl || null, input.collectedOn, input.isVisible ? 1 : 0, createdAt, createdAt),
    ...translationStatements(db, id, input.translations),
  ];
  await db.batch(statements);
  return getArtItem(db, id);
}

export async function updateArtItem(db, id, current, input, storedCover, now = new Date()) {
  const merged = {
    type: input.type ?? current.type,
    source: input.source ?? current.source,
    sourceId: input.sourceId ?? current.sourceId,
    isbn: input.isbn ?? current.isbn,
    originalTitle: input.originalTitle ?? current.originalTitle,
    releaseDate: input.releaseDate ?? current.releaseDate,
    collectedOn: input.collectedOn ?? current.collectedOn,
    isVisible: input.isVisible ?? current.isVisible,
    translations: input.translations ?? current.translations,
  };
  const coverKey = storedCover?.key ?? current.coverKey;
  const coverSourceUrl = storedCover ? storedCover.sourceUrl : current.coverSourceUrl;
  const statements = [
    db.prepare(
      `UPDATE art_items SET type = ?, source = ?, source_id = ?, isbn = ?, original_title = ?, release_date = ?,
       cover_key = ?, cover_source_url = ?, collected_on = ?, is_visible = ?, updated_at = ? WHERE id = ?`,
    ).bind(merged.type, merged.source, merged.sourceId || null, merged.isbn || null, merged.originalTitle || null,
      merged.releaseDate || null, coverKey, coverSourceUrl || null, merged.collectedOn, merged.isVisible ? 1 : 0, now.toISOString(), id),
    db.prepare("DELETE FROM art_item_translations WHERE item_id = ?").bind(id),
    ...translationStatements(db, id, merged.translations),
  ];
  await db.batch(statements);
  return getArtItem(db, id);
}

export async function deleteArtItem(db, id) {
  const result = await db.prepare("DELETE FROM art_items WHERE id = ?").bind(id).run();
  return Number(result.meta?.changes ?? 0) > 0;
}

export function localizeArtItems(items, locale) {
  return items.map((item) => {
    const translation = item.translations[locale] ?? item.translations["zh-CN"];
    return { id: item.id, type: item.type, title: translation.title, creator: translation.creator, extra: translation.extra, cover: item.coverUrl };
  });
}

function imageFromUpload(cover) {
  const bytes = decodeBase64(cover.data);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ART_IMAGE_BYTES) throw error(413, "COVER_TOO_LARGE", "封面不能超过 10 MB。");
  if (!matchesImageSignature(bytes, cover.mime)) throw error(400, "INVALID_COVER_CONTENT", "封面内容与图片格式不符。");
  return { bytes, mime: cover.mime };
}

function imageMimeForKey(key) {
  return { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" }[key.split(".").pop()?.toLowerCase()] ?? "application/octet-stream";
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

function isPrivateAddress(host) {
  if (host.includes(":")) {
    const value = host.replace(/^\[|\]$/g, "").toLowerCase();
    return value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd")
      || /^fe[89ab]/.test(value) || value.startsWith("ff") || value.startsWith("::ffff:") || value.startsWith("100:")
      || value.startsWith("2001:db8:");
  }
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split(".").map(Number);
  if (parts.some((part) => part > 255)) return true;
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] >= 224
    || (parts[0] === 192 && parts[1] === 0 && parts[2] === 0)
    || (parts[0] === 192 && parts[1] === 0 && parts[2] === 2)
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 198 && parts[1] === 18)
    || (parts[0] === 198 && parts[1] === 19)
    || (parts[0] === 198 && parts[1] === 51 && parts[2] === 100)
    || (parts[0] === 203 && parts[1] === 0 && parts[2] === 113)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function cleanText(value, limit, allowEmpty = false) {
  if (value == null && allowEmpty) return "";
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if ((!text && !allowEmpty) || Array.from(text).length > limit) return undefined;
  return text;
}

function invalid(code, message) {
  return { ok: false, error: { code, message } };
}

function translationStatements(db, id, translations) {
  return Object.entries(translations).map(([locale, translation]) => db.prepare(
    `INSERT INTO art_item_translations (item_id, locale, title, creator, extra) VALUES (?, ?, ?, ?, ?)`,
  ).bind(id, locale, translation.title, translation.creator, translation.extra));
}

function groupArtRows(rows) {
  const items = new Map();
  for (const row of rows) {
    let item = items.get(row.id);
    if (!item) {
      item = {
        id: row.id, type: row.type, source: row.source, sourceId: row.source_id ?? "", isbn: row.isbn ?? "",
        originalTitle: row.original_title ?? "", releaseDate: row.release_date ?? "", coverKey: row.cover_key,
        coverSourceUrl: row.cover_source_url ?? "", coverUrl: getArtCoverUrl(row.cover_key), collectedOn: row.collected_on,
        isVisible: Number(row.is_visible) === 1, createdAt: row.created_at, updatedAt: row.updated_at, translations: {},
      };
      items.set(row.id, item);
    }
    if (row.locale && LOCALE_SET.has(row.locale)) {
      item.translations[row.locale] = { title: row.title, creator: row.creator, extra: row.extra ?? "" };
    }
  }
  return [...items.values()].filter((item) => item.translations["zh-CN"]);
}
