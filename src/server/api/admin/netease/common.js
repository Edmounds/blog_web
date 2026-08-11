import { getNeteaseAuthState } from "../../../netease-auth.js";
import { getNeteaseSyncState } from "../../../netease-music.js";

const MAX_JSON_BYTES = 4096;

export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "private, no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(status, code, message) {
  return json({ error: { code, message } }, { status });
}

export function requireSameOrigin(request) {
  const origin = request.headers.get("origin");
  const isSameOrigin = !origin || origin === new URL(request.url).origin;
  const isCrossSite = request.headers.get("sec-fetch-site") === "cross-site";
  if (isSameOrigin && !isCrossSite) return;
  throw error(403, "FORBIDDEN_REQUEST", "需要同源请求。");
}

export async function readSameOriginJson(request) {
  requireSameOrigin(request);
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw error(403, "JSON_REQUIRED", "需要 JSON 请求。");
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw error(413, "REQUEST_TOO_LARGE", "请求内容过大。");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw error(413, "REQUEST_TOO_LARGE", "请求内容过大。");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw error(400, "INVALID_JSON", "请求 JSON 无效。");
  }
}

export async function getAdminStatus(env) {
  if (!env?.DB) throw appError("DB_NOT_CONFIGURED", "听歌排行数据库未配置。");
  const [auth, weekly, total] = await Promise.all([
    getNeteaseAuthState(env),
    getNeteaseSyncState(env.DB, "weekly"),
    getNeteaseSyncState(env.DB, "total"),
  ]);
  return { auth, weekly, total };
}

export function handleError(err, operation) {
  if (err instanceof Response) return err;
  const code = typeof err?.code === "string" ? err.code : "NETEASE_ADMIN_FAILED";
  const message = typeof err?.message === "string" ? err.message : "网易云管理操作失败，请稍后重试。";
  const status = code === "NETEASE_QR_KEY_INVALID" ? 400
    : ["DB_NOT_CONFIGURED", "NETEASE_COOKIE_KEY_MISSING"].includes(code) ? 503
      : 502;
  console.error(`NetEase admin ${operation} failed`, { code, message });
  return error(status, code, message);
}

export function publicOutcome(outcome) {
  if (outcome.status === "fulfilled") return { status: "fulfilled", value: outcome.value };
  return {
    status: "rejected",
    error: {
      code: typeof outcome.reason?.code === "string" ? outcome.reason.code : "NETEASE_SYNC_FAILED",
      message: outcome.reason instanceof Error ? outcome.reason.message : "网易云音乐同步失败。",
    },
  };
}

function appError(code, message) {
  const value = new Error(message);
  value.code = code;
  return value;
}
