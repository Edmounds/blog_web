import { createCipheriv, createHash } from "node:crypto";

const NETEASE_EAPI_ORIGIN = "https://interface.music.163.com";
const NETEASE_REFRESH_PATH = "/api/login/token/refresh";
const NETEASE_QR_KEY_PATH = "/api/login/qrcode/unikey";
const NETEASE_QR_CHECK_PATH = "/api/login/qrcode/client/login";
const NETEASE_QR_LOGIN_URL = "https://music.163.com/login?codekey=";
const EAPI_KEY = "e82ckenh8dichen8";
const EAPI_DELIMITER = "-36cd479b6b5-";
const COOKIE_NAMES = new Set([
  "MUSIC_U", "__csrf", "NMTID", "_ntes_nuid", "_ntes_nnid", "WNMCID", "WEVNSM",
  "JSESSIONID-WYYY", "os", "appver", "deviceId", "sDeviceId", "channel",
]);
const DEFAULT_COOKIES = { os: "pc", appver: "3.1.17.204416" };

export async function sealNeteaseCookieJar(cookieJar, secret) {
  const normalized = normalizeCookieJar(cookieJar);
  if (!normalized.MUSIC_U) throw authError("NETEASE_SESSION_MISSING", "网易云登录 Cookie 无效。");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(secret, ["encrypt"]);
  const plaintext = new TextEncoder().encode(JSON.stringify(normalized));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { encryptedCookie: base64Url(new Uint8Array(encrypted)), cookieIv: base64Url(iv) };
}

export async function unsealNeteaseCookieJar(sealed, secret) {
  if (!sealed?.encryptedCookie || !sealed?.cookieIv) {
    throw authError("NETEASE_SESSION_MISSING", "网易云登录 Cookie 尚未保存。");
  }
  try {
    const key = await encryptionKey(secret, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(sealed.cookieIv) },
      key,
      fromBase64Url(sealed.encryptedCookie),
    );
    return normalizeCookieJar(JSON.parse(new TextDecoder().decode(plaintext)));
  } catch (error) {
    if (error?.code) throw error;
    throw authError("NETEASE_SESSION_DECRYPT_FAILED", "无法读取已保存的网易云登录 Cookie。");
  }
}

export async function loadNeteaseCookieJar(env) {
  return (await loadNeteaseSession(env)).cookies;
}

export async function refreshNeteaseSession(env, { fetchImpl = fetch, now = new Date() } = {}) {
  const attemptedAt = now.toISOString();
  const db = requireDb(env);
  await updateRefreshState(db, attemptedAt, null, null);
  try {
    const session = await loadNeteaseSession(env);
    const response = await requestEapi(NETEASE_REFRESH_PATH, {}, session.cookies, fetchImpl);
    const payload = await readPayload(response, "网易云登录刷新返回了无效数据。");
    if (payload?.code !== 200) {
      const expired = [301, 302].includes(Number(payload?.code));
      throw authError(
        expired ? "NETEASE_SESSION_EXPIRED" : "NETEASE_REFRESH_FAILED",
        expired ? "网易云登录已失效，请重新扫码登录。" : "网易云登录刷新失败，请稍后重试。",
      );
    }
    const cookies = mergeResponseCookies(session.cookies, response, payload?.cookie);
    if (!cookies.MUSIC_U) throw authError("NETEASE_SESSION_EXPIRED", "网易云登录已失效，请重新扫码登录。");
    await saveNeteaseSession(env, cookies, { refreshedAt: attemptedAt });
    return { refreshedAt: attemptedAt, source: session.source, cookieCount: Object.keys(cookies).length };
  } catch (error) {
    const normalized = normalizeAuthError(error);
    await updateRefreshState(db, attemptedAt, normalized.code, normalized.message).catch(() => undefined);
    throw normalized;
  }
}

export async function createNeteaseQrLogin({ fetchImpl = fetch } = {}) {
  const response = await requestEapi(NETEASE_QR_KEY_PATH, { type: 3 }, DEFAULT_COOKIES, fetchImpl);
  const payload = await readPayload(response, "无法创建网易云登录二维码。");
  const key = cleanValue(payload?.unikey ?? payload?.data?.unikey);
  if (payload?.code !== 200 || !key) throw authError("NETEASE_QR_CREATE_FAILED", "无法创建网易云登录二维码。");
  return { key, loginUrl: `${NETEASE_QR_LOGIN_URL}${encodeURIComponent(key)}` };
}

