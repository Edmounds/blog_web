import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchNeteaseRanking,
  listNeteaseRanking,
  parseNeteaseRanking,
  syncNeteaseRanking,
  syncNeteaseRankings,
} from "../functions/_shared/netease-music.js";

test("NetEase weekly ranking keeps the first 20 songs in API order", () => {
  const ranking = parseNeteaseRanking(payload({ weekCount: 24 }), "weekly", new Date("2026-07-26T00:00:00.000Z"));

  assert.equal(ranking.length, 20);
  assert.deepEqual(ranking[0], expectedItem(1, "2026-07-26T00:00:00.000Z"));
  assert.equal(ranking[19].songId, 1019);
});

test("NetEase total ranking keeps the first 50 songs in API order", () => {
  const ranking = parseNeteaseRanking(payload({ allCount: 54 }), "total", new Date("2026-07-26T00:00:00.000Z"));

  assert.equal(ranking.length, 50);
  assert.deepEqual(ranking[0], expectedItem(1, "2026-07-26T00:00:00.000Z"));
  assert.equal(ranking[49].songId, 1049);
});

test("each NetEase ranking rejects incomplete, malformed, and anonymous all-zero responses", () => {
  assert.throws(() => parseNeteaseRanking(payload({ weekCount: 19 }), "weekly"), /20/);
  assert.throws(() => parseNeteaseRanking(payload({ allCount: 49 }), "total"), /50/);

  const malformed = payload({ allCount: 50 });
  malformed.allData[7].song.name = "";
  assert.throws(() => parseNeteaseRanking(malformed, "total"), /无效的歌曲/);

  const anonymousWeekly = payload({ weekCount: 20 });
  for (const item of anonymousWeekly.weekData) item.playCount = 0;
  assert.throws(() => parseNeteaseRanking(anonymousWeekly, "weekly"), /播放次数/);

  const anonymousTotal = payload({ allCount: 50 });
  for (const item of anonymousTotal.allData) item.playCount = 0;
  assert.throws(() => parseNeteaseRanking(anonymousTotal, "total"), /播放次数/);
});

test("NetEase requests select the matching API type and data field without returning credentials", async () => {
  const requests = [];
  const env = { NETEASE_MUSIC_U: "music-secret", NETEASE_CSRF: "csrf-secret" };
  const fetchImpl = async (input, init) => {
    requests.push({ url: String(input), init });
    return Response.json(payload({ weekCount: 20, allCount: 50 }));
  };

  const weekly = await fetchNeteaseRanking(env, "weekly", fetchImpl);
  const total = await fetchNeteaseRanking(env, "total", fetchImpl);

  assert.equal(weekly.length, 20);
  assert.equal(total.length, 50);
  assert.match(requests[0].url, /uid=1460343107/);
  assert.match(requests[0].url, /type=1/);
  assert.match(requests[1].url, /type=0/);
  assert.equal(requests[0].init.headers.cookie, "MUSIC_U=music-secret; __csrf=csrf-secret");
  assert.equal(JSON.stringify({ weekly, total }).includes("music-secret"), false);
});

test("successful weekly and total syncs atomically replace their own stored rankings", async () => {
  const db = new FakeD1({
    weekly: [storedRow({ song_id: 1, title: "Old weekly" })],
    total: [storedRow({ song_id: 2, title: "Old total" })],
  });
  const env = { DB: db, NETEASE_MUSIC_U: "music", NETEASE_CSRF: "csrf" };
  const fetchImpl = async (input) => Response.json(payload(
    String(input).includes("type=1") ? { weekCount: 20 } : { allCount: 50 },
  ));

  const weeklyResult = await syncNeteaseRanking(env, "weekly", { now: fixedNow(), fetchImpl });
  const totalResult = await syncNeteaseRanking(env, "total", { now: fixedNow(), fetchImpl });

  assert.deepEqual(weeklyResult, { type: "weekly", total: 20, syncedAt: fixedNow().toISOString() });
  assert.deepEqual(totalResult, { type: "total", total: 50, syncedAt: fixedNow().toISOString() });
  assert.equal(db.rows.weekly.size, 20);
  assert.equal(db.rows.total.size, 50);
  assert.equal(db.rows.weekly.get(1).song_id, 1000);
  assert.equal(db.rows.total.get(50).song_id, 1049);
  assert.equal(db.sync.weekly.last_error, null);
  assert.equal(db.sync.total.last_error, null);

  const weekly = await listNeteaseRanking(db, "weekly");
  const total = await listNeteaseRanking(db, "total");
  assert.equal(weekly.length, 20);
  assert.equal(total.length, 50);
  assert.deepEqual(total[0].artists, ["Artist 1", "Guest 1"]);
});

test("a failed ranking sync keeps that ranking's old rows and records only its error", async () => {
  const db = new FakeD1({
    weekly: [storedRow({ song_id: 77, title: "Stable weekly" })],
    total: [storedRow({ song_id: 88, title: "Stable total" })],
  });

  await assert.rejects(
    () => syncNeteaseRanking({ DB: db, NETEASE_MUSIC_U: "super-secret", NETEASE_CSRF: "csrf" }, "total", {
      now: fixedNow(),
      fetchImpl: async () => new Response("rate limited", { status: 429 }),
    }),
    /HTTP 429/,
  );

  assert.equal(db.rows.weekly.get(1).song_id, 77);
  assert.equal(db.rows.total.get(1).song_id, 88);
  assert.equal(db.sync.weekly.last_error, null);
  assert.match(db.sync.total.last_error, /HTTP 429/);
  assert.equal(db.sync.total.last_error.includes("super-secret"), false);
});

