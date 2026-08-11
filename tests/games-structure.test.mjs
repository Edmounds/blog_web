import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Life ends with Game and localized routes retain locale prefixes", () => {
  const header = read("src/components/site/Header.astro");
  assert.match(header, /const links = \{ label: "Links"[\s\S]*?<div class="life-menu">/);
  assert.match(header, /Books[\s\S]*Music[\s\S]*Screen[\s\S]*Game/);
  assert.match(header, /localizePath\(item\.href, locale\)/);
  const localized = read("src/pages/[locale]/art/[type]/index.astro");
  assert.match(localized, /"music", "book", "screen", "game"/);
});

test("Game is standalone, absent from the SPA canvas, and sorted by effective playtime", () => {
  assert.match(read("src/pages/art/game/index.astro"), /BaseLayout[\s\S]*GameSection/);
  assert.doesNotMatch(read("src/layouts/SpaLayout.astro"), /GameSection|\/art\/game\//);
  assert.match(read("src/lib/games.ts"), /listPublicGames\(db\)/);
  assert.match(read("src/server/games.js"), /COALESCE\(custom_playtime_minutes, steam_playtime_minutes\) DESC, title COLLATE NOCASE ASC/);
  assert.match(read("src/components/cards/GameCard.astro"), /data-game-cover-fallback/);
  assert.match(read("src/pages/api/game/steam-cover\/\[appId\]\.ts"), /server\/api\/game\/steam-cover\.js/);
});

test("homepage exposes labelled Steam and NetEase links", () => {
  const home = read("src/components/sections/HomeSection.astro");
  assert.match(home, /aria-label="Steam"/);
  assert.match(home, /aria-label="NetEase Cloud Music"/);
  assert.match(home, /https:\/\/steamcommunity\.com\/profiles\//);
  assert.match(home, /https:\/\/y\.music\.163\.com\//);
});

test("CSP adds only the exact Steam image host and cron uses the shared sync function", () => {
  for (const path of ["src/middleware.ts", "public/_headers", "workers/blog-preferred-proxy.js"]) {
    const value = read(path);
    assert.match(value, /https:\/\/shared\.akamai\.steamstatic\.com/);
    assert.doesNotMatch(value, /steamstatic\.com\s*\*/);
  }
  assert.match(read("wrangler.astro.jsonc"), /"crons": \["0 20 \* \* \*"\]/);
  assert.match(read("src/worker.ts"), /handle\(request, env, ctx\)[\s\S]*syncSteamGames/);
});

test("the daily cron independently syncs both NetEase rankings", () => {
  const worker = read("src/worker.ts");
  const envTypes = read("src/env.d.ts");
  const schema = read("schema/netease_music.sql");
  const packageJson = read("package.json");

  assert.match(worker, /syncNeteaseRankingsWithRefresh/);
  assert.match(worker, /ctx\.waitUntil\(syncSteamGames[\s\S]*ctx\.waitUntil\(syncNeteaseRankingsWithRefresh\(env\)/);
  assert.match(worker, /\["refresh", "weekly", "total"\]/);
  assert.match(envTypes, /NETEASE_MUSIC_U\?: string/);
  assert.match(envTypes, /NETEASE_CSRF\?: string/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS netease_weekly_ranking/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS netease_total_ranking/);
  assert.match(packageJson, /schema\/netease_music\.sql/);
  assert.match(packageJson, /"netease:sync": "node scripts\/sync-netease-ranking\.mjs"/);
  for (const path of ["src/middleware.ts", "public/_headers", "workers/blog-preferred-proxy.js"]) {
    assert.match(read(path), /https:\/\/p1\.music\.126\.net/);
  }
});

test("game administration refreshes from the completed sync response without cached list data", () => {
  const admin = read("src/components/domain/GamesAdmin.tsx");
  const listApi = read("src/server/api/admin/games/index.js");
  const syncApi = read("src/server/api/admin/games/sync.js");

  assert.match(admin, /fetchJson<\{ items: GameItem\[\]; syncState: SyncState \}>\("\/api\/admin\/games", \{ cache: "no-store" \}\)/);
  assert.match(admin, /\/api\/admin\/games\/sync[\s\S]*setItems\(result\.items\); setSyncState\(result\.syncState\)/);
  assert.doesNotMatch(admin, /同步完成[\s\S]*await loadItems\(\)/);
  assert.match(listApi, /cache-control": "private, no-store"/);
  assert.match(syncApi, /listGames\(db\)[\s\S]*getSyncState\(db\)[\s\S]*items, syncState/);
});
