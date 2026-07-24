const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_BYTES = 10 * 1024 * 1024;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.protocol !== "https:") return new Response("HTTPS required", { status: 400 });
    const addresses = await resolveAddresses(url.hostname);
    if (!addresses.length || addresses.some(isPrivateAddress)) return new Response("Private address rejected", { status: 403 });
    const headers = new Headers(request.headers);
    if (url.hostname.endsWith(".doubanio.com")) headers.set("referer", "https://book.douban.com/");
    const response = await fetch(new Request(request, { headers }), { redirect: "manual" });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const headers = new Headers();
      const location = response.headers.get("location");
      if (location) headers.set("location", new URL(location, url).toString());
      return new Response(null, { status: response.status, headers });
    }
    const mime = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    const length = Number(response.headers.get("content-length") ?? 0);
    if (!response.ok || !mime || !ALLOWED_TYPES.has(mime) || length > MAX_BYTES) return new Response("Invalid image response", { status: 400 });
    return new Response(limitBody(response.body, MAX_BYTES), { status: response.status, headers: { "content-type": mime, ...(length ? { "content-length": String(length) } : {}) } });
  },
};

function limitBody(body, limit) {
  if (!body) return null;
  const reader = body.getReader();
  let size = 0;
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) return controller.close();
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel("Image exceeds size limit.");
        return controller.error(new Error("Image exceeds size limit."));
      }
      controller.enqueue(value);
    },
    cancel(reason) { return reader.cancel(reason); },
  });
}

async function resolveAddresses(hostname) {
  const address = hostname.replace(/^\[|\]$/g, "");
  if (/^[\d.:]+$/.test(address)) return [address];
  const answers = await Promise.all([resolveDns(hostname, "A", 1), resolveDns(hostname, "AAAA", 28)]);
  return answers.flat();
}

async function resolveDns(hostname, type, recordType) {
  const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, {
    headers: { accept: "application/dns-json" },
  });
  if (!response.ok) throw new Error(`DNS ${type} lookup failed with HTTP ${response.status}.`);
  const data = await response.json();
  return (data.Answer ?? []).filter((answer) => answer.type === recordType).map((answer) => answer.data);
}

function isPrivateAddress(value) {
  const host = String(value).toLowerCase();
  if (host.includes(":")) return host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd")
    || /^fe[89ab]/.test(host) || host.startsWith("ff") || host.startsWith("::ffff:") || host.startsWith("100:")
    || host.startsWith("2001:db8:");
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
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
