import assert from "node:assert/strict";
import { createDecipheriv } from "node:crypto";
import test from "node:test";

import {
  checkNeteaseQrLogin,
  createNeteaseQrLogin,
  loadNeteaseCookieJar,
  refreshNeteaseSession,
  sealNeteaseCookieJar,
  unsealNeteaseCookieJar,
} from "../src/server/netease-auth.js";

const SECRET = "test-cookie-encryption-key-32-chars";
const NOW = new Date("2026-08-11T04:00:00.000Z");

test("NetEase cookie storage encrypts only music-domain session fields", async () => {
  const sealed = await sealNeteaseCookieJar({
    MUSIC_U: "music-session",
    __csrf: "csrf-session",
    NMTID: "device-session",
    NTES_SESS: "mail-session-must-not-be-stored",
  }, SECRET);

  assert.doesNotMatch(JSON.stringify(sealed), /music-session|csrf-session|mail-session/);
  assert.deepEqual(await unsealNeteaseCookieJar(sealed, SECRET), {
    MUSIC_U: "music-session",
    NMTID: "device-session",
    __csrf: "csrf-session",
  });
});

test("token refresh merges Set-Cookie and persists the rotated session", async () => {
  const db = new FakeAuthD1();
  const env = bootstrapEnv(db);
  let request;
  const responseHeaders = new Headers();
  responseHeaders.append("set-cookie", "MUSIC_U=rotated-music; Path=/; HttpOnly");
  responseHeaders.append("set-cookie", "__csrf=rotated-csrf; Path=/");

  const result = await refreshNeteaseSession(env, {
    now: NOW,
    fetchImpl: async (input, init) => {
      request = { url: String(input), init };
      return Response.json({ code: 200 }, { headers: responseHeaders });
    },
  });

  assert.match(request.url, /\/eapi\/login\/token\/refresh/);
  assert.match(request.init.headers.cookie, /MUSIC_U=bootstrap-music/);
  assert.match(request.init.body, /^params=[0-9a-f]+$/);
  const encrypted = new URLSearchParams(request.init.body).get("params");
  const decipher = createDecipheriv("aes-128-ecb", "e82ckenh8dichen8", null);
  const plaintext = Buffer.concat([decipher.update(encrypted, "hex"), decipher.final()]).toString("utf8");
  assert.match(plaintext, /^\/api\/login\/token\/refresh-36cd479b6b5-/);
  assert.match(plaintext, /"MUSIC_U":"bootstrap-music"/);
  assert.equal(result.refreshedAt, NOW.toISOString());
  assert.equal(JSON.stringify(result).includes("rotated-music"), false);
  assert.deepEqual(await loadNeteaseCookieJar(env), {
    MUSIC_U: "rotated-music",
    __csrf: "rotated-csrf",
    appver: "3.1.17.204416",
    os: "pc",
  });
  assert.equal(db.auth.last_refresh_success_at, NOW.toISOString());
  assert.equal(db.auth.last_error, null);
});

test("failed token refresh keeps the last usable cookie and records a safe error", async () => {
  const db = new FakeAuthD1();
  const env = bootstrapEnv(db);
  await refreshNeteaseSession(env, {
    now: NOW,
    fetchImpl: async () => Response.json({ code: 200 }, {
      headers: { "set-cookie": "MUSIC_U=stored-music; Path=/" },
    }),
  });

  await assert.rejects(
    () => refreshNeteaseSession(env, {
      now: new Date("2026-08-11T10:00:00.000Z"),
      fetchImpl: async () => Response.json({ code: 301, message: "Need login" }),
    }),
    /登录已失效/,
  );

  assert.equal((await loadNeteaseCookieJar(env)).MUSIC_U, "stored-music");
  assert.equal(db.auth.last_error_code, "NETEASE_SESSION_EXPIRED");
  assert.equal(db.auth.last_error.includes("stored-music"), false);
});

test("QR login persists a successful music session and exposes only state", async () => {
  const db = new FakeAuthD1();
  const env = bootstrapEnv(db);
  const create = await createNeteaseQrLogin({
    fetchImpl: async () => Response.json({ code: 200, unikey: "qr-key" }),
  });

  assert.deepEqual(create, {
    key: "qr-key",
    loginUrl: "https://music.163.com/login?codekey=qr-key",
  });

  const waiting = await checkNeteaseQrLogin(env, "qr-key", {
    now: NOW,
    fetchImpl: async () => Response.json({ code: 801, message: "waiting" }),
  });
  assert.deepEqual(waiting, { state: "waiting", message: "等待扫码" });

  const success = await checkNeteaseQrLogin(env, "qr-key", {
    now: NOW,
    fetchImpl: async () => Response.json({
      code: 803,
      message: "success",
      cookie: "MUSIC_U=qr-music; __csrf=qr-csrf; NTES_SESS=mail-must-be-ignored",
    }),
  });
  assert.deepEqual(success, { state: "success", message: "登录成功" });
  assert.equal((await loadNeteaseCookieJar(env)).MUSIC_U, "qr-music");
  assert.equal((await loadNeteaseCookieJar(env)).NTES_SESS, undefined);
  assert.equal(db.auth.last_login_at, NOW.toISOString());
});

function bootstrapEnv(db) {
  return {
    DB: db,
    NETEASE_COOKIE_KEY: SECRET,
    NETEASE_MUSIC_U: "bootstrap-music",
    NETEASE_CSRF: "bootstrap-csrf",
  };
}

class FakeAuthD1 {
  auth = {
    id: 1,
    encrypted_cookie: null,
    cookie_iv: null,
    last_refresh_attempt_at: null,
    last_refresh_success_at: null,
    last_login_at: null,
    last_error_code: null,
    last_error: null,
    updated_at: null,
  };

  prepare(sql) {
    return new FakeAuthStatement(this, sql);
  }
}

class FakeAuthStatement {
  args = [];

  constructor(db, sql) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, " ").trim();
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async first() {
    if (this.sql.startsWith("SELECT * FROM netease_auth_state")) return { ...this.db.auth };
    throw new Error(`Unsupported first: ${this.sql}`);
  }

  async run() {
    if (this.sql.startsWith("UPDATE netease_auth_state SET last_refresh_attempt_at")) {
      const [attemptedAt, errorCode, errorMessage, updatedAt] = this.args;
      Object.assign(this.db.auth, {
        last_refresh_attempt_at: attemptedAt,
        last_error_code: errorCode,
        last_error: errorMessage,
        updated_at: updatedAt,
      });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("UPDATE netease_auth_state SET encrypted_cookie")) {
      const [encryptedCookie, cookieIv, attemptedAt, successAt, loginAt, updatedAt] = this.args;
      Object.assign(this.db.auth, {
        encrypted_cookie: encryptedCookie,
        cookie_iv: cookieIv,
        last_refresh_attempt_at: attemptedAt,
        last_refresh_success_at: successAt,
        last_login_at: loginAt ?? this.db.auth.last_login_at,
        last_error_code: null,
        last_error: null,
        updated_at: updatedAt,
      });
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unsupported run: ${this.sql}`);
  }
}
