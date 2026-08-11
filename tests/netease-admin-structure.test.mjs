import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

test("admin navigation exposes an Access-protected NetEase ranking manager", () => {
  assert.match(read("src/components/domain/AdminNav.astro"), /听歌排行/);
  assert.equal(exists("src/pages/admin/music/index.astro"), true);
  assert.match(read("src/pages/admin/music/index.astro"), /NeteaseAdmin/);
  assert.match(read("src/middleware.ts"), /pathname\.startsWith\("\/admin\/"\)/);
  assert.match(read("src/middleware.ts"), /pathname\.startsWith\("\/api\/admin\/"\)/);
});

test("NetEase admin APIs cover status, manual sync, and QR login", () => {
  for (const path of [
    "src/pages/api/admin/netease/status.ts",
    "src/pages/api/admin/netease/sync.ts",
    "src/pages/api/admin/netease/qr.ts",
    "src/pages/api/admin/netease/qr/check.ts",
  ]) assert.equal(exists(path), true, `${path} must exist`);

  const component = read("src/components/domain/NeteaseAdmin.tsx");
  assert.match(component, /最近刷新成功/);
  assert.match(component, /最近错误/);
  assert.match(component, /重新登录/);
  assert.match(component, /QRCode\.toDataURL/);
});

test("scheduled ranking sync refreshes the session and the schema stores encrypted cookies", () => {
  assert.match(read("src/worker.ts"), /syncNeteaseRankingsWithRefresh/);
  const schema = read("schema/netease_music.sql");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS netease_auth_state/);
  assert.match(schema, /encrypted_cookie TEXT/);
  assert.match(schema, /cookie_iv TEXT/);
  assert.match(read("src/env.d.ts"), /NETEASE_COOKIE_KEY/);
});
