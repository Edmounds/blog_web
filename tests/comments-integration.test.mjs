import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createComment,
  listAdminComments,
  listPublicComments,
  setCommentHidden,
} from "../functions/_shared/comments.js";

test("D1-style comment storage lists newest first, paginates, hides, restores, and rate limits", async () => {
  const db = new FakeD1();
  const request = new Request("https://blog.muelsyse.us/api/comments", {
    headers: {
      "cf-connecting-ip": "203.0.113.10",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  });
  const base = new Date("2026-07-23T00:00:00.000Z");

  for (let index = 0; index < 21; index += 1) {
    const result = await createComment(
      db,
      requestWithIp(request, `203.0.113.${index + 1}`),
      { contentId: "blog/designing-for-clarity-in-chaos", name: `访客${index}`, content: `<script>alert(${index})</script>\n第二行` },
      "test-only-secret",
      new Date(base.getTime() + index * 61_000),
    );
    assert.equal(result.ok, true);
  }

  const first = await listPublicComments(db, "blog/designing-for-clarity-in-chaos");
  assert.equal(first.items.length, 20);
  assert.equal(first.items[0].id, 21);
  assert.equal(first.items[0].content, "<script>alert(20)</script>\n第二行");
  assert.equal(first.nextCursor, "2");

  const second = await listPublicComments(db, "blog/designing-for-clarity-in-chaos", Number(first.nextCursor));
  assert.deepEqual(second.items.map((item) => item.id), [1]);

  const hidden = await setCommentHidden(db, 21, true, new Date("2026-07-23T02:00:00.000Z"));
  assert.equal(hidden.hidden, true);
  assert.equal((await listPublicComments(db, "blog/designing-for-clarity-in-chaos")).items.some((item) => item.id === 21), false);
  assert.equal((await listAdminComments(db, "blog/designing-for-clarity-in-chaos", "hidden")).items[0].id, 21);

  const restored = await setCommentHidden(db, 21, false);
  assert.equal(restored.hidden, false);
  assert.equal((await listPublicComments(db, "blog/designing-for-clarity-in-chaos")).items[0].id, 21);

  const firstAttempt = await createComment(
    db,
    requestWithIp(request, "198.51.100.9"),
    { contentId: "blog/designing-for-clarity-in-chaos", name: "限频", content: "第一次" },
    "test-only-secret",
    new Date("2026-07-23T03:00:00.000Z"),
  );
  const secondAttempt = await createComment(
    db,
    requestWithIp(request, "198.51.100.9"),
    { contentId: "blog/designing-for-clarity-in-chaos", name: "限频", content: "第二次" },
    "test-only-secret",
    new Date("2026-07-23T03:00:30.000Z"),
  );
  assert.equal(firstAttempt.ok, true);
  assert.deepEqual(secondAttempt, { ok: false, retryAfter: 30 });
});

test("comments isolate identical slugs across Blog Note and Project", async () => {
  const db = new FakeD1();
  const request = new Request("https://blog.muelsyse.us/api/comments", { headers: { "cf-connecting-ip": "203.0.113.42" } });
  for (const [index, section] of ["blog", "note", "project"].entries()) {
    const result = await createComment(
      db,
      requestWithIp(request, `203.0.113.${42 + index}`),
      { contentId: `${section}/shared-slug`, name: section, content: `${section} comment` },
      "test-only-secret",
      new Date(`2026-07-24T00:0${index}:00.000Z`),
    );
    assert.equal(result.ok, true);
  }

  for (const section of ["blog", "note", "project"]) {
    const page = await listPublicComments(db, `${section}/shared-slug`);
    assert.deepEqual(page.items.map((item) => item.content), [`${section} comment`]);
  }
});

function requestWithIp(request, ip) {
  const headers = new Headers(request.headers);
  headers.set("cf-connecting-ip", ip);
  return new Request(request.url, { headers });
}

class FakeD1 {
  comments = [];
  rateLimits = new Map();
  nextId = 1;

  prepare(sql) {
    return new FakeStatement(this, sql);
  }
}

class FakeStatement {
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
    if (this.sql.startsWith("DELETE FROM comment_rate_limits")) {
      const [minimum] = this.args;
      for (const [hash, timestamp] of this.db.rateLimits) if (timestamp < minimum) this.db.rateLimits.delete(hash);
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("INSERT INTO comments")) {
      const [slug, name, content, device_label, region_label, created_at] = this.args;
      const row = { id: this.db.nextId++, slug, name, content, device_label, region_label, created_at, is_hidden: 0, hidden_at: null };
      this.db.comments.push(row);
      return { meta: { changes: 1, last_row_id: row.id } };
    }
    if (this.sql.startsWith("INSERT INTO comment_rate_limits")) {
      this.db.rateLimits.set(this.args[0], this.args[1]);
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("UPDATE comments SET is_hidden")) {
      const [hidden, hiddenAt, id] = this.args;
      const row = this.db.comments.find((comment) => comment.id === id);
      if (!row) return { meta: { changes: 0 } };
      row.is_hidden = hidden;
      row.hidden_at = hiddenAt;
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unsupported run: ${this.sql}`);
  }

  async first() {
    if (this.sql.startsWith("SELECT last_submitted_at")) {
      const value = this.db.rateLimits.get(this.args[0]);
      return value === undefined ? null : { last_submitted_at: value };
    }
    if (this.sql.startsWith("SELECT * FROM comments WHERE id")) {
      return this.db.comments.find((comment) => comment.id === this.args[0]) ?? null;
    }
    throw new Error(`Unsupported first: ${this.sql}`);
  }

  async all() {
    if (!this.sql.startsWith("SELECT * FROM comments")) throw new Error(`Unsupported all: ${this.sql}`);
    const [slug, maybeCursor, maybeLimit] = this.args;
    const hasCursor = this.sql.includes("AND id < ?");
    const cursor = hasCursor ? maybeCursor : undefined;
    const limit = hasCursor ? maybeLimit : maybeCursor;
    const visibleOnly = this.sql.includes("is_hidden = 0");
    const hiddenOnly = this.sql.includes("is_hidden = 1");
    const results = this.db.comments
      .filter((comment) => comment.slug === slug)
      .filter((comment) => cursor === undefined || comment.id < cursor)
      .filter((comment) => !visibleOnly || comment.is_hidden === 0)
      .filter((comment) => !hiddenOnly || comment.is_hidden === 1)
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
    return { results };
  }
}