export async function checkNeteaseQrLogin(env, key, { fetchImpl = fetch, now = new Date() } = {}) {
  const normalizedKey = cleanValue(key);
  if (!normalizedKey || normalizedKey.length > 200) throw authError("NETEASE_QR_KEY_INVALID", "二维码登录状态无效。");
  const response = await requestEapi(
    NETEASE_QR_CHECK_PATH,
    { key: normalizedKey, type: 3 },
    DEFAULT_COOKIES,
    fetchImpl,
  );
  const payload = await readPayload(response, "无法检查网易云二维码状态。");
  const code = Number(payload?.code);
  if (code === 800) return { state: "expired", message: "二维码已过期" };
  if (code === 801) return { state: "waiting", message: "等待扫码" };
  if (code === 802) return { state: "scanned", message: "已扫码，等待确认" };
  if (code !== 803) throw authError("NETEASE_QR_CHECK_FAILED", "无法检查网易云二维码状态。");

  const cookies = mergeResponseCookies(DEFAULT_COOKIES, response, payload?.cookie);
  if (!cookies.MUSIC_U) throw authError("NETEASE_QR_COOKIE_MISSING", "网易云登录成功，但未返回有效 Cookie。");
  const loginAt = now.toISOString();
  await saveNeteaseSession(env, cookies, { refreshedAt: loginAt, loginAt });
  return { state: "success", message: "登录成功" };
}

export async function getNeteaseAuthState(env) {
  const row = await readAuthRow(requireDb(env));
  const stored = Boolean(row?.encrypted_cookie && row?.cookie_iv);
  const bootstrap = Boolean(cleanValue(env?.NETEASE_MUSIC_U) && cleanValue(env?.NETEASE_CSRF));
  const configured = stored || bootstrap;
  const needsLogin = !configured || [
    "NETEASE_SESSION_EXPIRED",
    "NETEASE_SESSION_DECRYPT_FAILED",
    "NETEASE_SESSION_MISSING",
  ].includes(row?.last_error_code);
  return {
    configured,
    stored,
    encryptionConfigured: Boolean(cleanValue(env?.NETEASE_COOKIE_KEY)),
    needsLogin,
    lastRefreshAttemptAt: row?.last_refresh_attempt_at ?? null,
    lastRefreshSuccessAt: row?.last_refresh_success_at ?? null,
    lastLoginAt: row?.last_login_at ?? null,
    lastErrorCode: row?.last_error_code ?? null,
    lastError: row?.last_error ?? null,
  };
}

export async function recordNeteaseSessionFailure(env, error, now = new Date()) {
  const normalized = normalizeAuthError(error);
  if (normalized.code !== "NETEASE_SESSION_EXPIRED") return;
  await updateRefreshState(requireDb(env), now.toISOString(), normalized.code, normalized.message).catch(() => undefined);
}

async function saveNeteaseSession(env, cookies, { refreshedAt, loginAt = null }) {
  const sealed = await sealNeteaseCookieJar(cookies, env?.NETEASE_COOKIE_KEY);
  await requireDb(env).prepare(
    `UPDATE netease_auth_state SET encrypted_cookie = ?, cookie_iv = ?,
     last_refresh_attempt_at = ?, last_refresh_success_at = ?,
     last_login_at = COALESCE(?, last_login_at), last_error_code = NULL, last_error = NULL, updated_at = ?
     WHERE id = 1`,
  ).bind(sealed.encryptedCookie, sealed.cookieIv, refreshedAt, refreshedAt, loginAt, refreshedAt).run();
}

async function loadNeteaseSession(env) {
  const row = cleanValue(env?.NETEASE_COOKIE_KEY) ? await readAuthRow(env?.DB) : null;
  if (row?.encrypted_cookie && row?.cookie_iv) {
    return {
      source: "stored",
      cookies: { ...DEFAULT_COOKIES, ...await unsealNeteaseCookieJar({
        encryptedCookie: row.encrypted_cookie,
        cookieIv: row.cookie_iv,
      }, env?.NETEASE_COOKIE_KEY) },
    };
  }
  const musicU = cleanValue(env?.NETEASE_MUSIC_U);
  const csrf = cleanValue(env?.NETEASE_CSRF);
  if (!musicU || !csrf) throw authError("NETEASE_SESSION_MISSING", "网易云登录 Cookie 尚未配置。");
  return { source: "secret", cookies: { MUSIC_U: musicU, __csrf: csrf, ...DEFAULT_COOKIES } };
}

async function readAuthRow(db) {
  if (!db) return null;
  try {
    return await db.prepare("SELECT * FROM netease_auth_state WHERE id = 1").first();
  } catch (error) {
    if (/no such table:\s*netease_auth_state/i.test(String(error?.message ?? error))) return null;
    throw error;
  }
}

async function updateRefreshState(db, attemptedAt, errorCode, errorMessage) {
  await db.prepare(
    `UPDATE netease_auth_state SET last_refresh_attempt_at = ?, last_error_code = ?, last_error = ?, updated_at = ?
     WHERE id = 1`,
  ).bind(attemptedAt, errorCode, errorMessage, attemptedAt).run();
}

