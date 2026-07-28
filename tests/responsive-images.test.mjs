import assert from "node:assert/strict";
import test from "node:test";

import { createResponsiveImagePlugin } from "../src/lib/responsive-images.mjs";

const visitImages = (manifest, sources) => {
  const plugin = createResponsiveImagePlugin({ manifest, version: "test" });
  const context = { data: {} };
  return sources.map((src) => plugin.element.visit({
    type: "element",
    tagName: "img",
    properties: { src, alt: "Example" },
    children: [],
  }, context));
};

test("responsive raster images emit AVIF/WebP sources and stable priority attributes", () => {
  const source = "https://img.muelsyse.us/blog/source.webp";
  const [first, second] = visitImages({
    version: 3,
    assets: {
      [source]: {
        kind: "responsive",
        width: 1600,
        height: 900,
        fallback: source,
        sources: {
          avif: [{ width: 640, url: "https://img.muelsyse.us/blog/source-w640.avif.webp" }],
          webp: [{ width: 640, url: "https://img.muelsyse.us/blog/source-w640.webp" }],
        },
      },
    },
  }, [source, source]);

  assert.equal(first.tagName, "picture");
  assert.equal(first.children[0].properties.type, "image/avif");
  assert.equal(first.children[1].properties.type, "image/webp");
  assert.deepEqual(first.children[2].properties, {
    src: source,
    alt: "Example",
    width: 1600,
    height: 900,
    loading: "eager",
    fetchPriority: "high",
    decoding: "async",
  });
  assert.equal(second.children[2].properties.loading, "lazy");
  assert.equal(second.children[2].properties.fetchPriority, "auto");
});

test("passthrough images retain their source while receiving intrinsic dimensions", () => {
  const source = "https://img.muelsyse.us/blog/diagram.svg";
  const [image] = visitImages({
    version: 3,
    assets: {
      [source]: { kind: "passthrough", width: 800, height: 400, fallback: source },
    },
  }, [source]);

  assert.equal(image.tagName, "img");
  assert.equal(image.properties.src, source);
  assert.equal(image.properties.width, 800);
  assert.equal(image.properties.height, 400);
  assert.equal(image.properties.loading, "eager");
  assert.equal(image.properties.fetchPriority, "high");
});
