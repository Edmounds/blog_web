import { normalizeContentId } from "./engagement.js";

export const COMMENT_PAGE_SIZE = 20;
export const COMMENT_RATE_LIMIT_SECONDS = 60;
export const MAX_COMMENT_BODY_BYTES = 4_096;

const DEVICE_LABELS = {
  android: "Android",
  chromeos: "ChromeOS",
  ios: "iOS",
  linux: "Linux",
  macos: "macOS",
  other: "其他设备",
  windows: "Windows",
};

const CHINA_REGIONS = {
  AH: "安徽", BJ: "北京", CQ: "重庆", FJ: "福建", GD: "广东", GS: "甘肃", GX: "广西", GZ: "贵州",
  HA: "河南", HB: "湖北", HE: "河北", HI: "海南", HK: "中国香港", HL: "黑龙江", HN: "湖南",
  JL: "吉林", JS: "江苏", JX: "江西", LN: "辽宁", MO: "中国澳门", NM: "内蒙古", NX: "宁夏",
  QH: "青海", SC: "四川", SD: "山东", SH: "上海", SN: "陕西", SX: "山西", TJ: "天津",
  TW: "中国台湾", XJ: "新疆", XZ: "西藏", YN: "云南", ZJ: "浙江",
};

const CHINA_REGION_NAMES = {
  anhui: "安徽", beijing: "北京", chongqing: "重庆", fujian: "福建", gansu: "甘肃", guangdong: "广东",
  guangxi: "广西", guizhou: "贵州", hainan: "海南", hebei: "河北", heilongjiang: "黑龙江", henan: "河南",
  hubei: "湖北", hunan: "湖南", jiangsu: "江苏", jiangxi: "江西", jilin: "吉林", liaoning: "辽宁",
  "inner mongolia": "内蒙古", ningxia: "宁夏", qinghai: "青海", shaanxi: "陕西", shandong: "山东",
  shanghai: "上海", shanxi: "山西", sichuan: "四川", tianjin: "天津", tibet: "西藏", xinjiang: "新疆",
  yunnan: "云南", zhejiang: "浙江",
};

const COUNTRY_LABELS = {
  AU: "澳大利亚", CA: "加拿大", CN: "中国", DE: "德国", FR: "法国", GB: "英国", HK: "中国香港",
  ID: "印度尼西亚", IN: "印度", IT: "意大利", JP: "日本", KR: "韩国", MO: "中国澳门", MY: "马来西亚",
  NL: "荷兰", NZ: "新西兰", PH: "菲律宾", RU: "俄罗斯", SG: "新加坡", TH: "泰国", TW: "中国台湾",
  US: "美国", VN: "越南",
};

const BEIJING_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function validateCommentInput(value) {
  if (!value || typeof value !== "object") return invalid("INVALID_COMMENT", "评论数据无效。");
  if (typeof value.website === "string" && value.website.trim()) return invalid("INVALID_COMMENT", "评论数据无效。");

  const contentId = normalizeContentId(value.contentId);
  if (!contentId) return invalid("INVALID_CONTENT_ID", "请选择一篇已发布的内容。");

  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name || countCharacters(name) > 20) return invalid("INVALID_NAME", "名称需为 1 至 20 个字符。");

  const content = typeof value.content === "string" ? value.content : "";
  if (!content.trim() || countCharacters(content) > 500) return invalid("INVALID_CONTENT", "评论需为 1 至 500 个字符。");

  return { ok: true, value: { contentId, name, content } };
}

export function getCommentCursor(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined;
  const cursor = Number(value);
  return Number.isSafeInteger(cursor) && cursor > 0 ? cursor : undefined;
}

export function inferDevice(userAgent = "") {
  const value = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(value)) return DEVICE_LABELS.ios;
  if (value.includes("android")) return DEVICE_LABELS.android;
  if (value.includes("cros")) return DEVICE_LABELS.chromeos;
  if (value.includes("windows")) return DEVICE_LABELS.windows;
  if (value.includes("macintosh") || value.includes("mac os x")) return DEVICE_LABELS.macos;
  if (value.includes("linux")) return DEVICE_LABELS.linux;
  return DEVICE_LABELS.other;
}

export function inferRegion(cf) {
  if (!cf || typeof cf !== "object") return "未知地区";
  const country = typeof cf.country === "string" ? cf.country.toUpperCase() : "";
  const regionCode = typeof cf.regionCode === "string" ? cf.regionCode.toUpperCase() : "";

  if (country === "CN") {
    if (CHINA_REGIONS[regionCode]) return CHINA_REGIONS[regionCode];
    const region = typeof cf.region === "string" ? cf.region.trim().toLowerCase() : "";
    return CHINA_REGION_NAMES[region] ?? "未知地区";
  }

  return COUNTRY_LABELS[country] ?? "未知地区";
}

export function inferRegionFromHeaders(headers) {
  const country = headers.get("cf-ipcountry") ?? undefined;
  const regionCode = headers.get("cf-region-code") ?? undefined;
  return inferRegion(country || regionCode ? { country, regionCode } : undefined);
}

