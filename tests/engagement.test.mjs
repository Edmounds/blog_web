import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getViewWindowStart,
  normalizeSlug,
  requireSameOriginJson,
} from "../functions/_shared/engagement.js";

test("normalizeSlug accepts a published post slug", () => {
  assert.equal(normalizeSlug("designing-for-clarity-in-chaos"), "designing-for-clarity-in-chaos");
});

test("normalizeSlug rejects unknown or malformed slugs", () => {
  assert.equal(normalizeSlug("missing-post"), undefined);
  assert.equal(normalizeSlug("../designing-for-clarity-in-chaos"), undefined);
  assert.equal(normalizeSlug("future of interface"), undefined);
  assert.equal(normalizeSlug(undefined), undefined);
});

test("getViewWindowStart groups timestamps into six hour windows", () => {
  assert.equal(getViewWindowStart(0), 0);
  assert.equal(getViewWindowStart(21_599_000), 0);
  assert.equal(getViewWindowStart(21_600_000), 21_600);
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
