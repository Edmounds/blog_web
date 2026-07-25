import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatBeijingTime,
  getCommentCursor,
  inferDevice,
  inferRegion,
  inferRegionFromHeaders,
  normalizeCommentContentId,
  validateCommentInput,
} from "../functions/_shared/comments.js";

test("About uses one shared comment content ID without enabling other About IDs", () => {
  assert.equal(normalizeCommentContentId("about/profile"), "about/profile");
  assert.equal(normalizeCommentContentId("/about/profile/"), "about/profile");
  assert.equal(normalizeCommentContentId("about/other"), undefined);
});

test("validateCommentInput trims names and preserves comment line breaks", () => {
  assert.deepEqual(
    validateCommentInput({
      contentId: "blog/first-note",
      name: "  访客  ",
      content: "第一行\n第二行  ",
      website: "",
    }),
    {
      ok: true,
      value: {
        contentId: "blog/first-note",
        name: "访客",
        content: "第一行\n第二行  ",
      },
    },
  );
});

test("validateCommentInput enforces name and content boundaries", () => {
  assert.equal(validateCommentInput({ contentId: "blog/first-note", name: " ", content: "内容" }).error.code, "INVALID_NAME");
  assert.equal(validateCommentInput({ contentId: "blog/first-note", name: "名".repeat(21), content: "内容" }).error.code, "INVALID_NAME");
  assert.equal(validateCommentInput({ contentId: "blog/first-note", name: "访客", content: " \n " }).error.code, "INVALID_CONTENT");
  assert.equal(validateCommentInput({ contentId: "blog/first-note", name: "访客", content: "文".repeat(501) }).error.code, "INVALID_CONTENT");
  assert.equal(validateCommentInput({ contentId: "blog/missing-post", name: "访客", content: "内容" }).error.code, "INVALID_CONTENT_ID");
  assert.equal(validateCommentInput({ contentId: "blog/first-note", name: "访客", content: "内容", website: "bot" }).error.code, "INVALID_COMMENT");
});

test("validateCommentInput accepts the shared About comment ID", () => {
  assert.deepEqual(
    validateCommentInput({ contentId: "about/profile", name: "访客", content: "你好", website: "" }),
    { ok: true, value: { contentId: "about/profile", name: "访客", content: "你好" } },
  );
});

test("inferDevice exposes only coarse operating-system labels", () => {
  assert.equal(inferDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "Windows");
  assert.equal(inferDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "iOS");
  assert.equal(inferDevice("Mozilla/5.0 (Linux; Android 15; Pixel)"), "Android");
  assert.equal(inferDevice("Mozilla/5.0 (X11; CrOS x86_64 16093.0.0)"), "ChromeOS");
  assert.equal(inferDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), "macOS");
  assert.equal(inferDevice("Mozilla/5.0 (X11; Linux x86_64)"), "Linux");
  assert.equal(inferDevice("custom-client/1.0"), "其他设备");
});

test("inferRegion maps mainland subdivisions and foreign country codes", () => {
  assert.equal(inferRegion({ country: "CN", regionCode: "GD" }), "广东");
  assert.equal(inferRegion({ country: "CN", region: "Zhejiang" }), "浙江");
  assert.equal(inferRegion({ country: "JP" }), "日本");
  assert.equal(inferRegion({ country: "TW" }), "中国台湾");
  assert.equal(inferRegion(undefined), "未知地区");
  assert.equal(inferRegion({ country: "XX" }), "未知地区");
  assert.equal(inferRegionFromHeaders(new Headers({ "cf-ipcountry": "CN", "cf-region-code": "GD" })), "广东");
});

test("formatBeijingTime formats UTC timestamps in Asia/Shanghai", () => {
  assert.equal(formatBeijingTime("2026-07-23T13:30:00.000Z"), "2026年7月23日 21:30");
});

test("getCommentCursor accepts positive integer cursors only", () => {
  assert.equal(getCommentCursor("42"), 42);
  assert.equal(getCommentCursor(null), undefined);
  assert.equal(getCommentCursor("0"), undefined);
  assert.equal(getCommentCursor("4.2"), undefined);
  assert.equal(getCommentCursor("not-an-id"), undefined);
});
