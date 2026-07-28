import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getStats,
  getVisitorHash,
  getViewWindowStart,
  incrementLike,
  normalizeContentId,
  requireSameOriginJson,
  recordView,
  resetViewPruneScheduleForTests,
  scheduleViewEventPrune,
} from "../src/lib/engagement.ts";
import { createEdgeCacheKey, noStore, readEdgeJson } from "../src/lib/edge-cache.ts";
import { readFileSync } from "node:fs";
import { CONTENT_IDS } from "../src/lib/post-slugs.ts";

test("normalizeContentId accepts a published content ID", () => {
  const contentId = CONTENT_IDS[0];
  assert.ok(contentId, "the fixture requires at least one published content item");
  assert.equal(normalizeContentId(contentId), contentId);
  assert.equal(normalizeContentId("about/profile"), undefined);
});

test("the content ID migration prefixes every legacy Blog table idempotently", () => {
  const sql = readFileSync(new URL("../schema/content_ids.sql", import.meta.url), "utf8");
  assert.match(sql, /INSERT INTO post_stats[\s\S]*ON CONFLICT\(slug\) DO UPDATE/);
  assert.match(sql, /views = post_stats\.views \+ excluded\.views/);
  assert.match(sql, /likes = post_stats\.likes \+ excluded\.likes/);
  assert.match(sql, /INSERT OR IGNORE INTO post_view_events/);
  assert.match(sql, /UPDATE comments[\s\S]*SET slug = 'blog\/' \|\| slug/);
  assert.match(sql, /DELETE FROM post_stats[\s\S]*WHERE slug NOT LIKE '%\/%'/);
  assert.match(sql, /DELETE FROM post_view_events[\s\S]*WHERE slug NOT LIKE '%\/%'/);
});

test("statistics isolate identical slugs across content sections", async () => {
  const db = new FakeStatsD1();
  await incrementLike(db, "blog/shared-slug");
  await incrementLike(db, "note/shared-slug");
  await incrementLike(db, "note/shared-slug");

  assert.deepEqual(await getStats(db, "blog/shared-slug"), { contentId: "blog/shared-slug", views: 0, likes: 1 });
  assert.deepEqual(await getStats(db, "note/shared-slug"), { contentId: "note/shared-slug", views: 0, likes: 2 });
  assert.deepEqual(await getStats(db, "project/shared-slug"), { contentId: "project/shared-slug", views: 0, likes: 0 });
});

test("normalizeContentId rejects unknown or malformed content IDs", () => {
  assert.equal(normalizeContentId("missing-post"), undefined);
  assert.equal(normalizeContentId("../blog/example-post"), undefined);
  assert.equal(normalizeContentId("future of interface"), undefined);
  assert.equal(normalizeContentId(undefined), undefined);
});

test("getViewWindowStart groups timestamps into six hour windows", () => {
  assert.equal(getViewWindowStart(0), 0);
  assert.equal(getViewWindowStart(21_599_000), 0);
  assert.equal(getViewWindowStart(21_600_000), 21_600);
});

test("visitor hashes are stable in the Workers runtime", async () => {
  const request = new Request("https://blog.example/api/view", { headers: { "cf-connecting-ip": "203.0.113.10", "user-agent": "test" } });
  const hash = await getVisitorHash(request, "blog/example-post");
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test("requireSameOriginJson accepts same-origin JSON requests", () => {
  const request = new Request("https://blog.muelsyse.us/api/like", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      origin: "https://blog.muelsyse.us",
      "sec-fetch-site": "same-origin",
    },
  });

  assert.doesNotThrow(() => requireSameOriginJson(request));
});

test("requireSameOriginJson rejects cross-origin writes", () => {
  const request = new Request("https://blog.muelsyse.us/api/like", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.example",
      "sec-fetch-site": "cross-site",
    },
  });

  assert.throws(() => requireSameOriginJson(request), Response);
});

test("requireSameOriginJson rejects non-JSON writes", () => {
  const request = new Request("https://blog.muelsyse.us/api/like", {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      origin: "https://blog.muelsyse.us",
    },
  });

  assert.throws(() => requireSameOriginJson(request), Response);
});

test("public engagement write routes enforce same-origin JSON", () => {
  for (const path of [
    "src/pages/api/view.ts",
    "src/pages/api/like.ts",
  ]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /requireSameOriginJson\(request\)/, `${path} must reject cross-origin writes`);
  }
});

test("one view write returns the complete latest statistics", async () => {
  const db = new FakeStatsD1();
  const result = await recordView(db, new Request("https://blog.example/api/view", { headers: { "user-agent": "test", "cf-connecting-ip": "203.0.113.10" } }), "blog/shared-slug");
  assert.deepEqual(result, { contentId: "blog/shared-slug", views: 1, likes: 0, counted: true });
});

