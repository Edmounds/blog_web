import { error, parsePublicHttpsUrl } from "../art.js";

const FRIEND_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"]);
const MAX_FRIEND_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 4;

export async function onRequestGet({ env, request }) {
  try {
    const rawUrl = new URL(request.url).searchParams.get("url");
    if (!rawUrl) return avatarError(400, "INVALID_AVATAR_URL", "头像 URL 无效。");
    if (!env?.IMAGES) return avatarError(503, "IMAGE_SERVICE_UNAVAILABLE", "头像处理服务暂不可用。");

    const source = await fetchFriendAvatar(env, rawUrl);
    const input = source.mime === "image/svg+xml" ? await renderSvg(source.bytes) : source.bytes;
    const transformed = await env.IMAGES.input(streamFrom(input)).output({ format: "image/webp", quality: 86, anim: false });
    const response = transformed.response();
    const headers = new Headers(response.headers);
    headers.set("cache-control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
    headers.set("content-type", "image/webp");
    headers.set("x-content-type-options", "nosniff");
    return new Response(response.body, { status: response.status, headers });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Friend avatar proxy failed", err);
    return avatarError(502, "AVATAR_PROXY_FAILED", "暂时无法加载友链头像。");
  }
}

async function fetchFriendAvatar(env, rawUrl) {
  let current = parseAvatarUrl(rawUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await avatarFetch(env, current);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) throw avatarError(400, "INVALID_AVATAR_REDIRECT", "头像地址重定向无效。");
      current = parseAvatarUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw avatarError(400, "AVATAR_FETCH_FAILED", "无法下载友链头像。");
    const mime = normalizeAvatarType(response.headers.get("content-type"));
    if (!mime || !FRIEND_AVATAR_TYPES.has(mime)) throw avatarError(400, "INVALID_AVATAR_TYPE", "友链头像必须是图片。");
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_FRIEND_AVATAR_BYTES) throw avatarError(413, "AVATAR_TOO_LARGE", "友链头像不能超过 5 MB。");
    const bytes = await readLimitedBody(response.body, MAX_FRIEND_AVATAR_BYTES);
    if (bytes.byteLength === 0 || !matchesAvatarSignature(bytes, mime)) {
      throw avatarError(400, "INVALID_AVATAR_CONTENT", "友链头像内容无效。");
    }
    return { bytes, mime };
  }
  throw avatarError(400, "AVATAR_FETCH_FAILED", "无法下载友链头像。");
}

function avatarFetch(env, url) {
  if (typeof env?.ART_COVER_FETCHER?.fetch !== "function") {
    return fetch(url, { redirect: "manual", headers: { accept: [...FRIEND_AVATAR_TYPES].join(", ") }, signal: AbortSignal.timeout(10_000) });
  }
  const request = new Request("https://cover-fetcher.internal/", { headers: { accept: [...FRIEND_AVATAR_TYPES].join(", ") } });
  request.headers.set("x-art-cover-url", String(url));
  return env.ART_COVER_FETCHER.fetch(request);
}

function parseAvatarUrl(value) {
  try {
    return parsePublicHttpsUrl(value);
  } catch {
    throw avatarError(400, "INVALID_AVATAR_URL", "头像仅支持公开 HTTPS 地址。");
  }
}

function normalizeAvatarType(value) {
  const mime = value?.split(";", 1)[0]?.trim().toLowerCase();
  if (mime === "image/jpg" || mime === "image/pjpeg") return "image/jpeg";
  return mime;
}

function matchesAvatarSignature(bytes, mime) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mime === "image/webp") return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP";
  if (mime === "image/avif") return ascii(bytes, 4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 12));
  if (mime === "image/svg+xml") return /^\s*(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(new TextDecoder().decode(bytes.subarray(0, 1024)));
  return false;
}

async function renderSvg(bytes) {
  try {
    const { Resvg } = await import("@cf-wasm/resvg/edge-light");
    const image = await Resvg.async(bytes, { fitTo: { mode: "width", value: 640 }, font: { loadSystemFonts: false } });
    return image.render().asPng();
  } catch {
    throw avatarError(400, "INVALID_AVATAR_CONTENT", "SVG 头像内容无效。");
  }
}

async function readLimitedBody(body, limit) {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw avatarError(413, "AVATAR_TOO_LARGE", "友链头像不能超过 5 MB。");
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
  return bytes;
}

function streamFrom(bytes) {
  return new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
}

function ascii(bytes, start, end) {
  return String.fromCharCode(...bytes.slice(start, end));
}

function avatarError(status, code, message) {
  const response = error(status, code, message);
  response.headers.set("cache-control", "no-store");
  return response;
}
