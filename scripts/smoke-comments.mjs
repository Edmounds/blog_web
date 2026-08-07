import { getPlatformProxy } from "wrangler";

import {
  createComment,
  listAdminComments,
  listPublicComments,
  setCommentHidden,
} from "../src/lib/comments.ts";

const platform = await getPlatformProxy({
  configPath: "./wrangler.smoke.jsonc",
  persist: true,
  remoteBindings: false,
});

try {
  const db = platform.env.DB;
  await db.prepare("DELETE FROM comments WHERE name LIKE 'Smoke %'").run();
  await db.prepare("DELETE FROM comment_rate_limits").run();
  const base = new Date("2026-07-23T04:00:00.000Z");

  for (let index = 0; index < 21; index += 1) {
    const request = new Request("https://blog.muelsyse.us/api/comments", {
      headers: {
        "cf-connecting-ip": `198.51.100.${index + 1}`,
        "user-agent": index % 2
          ? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
          : "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "cf-ipcountry": "CN",
        "cf-region-code": "GD",
      },
    });
    const result = await createComment(
      db,
      request,
      {
        contentId: "blog/20260128-01",
        name: `Smoke ${index + 1}`,
        content: index === 20 ? "<script>alert(1)</script>\nplain text" : `comment ${index + 1}`,
      },
      "local-smoke-secret",
      new Date(base.getTime() + index * 61_000),
    );
    assert(result.ok, `unexpected rate limit at item ${index + 1}`);
  }

  const page1 = await listPublicComments(db, "future-of-interface");
  const page2 = await listPublicComments(db, "future-of-interface", Number(page1.nextCursor));
  const latest = page1.items.find((item) => item.name === "Smoke 21");
  assert(latest, "latest comment missing");
  assert(page1.items.length === 20, "first page size is not 20");
  assert(page2.items.length > 0, "cursor page is empty");
  assert(page1.items[0]?.id === latest.id, "comments are not newest first");
  assert(latest.content === "<script>alert(1)</script>\nplain text", "plain text content changed");
  assert(latest.region === "广东", "region inference failed");

  await setCommentHidden(db, latest.id, true);
  assert(!(await listPublicComments(db, "future-of-interface")).items.some((item) => item.id === latest.id), "hidden comment remains public");
  assert((await listAdminComments(db, "future-of-interface", "hidden")).items.some((item) => item.id === latest.id), "hidden comment missing in admin");

  await setCommentHidden(db, latest.id, false);
  assert((await listPublicComments(db, "future-of-interface")).items.some((item) => item.id === latest.id), "restored comment remains hidden");

  const rateRequest = new Request("https://blog.muelsyse.us/api/comments", {
    headers: { "cf-connecting-ip": "203.0.113.200" },
  });
  const first = await createComment(db, rateRequest, { contentId: "blog/20260128-01", name: "Smoke Rate", content: "first" }, "local-smoke-secret", new Date("2026-07-23T06:00:00.000Z"));
  const second = await createComment(db, rateRequest, { contentId: "blog/20260128-01", name: "Smoke Rate", content: "second" }, "local-smoke-secret", new Date("2026-07-23T06:00:30.000Z"));
  assert(first.ok, "first rate-limit write failed");
  assert(!second.ok && second.retryAfter === 30, "60-second rate limit failed");

  console.log("Comment D1 smoke test passed.");
  await db.prepare("DELETE FROM comments WHERE name LIKE 'Smoke %'").run();
  await db.prepare("DELETE FROM comment_rate_limits").run();
} finally {
  await platform.dispose();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