test("edge JSON cache reports MISS then HIT while keeping browsers no-store", async () => {
  const cache = new MemoryCache();
  const request = new Request("https://blog.example/api/stats?contentId=blog%2Fshared-slug");
  const key = createEdgeCacheKey(request, "stats", { contentId: "blog/shared-slug" });
  let loads = 0;
  const load = async () => { loads += 1; return Response.json({ views: loads }); };
  const miss = await readEdgeJson(cache, key, load, () => 1);
  const hit = await readEdgeJson(cache, key, load, () => 2);
  assert.equal(miss.headers.get("x-edge-cache"), "MISS");
  assert.equal(hit.headers.get("x-edge-cache"), "HIT");
  assert.equal(hit.headers.get("cache-control"), "no-store");
  assert.equal(loads, 1);
});

test("edge JSON cache does not store errors and write responses are no-store", async () => {
  const cache = new MemoryCache();
  const key = new Request("https://blog.example/__edge-cache/stats?contentId=x");
  let loads = 0;
  const load = async () => { loads += 1; return Response.json({ error: true }, { status: 500 }); };
  await readEdgeJson(cache, key, load, () => 1);
  await readEdgeJson(cache, key, load, () => 2);
  assert.equal(loads, 2);
  assert.equal(noStore(Response.json({ ok: true })).headers.get("cache-control"), "no-store");
});

test("view event cleanup is scheduled off the request path once per six hours", async () => {
  resetViewPruneScheduleForTests();
  const db = new FakeStatsD1();
  const pending = [];
  const context = { waitUntil: (promise) => pending.push(promise) };
  assert.equal(scheduleViewEventPrune(db, context, 1_000), true);
  assert.equal(scheduleViewEventPrune(db, context, 2_000), false);
  await Promise.all(pending);
  assert.equal(db.prunes, 1);
});

test("public article interactions are native, deferred, cancelable, and optimistic", () => {
  const detail = readFileSync(new URL("../src/components/domain/ContentDetail.astro", import.meta.url), "utf8");
  const engagement = readFileSync(new URL("../src/components/domain/PostEngagement.astro", import.meta.url), "utf8");
  const comments = readFileSync(new URL("../src/components/domain/CommentsSection.astro", import.meta.url), "utf8");
  assert.doesNotMatch(detail, /client:(load|visible|idle)/);
  assert.match(engagement, /requestIdleCallback/);
  assert.match(engagement, /current\.likes \+= 1/);
  assert.match(engagement, /current\.likes = Math\.max\(0, current\.likes - 1\)/);
  assert.match(engagement, /AbortController/);
  assert.match(comments, /IntersectionObserver/);
  assert.match(comments, /rootMargin: "500px 0px"/);
  assert.match(comments, /AbortController/);
});

class FakeStatsD1 {
  rows = new Map();
  viewEvents = new Set();
  prunes = 0;

  prepare(sql) {
    return new FakeStatsStatement(this, sql);
  }
}

class FakeStatsStatement {
  args = [];

  constructor(db, sql) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, " ").trim();
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async run() {
    const [contentId] = this.args;
    if (this.sql.startsWith("INSERT OR IGNORE INTO post_stats")) {
      if (!this.db.rows.has(contentId)) this.db.rows.set(contentId, { slug: contentId, views: 0, likes: 0 });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("INSERT OR IGNORE INTO post_view_events")) {
      const key = this.args.join(":"); const added = !this.db.viewEvents.has(key); this.db.viewEvents.add(key); return { meta: { changes: added ? 1 : 0 } };
    }
    if (this.sql.startsWith("DELETE FROM post_view_events")) { this.db.prunes += 1; return { meta: { changes: 0 } }; }
    throw new Error(`Unsupported run: ${this.sql}`);
  }

  async first() {
    if (this.sql.startsWith("SELECT slug, views, likes FROM post_stats")) return this.db.rows.get(this.args[0]) ?? null;
    if (this.sql.startsWith("UPDATE post_stats SET likes")) { const row = this.db.rows.get(this.args[0]); row.likes += 1; return row; }
    if (this.sql.startsWith("UPDATE post_stats SET views")) { const row = this.db.rows.get(this.args[0]); row.views += 1; return row; }
    throw new Error(`Unsupported first: ${this.sql}`);
  }
}

class MemoryCache {
  entries = new Map();
  async match(key) { const value = this.entries.get(key.url); return value?.clone(); }
  async put(key, response) { this.entries.set(key.url, response.clone()); }
}
