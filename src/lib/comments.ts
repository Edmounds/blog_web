import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";

import { CONTENT_IDS } from "./post-slugs";

export const COMMENT_PAGE_SIZE = 20;
export const COMMENT_RATE_LIMIT_SECONDS = 60;
export const MAX_COMMENT_BODY_BYTES = 4_096;

const ABOUT_COMMENT_CONTENT_ID = "about/profile";
const LINKS_COMMENT_CONTENT_ID = "links";
const CONTENT_ID_PATTERN = /^(blog|note|project)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHINA_REGIONS: Record<string, string> = {
  AH: "安徽", BJ: "北京", CQ: "重庆", FJ: "福建", GD: "广东", GS: "甘肃", GX: "广西", GZ: "贵州",
  HA: "河南", HB: "湖北", HE: "河北", HI: "海南", HK: "中国香港", HL: "黑龙江", HN: "湖南",
  JL: "吉林", JS: "江苏", JX: "江西", LN: "辽宁", MO: "中国澳门", NM: "内蒙古", NX: "宁夏",
  QH: "青海", SC: "四川", SD: "山东", SH: "上海", SN: "陕西", SX: "山西", TJ: "天津",
  TW: "中国台湾", XJ: "新疆", XZ: "西藏", YN: "云南", ZJ: "浙江",
};
const COUNTRY_LABELS: Record<string, string> = {
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

export interface PublicComment {
  id: number;
  contentId: string;
  name: string;
  content: string;
  device: string;
  region: string;
  createdAt: string;
  createdAtLabel: string;
}

export interface AdminComment extends PublicComment {
  hidden: boolean;
  hiddenAt: string | null;
}

interface CommentRow {
  id: number;
  slug: string;
  name: string;
  content: string;
  device_label: string;
  region_label: string;
  created_at: string;
  is_hidden: number;
  hidden_at: string | null;
}

export function normalizeCommentContentId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const contentId = value.trim().replace(/^\/+|\/+$/g, "");
  if (contentId === ABOUT_COMMENT_CONTENT_ID || contentId === LINKS_COMMENT_CONTENT_ID) return contentId;
  return CONTENT_ID_PATTERN.test(contentId) && (CONTENT_IDS as readonly string[]).includes(contentId) ? contentId : undefined;
}

export function getCommentCursor(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const cursor = Number(value);
  return Number.isSafeInteger(cursor) && cursor > 0 ? cursor : undefined;
}

export function validateCommentInput(value: unknown):
  | { ok: true; value: { contentId: string; name: string; content: string } }
  | { ok: false; error: { code: string; message: string } } {
  if (!value || typeof value !== "object") return invalid("INVALID_COMMENT", "评论数据无效。");
  const body = value as Record<string, unknown>;
  if (typeof body.website === "string" && body.website.trim()) return invalid("INVALID_COMMENT", "评论数据无效。");
  const contentId = normalizeCommentContentId(body.contentId);
  if (!contentId) return invalid("INVALID_CONTENT_ID", "请选择一篇已发布的内容。");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || Array.from(name).length > 20) return invalid("INVALID_NAME", "名称需为 1 至 20 个字符。");
  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim() || Array.from(content).length > 500) return invalid("INVALID_CONTENT", "评论需为 1 至 500 个字符。");
  return { ok: true, value: { contentId, name, content } };
}

export function inferDevice(userAgent = ""): string {
  const value = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(value)) return "iOS";
  if (value.includes("android")) return "Android";
  if (value.includes("cros")) return "ChromeOS";
  if (value.includes("windows")) return "Windows";
  if (value.includes("macintosh") || value.includes("mac os x")) return "macOS";
  if (value.includes("linux")) return "Linux";
  return "其他设备";
}

export function inferRegion(cf: IncomingRequestCfProperties | undefined): string {
  if (!cf) return "未知地区";
  const country = typeof cf.country === "string" ? cf.country.toUpperCase() : "";
  const regionCode = typeof cf.regionCode === "string" ? cf.regionCode.toUpperCase() : "";
  if (country === "CN") return CHINA_REGIONS[regionCode] ?? "未知地区";
  return COUNTRY_LABELS[country] ?? "未知地区";
}

export function inferRegionFromHeaders(headers: Headers): string {
  const country = headers.get("cf-ipcountry") ?? undefined;
  const regionCode = headers.get("cf-region-code") ?? undefined;
  return inferRegion(country || regionCode ? ({ country, regionCode } as IncomingRequestCfProperties) : undefined);
}

export function formatBeijingTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "未知时间" : BEIJING_FORMATTER.format(date);
}

export async function listPublicComments(db: D1Database, contentId: string, cursor?: number) {
  return queryComments(db, contentId, cursor, "is_hidden = 0", toPublicComment);
}

export async function listAdminComments(db: D1Database, contentId: string, status: string, cursor?: number) {
  const where = status === "visible" ? "is_hidden = 0" : status === "hidden" ? "is_hidden = 1" : "1 = 1";
  return queryComments(db, contentId, cursor, where, toAdminComment);
}

