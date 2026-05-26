import assert from "node:assert/strict";
import { test } from "node:test";

import { getViewWindowStart, normalizeSlug } from "../functions/_shared/engagement.js";

test("normalizeSlug accepts a published post slug", () => {
  assert.equal(normalizeSlug("future-of-interface"), "future-of-interface");
});

test("normalizeSlug rejects unknown or malformed slugs", () => {
  assert.equal(normalizeSlug("missing-post"), undefined);
  assert.equal(normalizeSlug("../future-of-interface"), undefined);
  assert.equal(normalizeSlug("future of interface"), undefined);
  assert.equal(normalizeSlug(undefined), undefined);
});

test("getViewWindowStart groups timestamps into six hour windows", () => {
  assert.equal(getViewWindowStart(0), 0);
  assert.equal(getViewWindowStart(21_599_000), 0);
  assert.equal(getViewWindowStart(21_600_000), 21_600);
});
