import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPost as checkQr } from "../src/server/api/admin/netease/qr-check.js";
import { onRequestPost as createQr } from "../src/server/api/admin/netease/qr.js";
import { onRequestGet as getStatus } from "../src/server/api/admin/netease/status.js";
import { onRequestPost as sync } from "../src/server/api/admin/netease/sync.js";

test("NetEase admin status exposes refresh state without encrypted cookie fields", async () => {
  const response = await getStatus({ env: { DB: new StatusD1(), NETEASE_COOKIE_KEY: "x".repeat(32) } });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(body.auth.stored, true);
  assert.equal(body.weekly.lastSyncedCount, 20);
  assert.equal(body.total.lastSyncedCount, 50);
  assert.equal(JSON.stringify(body).includes("encrypted-cookie-value"), false);
  assert.equal("encryptedCookie" in body.auth, false);
});

test("NetEase admin writes reject cross-origin requests before any upstream work", async () => {
  const request = new Request("https://blog.example/api/admin/netease/sync", {
    method: "POST",
    headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
  });
  const response = await sync({ env: {}, request });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "FORBIDDEN_REQUEST");
});

test("QR login requires encryption configuration and validates its polling key", async () => {
  const createResponse = await createQr({
    env: { DB: new StatusD1() },
    request: new Request("https://blog.example/api/admin/netease/qr", { method: "POST" }),
  });
  assert.equal(createResponse.status, 503);
  assert.equal((await createResponse.json()).error.code, "NETEASE_COOKIE_KEY_MISSING");

  const checkResponse = await checkQr({
    env: { DB: new StatusD1() },
    request: new Request("https://blog.example/api/admin/netease/qr/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: 42 }),
    }),
  });
  assert.equal(checkResponse.status, 400);
  assert.equal((await checkResponse.json()).error.code, "NETEASE_QR_KEY_INVALID");
});

class StatusD1 {
  prepare(sql) {
    return {
      first: async () => {
        if (sql.includes("netease_auth_state")) return {
          encrypted_cookie: "encrypted-cookie-value",
          cookie_iv: "iv-value",
          last_refresh_attempt_at: "2026-08-11T04:00:00.000Z",
          last_refresh_success_at: "2026-08-11T04:00:00.000Z",
          last_login_at: null,
          last_error_code: null,
          last_error: null,
        };
        if (sql.includes("netease_total_ranking_sync_state")) return {
          last_attempt_at: "2026-08-11T04:00:00.000Z",
          last_success_at: "2026-08-11T04:00:00.000Z",
          last_synced_count: 50,
          last_error: null,
        };
        return {
          last_attempt_at: "2026-08-11T04:00:00.000Z",
          last_success_at: "2026-08-11T04:00:00.000Z",
          last_synced_count: 20,
          last_error: null,
        };
      },
    };
  }
}