export async function createComment(
  db: D1Database,
  request: Request,
  input: { contentId: string; name: string; content: string },
  salt: string,
  cf: IncomingRequestCfProperties | undefined,
  now = new Date(),
): Promise<{ ok: true; comment: PublicComment } | { ok: false; retryAfter: number }> {
  const visitorHash = await hashClientAddress(request, salt);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const earliestAllowed = nowSeconds - COMMENT_RATE_LIMIT_SECONDS;
  await db.prepare("DELETE FROM comment_rate_limits WHERE last_submitted_at < ?").bind(earliestAllowed).run();
  const recent = await db.prepare("SELECT last_submitted_at FROM comment_rate_limits WHERE visitor_hash = ?").bind(visitorHash).first<{ last_submitted_at: number }>();
  if (recent && Number(recent.last_submitted_at) > earliestAllowed) {
    return { ok: false, retryAfter: Number(recent.last_submitted_at) + COMMENT_RATE_LIMIT_SECONDS - nowSeconds };
  }

  const createdAt = now.toISOString();
  const device = inferDevice(request.headers.get("user-agent") ?? "");
  const hostname = new URL(request.url).hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  const cfRegion = inferRegion(isLocal ? undefined : cf);
  const region = cfRegion === "未知地区" ? inferRegionFromHeaders(request.headers) : cfRegion;
  const insert = await db.prepare(
    `INSERT INTO comments (slug, name, content, device_label, region_label, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(input.contentId, input.name, input.content, device, region, createdAt).run();
  await db.prepare(
    `INSERT INTO comment_rate_limits (visitor_hash, last_submitted_at) VALUES (?, ?)
     ON CONFLICT(visitor_hash) DO UPDATE SET last_submitted_at = excluded.last_submitted_at`,
  ).bind(visitorHash, nowSeconds).run();

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

export async function setCommentHidden(db: D1Database, id: number, hidden: boolean): Promise<AdminComment | undefined> {
  const result = await db.prepare(
    "UPDATE comments SET is_hidden = ?, hidden_at = ? WHERE id = ?",
  ).bind(hidden ? 1 : 0, hidden ? new Date().toISOString() : null, id).run();
  if (Number(result.meta.changes ?? 0) === 0) return undefined;
  const row = await db.prepare("SELECT * FROM comments WHERE id = ?").bind(id).first<CommentRow>();
  return row ? toAdminComment(row) : undefined;
}

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function verifyAccess(request: Request, env: Record<string, unknown>): Promise<JWTPayload | undefined> {
  const domain = typeof env.CF_ACCESS_TEAM_DOMAIN === "string" ? env.CF_ACCESS_TEAM_DOMAIN.trim().replace(/\/+$/, "") : "";
  const audience = typeof env.CF_ACCESS_AUD === "string" ? env.CF_ACCESS_AUD.trim() : "";
  const token = request.headers.get("cf-access-jwt-assertion")?.trim();
  if (!domain || !audience || !token) return undefined;

  try {
    const url = new URL(domain.startsWith("https://") ? domain : `https://${domain}`);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".cloudflareaccess.com") || url.pathname !== "/") return undefined;
    const issuer = url.origin;
    const jwksUrl = `${issuer}/cdn-cgi/access/certs`;
    let jwks = jwksByUrl.get(jwksUrl);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(jwksUrl));
      jwksByUrl.set(jwksUrl, jwks);
    }
    return (await jwtVerify(token, jwks, { issuer, audience })).payload;
  } catch {
    return undefined;
  }
}

function invalid(code: string, message: string) {
  return { ok: false as const, error: { code, message } };
}

function normalizeUtcTimestamp(value: string): string {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
}

function toPublicComment(row: CommentRow): PublicComment {
  const createdAt = normalizeUtcTimestamp(row.created_at);
  return {
    id: Number(row.id), contentId: row.slug, name: row.name, content: row.content,
    device: row.device_label, region: row.region_label, createdAt, createdAtLabel: formatBeijingTime(createdAt),
  };
}

function toAdminComment(row: CommentRow): AdminComment {
  return { ...toPublicComment(row), hidden: Number(row.is_hidden) === 1, hiddenAt: row.hidden_at ? normalizeUtcTimestamp(row.hidden_at) : null };
}

async function queryComments<T>(
  db: D1Database,
  contentId: string,
  cursor: number | undefined,
  where: string,
  mapper: (row: CommentRow) => T,
): Promise<{ items: T[]; nextCursor: string | null }> {
  const cursorClause = cursor ? "AND id < ?" : "";
  const statement = db.prepare(`SELECT * FROM comments WHERE slug = ? AND ${where} ${cursorClause} ORDER BY id DESC LIMIT ?`);
  const result = cursor
    ? await statement.bind(contentId, cursor, COMMENT_PAGE_SIZE + 1).all<CommentRow>()
    : await statement.bind(contentId, COMMENT_PAGE_SIZE + 1).all<CommentRow>();
  const rows = result.results ?? [];
  const page = rows.slice(0, COMMENT_PAGE_SIZE);
  return { items: page.map(mapper), nextCursor: rows.length > COMMENT_PAGE_SIZE ? String(page.at(-1)?.id) : null };
}

async function hashClientAddress(request: Request, salt: string): Promise<string> {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "";
  const address = forwarded.split(",")[0]?.trim() || "unknown";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(address));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
