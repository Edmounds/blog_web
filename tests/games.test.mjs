import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchSteamOwnedGames, parsePlaytimeMinutes, parseSteamOwnedGames, syncSteamGames, validateGameCreate, validateGameUpdate,
} from "../functions/_shared/games.js";
import { onRequestGet as listAdminGames } from "../functions/api/admin/games.js";

test("Steam request includes app info and played free games and parses minutes", async () => {
  let requested;
  const games = await fetchSteamOwnedGames("secret", async (url) => {
    requested = new URL(url);
    return Response.json({ response: { games: [{ appid: 10, name: "Game", playtime_forever: 125 }] } });
  });
  assert.equal(requested.searchParams.get("include_appinfo"), "true");
  assert.equal(requested.searchParams.get("include_played_free_games"), "true");
  assert.equal(requested.searchParams.get("steamid"), "76561198437201442");
  assert.deepEqual(games, [{ appId: 10, title: "Game", playtimeMinutes: 125 }]);
});

test("Steam parsing deduplicates app IDs and rejects malformed inventories", () => {
  assert.deepEqual(parseSteamOwnedGames({ response: { games: [
    { appid: 10, name: "Old", playtime_forever: 1 },
    { appid: 10, name: "New", playtime_forever: 2 },
  ] } }), [{ appId: 10, title: "New", playtimeMinutes: 2 }]);
  assert.throws(() => parseSteamOwnedGames({ response: {} }));
});

test("playtime validation accepts one decimal, clears Steam overrides, and rejects negatives", () => {
  assert.deepEqual(parsePlaytimeMinutes("1.5"), { ok: true, value: 90 });
  assert.deepEqual(parsePlaytimeMinutes("", { required: false }), { ok: true, value: null });
  assert.equal(parsePlaytimeMinutes("-1").ok, false);
  assert.equal(parsePlaytimeMinutes("1.25").ok, false);
  assert.equal(validateGameUpdate({ customPlaytimeHours: "" }, { source: "steam" }).value.customPlaytimeMinutes, null);
});

test("manual games require title, non-negative time, cover, and visibility", () => {
  const valid = validateGameCreate({ title: "Console Game", customPlaytimeHours: "0", coverKey: "game/11111111-1111-4111-8111-111111111111.webp", isVisible: true });
  assert.equal(valid.ok, true);
  assert.equal(validateGameCreate({ title: "", customPlaytimeHours: "0", coverKey: valid.value.coverKey, isVisible: true }).ok, false);
  assert.equal(validateGameCreate({ title: "Game", customPlaytimeHours: "0" , isVisible: true }).ok, false);
});

test("Steam sync preserves overrides, custom covers, visibility, missing games, and manual rows", async () => {
  const db = new FakeD1([
    row({ id: "steam-one", source: "steam", steam_app_id: 1, title: "Old", steam_playtime_minutes: 60, custom_playtime_minutes: 600, is_visible: 0, cover_key: "game/custom.webp", last_seen_at: "old" }),
    row({ id: "steam-missing", source: "steam", steam_app_id: 2, title: "Missing", steam_playtime_minutes: 120, last_seen_at: "old" }),
    row({ id: "manual", source: "manual", title: "Manual", custom_playtime_minutes: 300, cover_key: "game/manual.webp" }),
  ]);
  const result = await syncSteamGames({ DB: db, STEAM_API_KEY: "key" }, {
    now: new Date("2026-07-25T20:00:00Z"),
    fetchImpl: async () => Response.json({ response: { games: [
      { appid: 1, name: "Updated", playtime_forever: 180 },
      { appid: 3, name: "New", playtime_forever: 0 },
    ] } }),
  });
  assert.deepEqual(result, { added: 1, updated: 1, unchanged: 0, total: 2, syncedAt: "2026-07-25T20:00:00.000Z" });
  const updated = db.items.get("steam-one");
  assert.equal(updated.title, "Updated"); assert.equal(updated.steam_playtime_minutes, 180);
  assert.equal(updated.custom_playtime_minutes, 600); assert.equal(updated.cover_key, "game/custom.webp"); assert.equal(updated.is_visible, 0);
  assert.equal(db.items.get("steam-missing").last_seen_at, "old");
  assert.equal(db.items.get("manual").title, "Manual");
});

