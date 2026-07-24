import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Life ends with Game and localized routes retain locale prefixes", () => {
  const header = read("src/components/site/Header.astro");
  assert.match(header, /Books[\s\S]*Music[\s\S]*Screen[\s\S]*Game/);
  assert.match(header, /localizePath\(item\.href, locale\)/);
  const localized = read("src/pages/[locale]/art/[type]/index.astro");
  assert.match(localized, /"music", "book", "screen", "game"/);
});

test("Game is standalone, absent from the SPA canvas, and sorted by effective playtime", () => {
  assert.match(read("src/pages/art/game/index.astro"), /BaseLayout[\s\S]*GameSection/);
  assert.doesNotMatch(read("src/layouts/SpaLayout.astro"), /GameSection|\/art\/game\//);
  assert.match(read("src/lib/games.ts"), /COALESCE\(custom_playtime_minutes, steam_playtime_minutes\) DESC, title COLLATE NOCASE ASC/);
});

test("homepage social links use GitHub Bilibili Steam Email order and exact profile", () => {
  const home = read("src/components/sections/HomeSection.astro");
  assert.match(home, /aria-label="GitHub"[\s\S]*aria-label="Bilibili"[\s\S]*aria-label="Steam"[\s\S]*aria-label="Email"/);
  assert.match(home, /https:\/\/steamcommunity\.com\/profiles\/76561198437201442/);
  assert.match(home, /M11\.979 0C5\.678/);
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

test("game administration refreshes from the completed sync response without cached list data", () => {
  const admin = read("src/components/domain/GamesAdmin.tsx");
  const listApi = read("functions/api/admin/games.js");
  const syncApi = read("functions/api/admin/games/sync.js");

  assert.match(admin, /fetchJson<\{ items: GameItem\[\]; syncState: SyncState \}>\("\/api\/admin\/games", \{ cache: "no-store" \}\)/);
  assert.match(admin, /\/api\/admin\/games\/sync[\s\S]*setItems\(result\.items\); setSyncState\(result\.syncState\)/);
  assert.doesNotMatch(admin, /同步完成[\s\S]*await loadItems\(\)/);
  assert.match(listApi, /cache-control": "private, no-store"/);
  assert.match(syncApi, /listGames\(db\)[\s\S]*getSyncState\(db\)[\s\S]*items, syncState/);
});
