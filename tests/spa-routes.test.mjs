import assert from "node:assert/strict";
import test from "node:test";

import {
  LIFE_ROUTES,
  LIFE_TOP_INDEX,
  TOP_ROUTES,
  isLifeType,
  resolveSpaLocation,
  spaPathFor,
} from "../src/lib/spa-routes.ts";

test("top-level routes resolve to their slide index", () => {
  assert.deepEqual(resolveSpaLocation("/"), { top: 0, life: 0 });
  assert.deepEqual(resolveSpaLocation("/blog/"), { top: 1, life: 0 });
  assert.deepEqual(resolveSpaLocation("/about/"), { top: 4, life: 0 });
  assert.deepEqual(resolveSpaLocation("/life/"), { top: LIFE_TOP_INDEX, life: 0 });
});

test("Life sub-sections resolve to the Life slide plus a nested index", () => {
  assert.deepEqual(resolveSpaLocation("/life/book/"), { top: LIFE_TOP_INDEX, life: 1 });
  assert.deepEqual(resolveSpaLocation("/life/music/"), { top: LIFE_TOP_INDEX, life: 2 });
  assert.deepEqual(resolveSpaLocation("/life/screen/"), { top: LIFE_TOP_INDEX, life: 3 });
  assert.deepEqual(resolveSpaLocation("/life/game/"), { top: LIFE_TOP_INDEX, life: 4 });
});

test("locale prefixes and missing trailing slashes resolve to the same slide", () => {
  assert.deepEqual(resolveSpaLocation("/en/life/music/"), { top: LIFE_TOP_INDEX, life: 2 });
  assert.deepEqual(resolveSpaLocation("/ja/blog/"), { top: 1, life: 0 });
  assert.deepEqual(resolveSpaLocation("/zh-TW/life"), { top: LIFE_TOP_INDEX, life: 0 });
  assert.deepEqual(resolveSpaLocation("/en/"), { top: 0, life: 0 });
});

test("paths outside the SPA report no slide", () => {
  for (const path of ["/blog/20260128-01/", "/admin/art/", "/life/movie/", "/art/book/"]) {
    assert.equal(resolveSpaLocation(path).top, -1, path);
  }
});

test("every slide index maps back to the path that resolves to it", () => {
  for (const [top] of TOP_ROUTES.entries()) {
    if (top === LIFE_TOP_INDEX) continue;
    assert.deepEqual(resolveSpaLocation(spaPathFor(top)), { top, life: 0 });
  }
  for (const [life] of LIFE_ROUTES.entries()) {
    assert.deepEqual(resolveSpaLocation(spaPathFor(LIFE_TOP_INDEX, life)), {
      top: LIFE_TOP_INDEX,
      life,
    });
  }
});

test("out-of-range indexes fall back to a real path", () => {
  assert.equal(spaPathFor(99), "/");
  assert.equal(spaPathFor(LIFE_TOP_INDEX, 99), "/life/");
});

test("only the four collections count as Life types", () => {
  assert.ok(["book", "music", "screen", "game"].every(isLifeType));
  assert.ok(!isLifeType("movie"));
  assert.ok(!isLifeType(undefined));
});
