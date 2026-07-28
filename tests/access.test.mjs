import assert from "node:assert/strict";
import { test } from "node:test";

import { generateKeyPair, exportJWK, SignJWT } from "jose";

import { getAccessConfig, getAccessToken, verifyAccess } from "../src/server/access.js";

test("getAccessConfig normalizes the team domain and requires an audience", () => {
  assert.deepEqual(
    getAccessConfig({
      CF_ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com/",
      CF_ACCESS_AUD: "audience-id",
    }),
    {
      audience: "audience-id",
      issuer: "https://example.cloudflareaccess.com",
      jwksUrl: "https://example.cloudflareaccess.com/cdn-cgi/access/certs",
    },
  );

  assert.equal(getAccessConfig({ CF_ACCESS_TEAM_DOMAIN: "", CF_ACCESS_AUD: "audience-id" }), undefined);
  assert.equal(getAccessConfig({ CF_ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com", CF_ACCESS_AUD: "" }), undefined);
  assert.equal(getAccessConfig({ CF_ACCESS_TEAM_DOMAIN: "https://evil.example.com", CF_ACCESS_AUD: "audience-id" }), undefined);
});

test("getAccessToken reads only the Cloudflare Access assertion header", () => {
  assert.equal(getAccessToken(new Request("https://example.com", { headers: { "cf-access-jwt-assertion": " token " } })), "token");
  assert.equal(getAccessToken(new Request("https://example.com", { headers: { authorization: "Bearer token" } })), undefined);
});

test("verifyAccess rejects missing and forged assertions", async () => {
  const env = {
    CF_ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
    CF_ACCESS_AUD: "audience-id",
  };
  assert.equal(await verifyAccess(new Request("https://example.com"), env), undefined);
  assert.equal(await verifyAccess(new Request("https://example.com", { headers: { "cf-access-jwt-assertion": "not-a-jwt" } }), env), undefined);
});

test("verifyAccess checks signature, issuer, expiry, and audience", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test-key";
  const teamDomain = "https://example.cloudflareaccess.com";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ keys: [publicJwk] });

  try {
    const valid = await new SignJWT({ email: "owner@example.com" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(teamDomain)
      .setAudience("audience-id")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    const wrongAudience = await new SignJWT({ email: "owner@example.com" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(teamDomain)
      .setAudience("wrong-audience")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    const env = { CF_ACCESS_TEAM_DOMAIN: teamDomain, CF_ACCESS_AUD: "audience-id" };

    const payload = await verifyAccess(new Request("https://example.com", { headers: { "cf-access-jwt-assertion": valid } }), env);
    assert.equal(payload.email, "owner@example.com");
    assert.equal(await verifyAccess(new Request("https://example.com", { headers: { "cf-access-jwt-assertion": wrongAudience } }), env), undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
