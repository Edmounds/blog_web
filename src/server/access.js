import { createRemoteJWKSet, jwtVerify } from "jose";

const jwksByUrl = new Map();

export function getAccessConfig(env) {
  const domain = typeof env?.CF_ACCESS_TEAM_DOMAIN === "string" ? env.CF_ACCESS_TEAM_DOMAIN.trim().replace(/\/+$/, "") : "";
  const audience = typeof env?.CF_ACCESS_AUD === "string" ? env.CF_ACCESS_AUD.trim() : "";
  if (!domain || !audience) return undefined;

  try {
    const url = new URL(domain.startsWith("https://") ? domain : `https://${domain}`);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".cloudflareaccess.com") || url.pathname !== "/") return undefined;
    const issuer = url.origin;
    return { audience, issuer, jwksUrl: `${issuer}/cdn-cgi/access/certs` };
  } catch {
    return undefined;
  }
}

export function getAccessToken(request) {
  return request.headers.get("cf-access-jwt-assertion")?.trim() || undefined;
}

export async function verifyAccess(request, env) {
  const config = getAccessConfig(env);
  const token = getAccessToken(request);
  if (!config || !token) return undefined;

  try {
    let jwks = jwksByUrl.get(config.jwksUrl);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(config.jwksUrl));
      jwksByUrl.set(config.jwksUrl, jwks);
    }
    return (await jwtVerify(token, jwks, { issuer: config.issuer, audience: config.audience })).payload;
  } catch {
    return undefined;
  }
}