test("Steam failure records state without mutating game rows and does not expose the key", async () => {
  const db = new FakeD1([row({ id: "steam", source: "steam", steam_app_id: 1, title: "Stable", steam_playtime_minutes: 60 })]);
  const before = structuredClone([...db.items.entries()]);
  await assert.rejects(() => syncSteamGames({ DB: db, STEAM_API_KEY: "super-secret" }, { fetchImpl: async () => new Response("bad", { status: 429 }) }), /HTTP 429/);
  assert.deepEqual([...db.items.entries()], before);
  assert.equal(db.sync.last_error.includes("super-secret"), false);
});

test("empty Steam inventories still record a successful sync", async () => {
  const db = new FakeD1();
  const result = await syncSteamGames({ DB: db, STEAM_API_KEY: "key" }, {
    now: new Date("2026-07-25T20:00:00Z"),
    fetchImpl: async () => Response.json({ response: { games: [] } }),
  });
  assert.deepEqual(result, { added: 0, updated: 0, unchanged: 0, total: 0, syncedAt: "2026-07-25T20:00:00.000Z" });
  assert.equal(db.sync.last_success_at, "2026-07-25T20:00:00.000Z");
});

test("admin game lists are never served from browser or shared caches", async () => {
  const response = await listAdminGames({
    env: {
      DB: {
        prepare(sql) {
          if (sql.includes("FROM game_items")) return { bind: () => ({ all: async () => ({ results: [] }) }) };
          if (sql.includes("FROM game_sync_state")) return { first: async () => null };
          throw new Error(`Unexpected query: ${sql}`);
        },
      },
    },
    request: new Request("https://blog.muelsyse.us/api/admin/games"),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), {
    items: [],
    syncState: { lastAttemptAt: null, lastSuccessAt: null, lastSyncedCount: 0, lastError: null },
  });
});

function row(overrides) {
  return { id: crypto.randomUUID(), source: "steam", steam_app_id: null, title: "Game", steam_playtime_minutes: 0, custom_playtime_minutes: null, is_visible: 1, cover_key: null, last_seen_at: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", ...overrides };
}

class FakeD1 {
  items = new Map();
  sync = { id: 1, last_attempt_at: null, last_success_at: null, last_synced_count: 0, last_error: null };
  constructor(rows = []) { for (const item of rows) this.items.set(item.id, item); }
  prepare(sql) { return new FakeStatement(this, sql); }
  async batch(statements) { for (const statement of statements) await statement.run(); return []; }
}
class FakeStatement {
  args = [];
  constructor(db, sql) { this.db = db; this.sql = sql.replace(/\s+/g, " ").trim(); }
  bind(...args) { this.args = args; return this; }
  async all() {
    if (this.sql === "SELECT * FROM game_items WHERE source = 'steam'") return { results: [...this.db.items.values()].filter((item) => item.source === "steam") };
    throw new Error(`Unsupported all: ${this.sql}`);
  }
  async run() {
    if (this.sql.startsWith("INSERT INTO game_sync_state")) {
      this.db.sync.last_attempt_at = this.args[0];
      if (this.args.length > 1) this.db.sync.last_error = this.args[1];
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("INSERT INTO game_items")) {
      const [id, steam_app_id, title, steam_playtime_minutes, last_seen_at, created_at, updated_at] = this.args;
      this.db.items.set(id, row({ id, source: "steam", steam_app_id, title, steam_playtime_minutes, last_seen_at, created_at, updated_at }));
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("UPDATE game_items SET title")) {
      const [title, steam_playtime_minutes, last_seen_at, updated_at, id] = this.args;
      this.db.items.set(id, { ...this.db.items.get(id), title, steam_playtime_minutes, last_seen_at, updated_at });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("UPDATE game_items SET last_seen_at")) {
      const [last_seen_at, id] = this.args; this.db.items.set(id, { ...this.db.items.get(id), last_seen_at }); return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("UPDATE game_sync_state")) {
      const [last_attempt_at, last_success_at, last_synced_count] = this.args;
      this.db.sync = { id: 1, last_attempt_at, last_success_at, last_synced_count, last_error: null };
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unsupported run: ${this.sql}`);
  }
}