export function formatBeijingTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "未知时间" : BEIJING_FORMATTER.format(date);
}

export function toPublicComment(row) {
  const createdAt = normalizeUtcTimestamp(row.created_at);
  return {
    id: Number(row.id),
    contentId: String(row.slug),
    name: String(row.name),
    content: String(row.content),
    device: String(row.device_label),
    region: String(row.region_label),
    createdAt,
    createdAtLabel: formatBeijingTime(createdAt),
  };
}

export function toAdminComment(row) {
  return {
    ...toPublicComment(row),
    hidden: Number(row.is_hidden) === 1,
    hiddenAt: row.hidden_at ? normalizeUtcTimestamp(row.hidden_at) : null,
  };
}

export async function hashClientAddress(request, salt) {
  const address = getClientAddress(request);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(address));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function listPublicComments(db, contentId, cursor) {
  const rows = await queryComments(db, {
    contentId,
    cursor,
    where: "is_hidden = 0",
  });
  return pageRows(rows, toPublicComment);
}

export async function listAdminComments(db, contentId, status, cursor) {
  const where = status === "visible" ? "is_hidden = 0" : status === "hidden" ? "is_hidden = 1" : "1 = 1";
  const rows = await queryComments(db, { contentId, cursor, where });
  return pageRows(rows, toAdminComment);
}

export async function createComment(db, request, input, salt, now = new Date(), cf) {
  const visitorHash = await hashClientAddress(request, salt);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const earliestAllowed = nowSeconds - COMMENT_RATE_LIMIT_SECONDS;

  await db.prepare("DELETE FROM comment_rate_limits WHERE last_submitted_at < ?").bind(earliestAllowed).run();
  const recent = await db
    .prepare("SELECT last_submitted_at FROM comment_rate_limits WHERE visitor_hash = ?")
    .bind(visitorHash)
    .first();

  if (recent && Number(recent.last_submitted_at) > earliestAllowed) {
    return { ok: false, retryAfter: Number(recent.last_submitted_at) + COMMENT_RATE_LIMIT_SECONDS - nowSeconds };
  }

  const createdAt = now.toISOString();
  const device = inferDevice(request.headers.get("user-agent") ?? "");
  const hostname = new URL(request.url).hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  const inferredRegion = inferRegion(isLocal ? undefined : cf ?? request.cf);
  const region = inferredRegion === "未知地区" ? inferRegionFromHeaders(request.headers) : inferredRegion;
  const insert = await db
    .prepare(
      `INSERT INTO comments (slug, name, content, device_label, region_label, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(input.contentId, input.name, input.content, device, region, createdAt)
    .run();

  await db
    .prepare(
      `INSERT INTO comment_rate_limits (visitor_hash, last_submitted_at)
       VALUES (?, ?)
       ON CONFLICT(visitor_hash) DO UPDATE SET last_submitted_at = excluded.last_submitted_at`,
    )
    .bind(visitorHash, nowSeconds)
    .run();

  return {
    ok: true,
    comment: {
      id: Number(insert.meta.last_row_id),
      contentId: input.contentId,
      name: input.name,
      content: input.content,
      device,
      region,
      createdAt,
      createdAtLabel: formatBeijingTime(createdAt),
    },
  };
}

export async function setCommentHidden(db, id, hidden, now = new Date()) {
  const result = await db
    .prepare(
      `UPDATE comments
       SET is_hidden = ?, hidden_at = ?
       WHERE id = ?`,
    )
    .bind(hidden ? 1 : 0, hidden ? now.toISOString() : null, id)
    .run();

  if (Number(result.meta.changes ?? 0) === 0) return undefined;
  const row = await db.prepare("SELECT * FROM comments WHERE id = ?").bind(id).first();
  return row ? toAdminComment(row) : undefined;
}

function countCharacters(value) {
  return Array.from(value).length;
}

function invalid(code, message) {
  return { ok: false, error: { code, message } };
}

function normalizeUtcTimestamp(value) {
  const timestamp = String(value);
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp) ? timestamp : `${timestamp.replace(" ", "T")}Z`;
}

function getClientAddress(request) {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || "unknown";
}

async function queryComments(db, { contentId, cursor, where }) {
  const cursorClause = cursor ? "AND id < ?" : "";
  const statement = db.prepare(
    `SELECT * FROM comments
     WHERE slug = ? AND ${where} ${cursorClause}
     ORDER BY id DESC
     LIMIT ?`,
  );
  const bound = cursor
    ? statement.bind(contentId, cursor, COMMENT_PAGE_SIZE + 1)
    : statement.bind(contentId, COMMENT_PAGE_SIZE + 1);
  const result = await bound.all();
  return result.results ?? [];
}

function pageRows(rows, mapper) {
  const hasMore = rows.length > COMMENT_PAGE_SIZE;
  const page = rows.slice(0, COMMENT_PAGE_SIZE);
  return {
    items: page.map(mapper),
    nextCursor: hasMore ? String(page.at(-1).id) : null,
  };
}