test("combined synchronization lets one ranking succeed when the other fails", async () => {
  const db = new FakeD1({
    weekly: [storedRow({ song_id: 77, title: "Stable weekly" })],
    total: [storedRow({ song_id: 88, title: "Old total" })],
  });
  const result = await syncNeteaseRankings({ DB: db, NETEASE_MUSIC_U: "music", NETEASE_CSRF: "csrf" }, {
    now: fixedNow(),
    fetchImpl: async (input) => String(input).includes("type=1")
      ? new Response("rate limited", { status: 429 })
      : Response.json(payload({ allCount: 50 })),
  });

  assert.equal(result.weekly.status, "rejected");
  assert.equal(result.total.status, "fulfilled");
  assert.equal(db.rows.weekly.size, 1);
  assert.equal(db.rows.weekly.get(1).song_id, 77);
  assert.equal(db.rows.total.size, 50);
  assert.match(db.sync.weekly.last_error, /HTTP 429/);
  assert.equal(db.sync.total.last_error, null);
});

test("music pages stay available before either additive ranking table exists", async () => {
  const db = {
    prepare(sql) {
      return { all: async () => { throw new Error(`D1_ERROR: no such table: ${sql.includes("total") ? "netease_total_ranking" : "netease_weekly_ranking"}`); } };
    },
  };

  assert.deepEqual(await listNeteaseRanking(db, "weekly"), []);
  assert.deepEqual(await listNeteaseRanking(db, "total"), []);
});

function expectedItem(number, syncedAt) {
  return {
    rank: number,
    songId: 999 + number,
    title: `Song ${number}`,
    artists: [`Artist ${number}`, `Guest ${number}`],
    coverUrl: `https://p1.music.126.net/cover-${number}.jpg`,
    playCount: Math.max(1, 80 - number),
    score: Math.max(1, 101 - number),
    syncedAt,
  };
}

function payload({ weekCount = 0, allCount = 0 } = {}) {
  return {
    code: 200,
    weekData: entries(weekCount),
    allData: entries(allCount),
  };
}

function entries(count) {
  return Array.from({ length: count }, (_, index) => ({
    playCount: Math.max(1, 79 - index),
    score: Math.max(1, 100 - index),
    song: {
      id: 1000 + index,
      name: `Song ${index + 1}`,
      ar: [{ name: `Artist ${index + 1}` }, { name: `Guest ${index + 1}` }],
      al: { picUrl: `http://p${(index % 3) + 1}.music.126.net/cover-${index + 1}.jpg` },
    },
  }));
}

function storedRow(overrides = {}) {
  return {
    rank: 1,
    song_id: 1000,
    title: "Song",
    artists_json: '["Artist"]',
    cover_url: null,
    play_count: 1,
    score: 100,
    synced_at: "2026-07-25T04:00:00.000Z",
    ...overrides,
  };
}

function fixedNow() {
  return new Date("2026-07-26T04:00:00.000Z");
}

class FakeD1 {
  rows = { weekly: new Map(), total: new Map() };
  sync = {
    weekly: syncRow(),
    total: syncRow(),
  };

  constructor(rows = {}) {
    for (const type of ["weekly", "total"]) {
      for (const row of rows[type] ?? []) this.rows[type].set(row.rank, row);
    }
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async batch(statements) {
    const rows = structuredClone(this.rows);
    const sync = structuredClone(this.sync);
    try {
      for (const statement of statements) await statement.run();
    } catch (error) {
      this.rows = rows;
      this.sync = sync;
      throw error;
    }
    return statements.map(() => ({ success: true }));
  }
}

class FakeStatement {
  args = [];

  constructor(db, sql) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.type = this.sql.includes("netease_total") ? "total" : "weekly";
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async all() {
    if (this.sql.startsWith("SELECT * FROM netease_")) {
      return { results: [...this.db.rows[this.type].values()].sort((a, b) => a.rank - b.rank) };
    }
    throw new Error(`Unsupported all: ${this.sql}`);
  }

  async run() {
    if (this.sql.startsWith("INSERT INTO netease_") && this.sql.includes("sync_state") && this.sql.includes("ON CONFLICT")) {
      this.db.sync[this.type].last_attempt_at = this.args[0];
      if (this.args.length > 1) this.db.sync[this.type].last_error = this.args[1];
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("INSERT OR REPLACE INTO netease_")) {
      const [rank, song_id, title, artists_json, cover_url, play_count, score, synced_at] = this.args;
      this.db.rows[this.type].set(rank, { rank, song_id, title, artists_json, cover_url, play_count, score, synced_at });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("UPDATE netease_")) {
      const [last_attempt_at, last_success_at, last_synced_count] = this.args;
      this.db.sync[this.type] = { id: 1, last_attempt_at, last_success_at, last_synced_count, last_error: null };
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unsupported run: ${this.sql}`);
  }
}

function syncRow() {
  return { id: 1, last_attempt_at: null, last_success_at: null, last_synced_count: 0, last_error: null };
}
