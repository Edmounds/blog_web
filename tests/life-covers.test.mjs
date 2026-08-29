import assert from "node:assert/strict";
import test from "node:test";

import {
  areLifeCoverSectionsEqual,
  LIFE_COVER_SECTIONS,
  resolveSectionCovers,
} from "../scripts/lib/life-covers.mjs";

test("resolveSectionCovers reuses existing thumbnails when ID and box dimensions match", async () => {
  const sources = [
    { id: "item-1", url: "https://example.com/cover1.jpg" },
    { id: "item-2", url: "https://example.com/cover2.jpg" },
  ];
  const existingCovers = [
    {
      id: "item-1",
      width: 96,
      height: 144,
      thumbnail: "data:image/webp;base64,CACHED_1",
    },
    {
      id: "item-99",
      width: 96,
      height: 144,
      thumbnail: "data:image/webp;base64,OLD",
    },
  ];
  const box = { width: 96, height: 144 };

  const renderedIds = [];
  const renderThumbnail = async (source) => {
    renderedIds.push(source.id);
    return `data:image/webp;base64,FRESH_${source.id}`;
  };

  const { covers, stats } = await resolveSectionCovers({
    sources,
    existingCovers,
    box,
    renderThumbnail,
    force: false,
  });

  assert.equal(stats.total, 2);
  assert.equal(stats.cached, 1);
  assert.equal(stats.fresh, 1);
  assert.deepEqual(renderedIds, ["item-2"]);
  assert.deepEqual(covers, [
    {
      id: "item-1",
      width: 96,
      height: 144,
      thumbnail: "data:image/webp;base64,CACHED_1",
    },
    {
      id: "item-2",
      width: 96,
      height: 144,
      thumbnail: "data:image/webp;base64,FRESH_item-2",
    },
  ]);
});

test("resolveSectionCovers ignores cache and re-renders when force is true", async () => {
  const sources = [{ id: "item-1", url: "https://example.com/cover1.jpg" }];
  const existingCovers = [
    {
      id: "item-1",
      width: 96,
      height: 144,
      thumbnail: "data:image/webp;base64,CACHED_1",
    },
  ];
  const box = { width: 96, height: 144 };

  const renderedIds = [];
  const renderThumbnail = async (source) => {
    renderedIds.push(source.id);
    return `data:image/webp;base64,FRESH_${source.id}`;
  };

  const { covers, stats } = await resolveSectionCovers({
    sources,
    existingCovers,
    box,
    renderThumbnail,
    force: true,
  });

  assert.equal(stats.cached, 0);
  assert.equal(stats.fresh, 1);
  assert.deepEqual(renderedIds, ["item-1"]);
  assert.deepEqual(covers, [
    {
      id: "item-1",
      width: 96,
      height: 144,
      thumbnail: "data:image/webp;base64,FRESH_item-1",
    },
  ]);
});

test("resolveSectionCovers re-renders if existing box dimensions differ", async () => {
  const sources = [{ id: "item-1", url: "https://example.com/cover1.jpg" }];
  const existingCovers = [
    {
      id: "item-1",
      width: 50,
      height: 50,
      thumbnail: "data:image/webp;base64,OLD_SIZE",
    },
  ];
  const box = { width: 96, height: 144 };

  const { covers, stats } = await resolveSectionCovers({
    sources,
    existingCovers,
    box,
    renderThumbnail: async () => "data:image/webp;base64,NEW_SIZE",
    force: false,
  });

  assert.equal(stats.cached, 0);
  assert.equal(stats.fresh, 1);
  assert.equal(covers[0].thumbnail, "data:image/webp;base64,NEW_SIZE");
  assert.equal(covers[0].width, 96);
  assert.equal(covers[0].height, 144);
});

test("areLifeCoverSectionsEqual accurately detects equality and variations", () => {
  const buildMockSections = () =>
    Object.fromEntries(
      LIFE_COVER_SECTIONS.map((section) => [
        section,
        [
          {
            id: `${section}-1`,
            width: 96,
            height: 144,
            thumbnail: `thumb-${section}-1`,
          },
          {
            id: `${section}-2`,
            width: 96,
            height: 144,
            thumbnail: `thumb-${section}-2`,
          },
        ],
      ]),
    );

  const base = buildMockSections();
  const identical = buildMockSections();
  assert.equal(areLifeCoverSectionsEqual(base, identical), true);

  const changedId = buildMockSections();
  changedId.book[0].id = "different-id";
  assert.equal(areLifeCoverSectionsEqual(base, changedId), false);

  const changedOrder = buildMockSections();
  changedOrder.game = [changedOrder.game[1], changedOrder.game[0]];
  assert.equal(areLifeCoverSectionsEqual(base, changedOrder), false);

  const changedThumb = buildMockSections();
  changedThumb.music[0].thumbnail = "new-thumbnail";
  assert.equal(areLifeCoverSectionsEqual(base, changedThumb), false);

  const missingItem = buildMockSections();
  missingItem.screen = [missingItem.screen[0]];
  assert.equal(areLifeCoverSectionsEqual(base, missingItem), false);

  assert.equal(areLifeCoverSectionsEqual(null, base), false);
  assert.equal(areLifeCoverSectionsEqual(base, null), false);
});
