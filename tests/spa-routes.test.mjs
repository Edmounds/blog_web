import assert from "node:assert/strict";
import test from "node:test";

import {
  PRIMARY_ROUTES,
  isPrimaryRoute,
  primaryPathFor,
  resolvePrimaryIndex,
} from "../src/lib/spa-routes.ts";
import {
  LIFE_TITLES,
  LIFE_TYPES,
  computeSubmenuPlacement,
  isLifeType,
} from "../src/lib/life.ts";

test("primary routes resolve to their slide index", () => {
  assert.equal(resolvePrimaryIndex("/"), 0);
  assert.equal(resolvePrimaryIndex("/blog/"), 1);
  assert.equal(resolvePrimaryIndex("/project/"), 2);
  assert.equal(resolvePrimaryIndex("/note/"), 3);
  assert.equal(resolvePrimaryIndex("/links/"), 4);
  assert.equal(resolvePrimaryIndex("/about/"), 5);
});

test("locale prefixes and missing trailing slashes resolve to the same primary slide", () => {
  assert.equal(resolvePrimaryIndex("/en/"), 0);
  assert.equal(resolvePrimaryIndex("/en/blog/"), 1);
  assert.equal(resolvePrimaryIndex("/zh-TW/project"), 2);
  assert.equal(resolvePrimaryIndex("/zh-TW/note"), 3);
  assert.equal(resolvePrimaryIndex("/en/links"), 4);
  assert.equal(resolvePrimaryIndex("/zh-TW/about/"), 5);
});

test("paths outside the SPA report -1 index", () => {
  for (const path of [
    "/ja/",
    "/ja/blog/",
    "/life/",
    "/life/book/",
    "/life/music/",
    "/life/screen/",
    "/life/game/",
    "/blog/20260128-01/",
    "/admin/art/",
    "/art/book/",
  ]) {
    assert.equal(resolvePrimaryIndex(path), -1, path);
    assert.equal(isPrimaryRoute(path), false, path);
  }
});

test("every slide index maps back to its primary path", () => {
  for (const [index, path] of PRIMARY_ROUTES.entries()) {
    assert.equal(resolvePrimaryIndex(path), index);
    assert.equal(primaryPathFor(index), path);
    assert.equal(isPrimaryRoute(path), true);
  }
});

test("out-of-range indexes fall back to root", () => {
  assert.equal(primaryPathFor(99), "/");
  assert.equal(primaryPathFor(-1), "/");
});

test("only the four collections count as Life types", () => {
  assert.deepEqual(LIFE_TYPES, ["book", "music", "screen", "game"]);
  assert.ok(["book", "music", "screen", "game"].every(isLifeType));
  assert.ok(!isLifeType("movie"));
  assert.ok(!isLifeType(undefined));
  assert.ok(!isLifeType(""));
});

test("life titles use capitalized English names", () => {
  assert.deepEqual(LIFE_TITLES, {
    book: "BOOKS",
    music: "MUSIC",
    screen: "MOVIES",
    game: "GAMES",
  });
});

test("computeSubmenuPlacement switches to bottom on collision and right when room permits", () => {
  assert.equal(
    computeSubmenuPlacement({
      triggerRight: 700,
      submenuWidth: 260,
      searchLeft: 950,
      buffer: 12,
    }),
    "bottom",
  );

  assert.equal(
    computeSubmenuPlacement({
      triggerRight: 700,
      submenuWidth: 260,
      searchLeft: 972,
      buffer: 12,
    }),
    "bottom",
  );

  assert.equal(
    computeSubmenuPlacement({
      triggerRight: 700,
      submenuWidth: 260,
      searchLeft: 1100,
      buffer: 12,
    }),
    "right",
  );
});