async function requestEapi(apiPath, data, cookies, fetchImpl) {
  const { form, header } = createEapiForm(apiPath, data, cookies);
  const url = `${NETEASE_EAPI_ORIGIN}/eapi/${apiPath.slice(5)}`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
        cookie: renderEapiCookieHeader(header),
        "user-agent": "NeteaseMusic/9.1.65.240927161425(9001065);Dalvik/2.1.0 (Linux; U; Android 14)",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw authError("NETEASE_AUTH_FETCH_FAILED", "暂时无法连接网易云登录服务。");
  }
  if (!response.ok) throw authError("NETEASE_AUTH_FETCH_FAILED", `网易云登录服务请求失败（HTTP ${response.status}）。`);
  return response;
}

function createEapiForm(apiPath, data, cookies) {
  const header = createEapiHeader(cookies);
  const plaintext = JSON.stringify({ ...data, e_r: false, header });
  const digest = createHash("md5").update(`nobody${apiPath}use${plaintext}md5forencrypt`).digest("hex");
  // Workers 的 node:crypto 不接受 null iv；ECB 下空 Buffer 与 null 等价。
  const cipher = createCipheriv("aes-128-ecb", EAPI_KEY, Buffer.alloc(0));
  const encrypted = Buffer.concat([
    cipher.update(`${apiPath}${EAPI_DELIMITER}${plaintext}${EAPI_DELIMITER}${digest}`, "utf8"),
    cipher.final(),
  ]).toString("hex");
  const form = new URLSearchParams();
  form.set("params", encrypted);
  return { form, header };
}

function createEapiHeader(cookies) {
  const jar = normalizeCookieJar(cookies);
  const now = Date.now();
  const header = {
    osver: "Microsoft-Windows-10-Professional-build-19045-64bit",
    deviceId: jar.deviceId ?? jar.sDeviceId ?? "",
    os: jar.os ?? "pc",
    appver: jar.appver ?? DEFAULT_COOKIES.appver,
    versioncode: "140",
    mobilename: "",
    buildver: String(Math.floor(now / 1000)),
    resolution: "1920x1080",
    __csrf: jar.__csrf ?? "",
    channel: jar.channel ?? "netease",
    requestId: `${now}_${String(randomInteger(1000)).padStart(4, "0")}`,
  };
  if (jar.MUSIC_U) header.MUSIC_U = jar.MUSIC_U;
  return header;
}

function renderEapiCookieHeader(header) {
  return Object.entries(header).map(([name, value]) => (
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
  )).join("; ");
}

function randomInteger(limit) {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return bytes[0] % limit;
}

function mergeResponseCookies(current, response, bodyCookie) {
  const merged = { ...normalizeCookieJar(current), ...DEFAULT_COOKIES };
  for (const value of responseCookieValues(response)) applyCookieString(merged, value);
  if (typeof bodyCookie === "string") applyCookieString(merged, bodyCookie);
  if (Array.isArray(bodyCookie)) for (const value of bodyCookie) applyCookieString(merged, value);
  return normalizeCookieJar(merged);
}

function responseCookieValues(response) {
  if (typeof response?.headers?.getSetCookie === "function") return response.headers.getSetCookie();
  const value = response?.headers?.get?.("set-cookie");
  return value ? value.split(/,(?=\s*[!#$%&'*+.^_`|~0-9A-Za-z-]+=)/) : [];
}

function applyCookieString(target, value) {
  for (const part of String(value ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const cookieValue = part.slice(separator + 1).trim();
    if (!COOKIE_NAMES.has(name)) continue;
    if (cookieValue) target[name] = cookieValue;
    else delete target[name];
  }
}

function normalizeCookieJar(value) {
  const result = {};
  if (!value || typeof value !== "object") return result;
  for (const name of [...COOKIE_NAMES].sort()) {
    const cookieValue = cleanValue(value[name]);
    if (cookieValue) result[name] = cookieValue;
  }
  return result;
}

async function readPayload(response, message) {
  try {
    return await response.json();
  } catch {
    throw authError("NETEASE_AUTH_INVALID_RESPONSE", message);
  }
}

async function encryptionKey(secret, usages) {
  const value = cleanValue(secret);
  if (!value || value.length < 32) {
    throw authError("NETEASE_COOKIE_KEY_MISSING", "NETEASE_COOKIE_KEY 未配置或长度不足 32 个字符。");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, usages);
}

function base64Url(bytes) {
  return toBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
  const normalized = String(value).replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function cleanValue(value) {
  if (typeof value !== "string") return undefined;
  const result = value.trim();
  return result || undefined;
}

function requireDb(env) {
  if (!env?.DB) throw authError("DB_NOT_CONFIGURED", "听歌排行数据库未配置。");
  return env.DB;
}

function authError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeAuthError(error) {
  if (error && typeof error === "object" && typeof error.code === "string" && typeof error.message === "string") return error;
  return authError("NETEASE_AUTH_FAILED", "网易云登录操作失败，请稍后重试。");
}
