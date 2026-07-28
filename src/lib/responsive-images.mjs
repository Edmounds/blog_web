export const ARTICLE_IMAGE_SIZES = "(max-width: 48rem) calc(100vw - 2rem), 46rem";

const srcset = (items) => items.map((item) => `${item.url} ${item.width}w`).join(", ");

export const createResponsiveImagePlugin = ({ manifest, version = "static" }) => ({
  name: `responsive-images-${version}`,
  element: {
    filter: ["img"],
    visit(node) {
      const source = node.properties?.src;
      if (typeof source !== "string") return;
      const asset = manifest?.assets?.[source];
      const image = {
        ...node,
        properties: {
          ...node.properties,
          loading: "lazy",
          decoding: "async",
        },
      };
      if (!asset) return image;
      return {
        type: "element",
        tagName: "picture",
        properties: {},
        children: [
          {
            type: "element",
            tagName: "source",
            properties: { type: "image/avif", srcSet: srcset(asset.sources.avif), sizes: ARTICLE_IMAGE_SIZES },
            children: [],
          },
          {
            type: "element",
            tagName: "source",
            properties: { type: "image/webp", srcSet: srcset(asset.sources.webp), sizes: ARTICLE_IMAGE_SIZES },
            children: [],
          },
          {
            ...node,
            properties: {
              ...node.properties,
              src: asset.fallback,
              width: asset.width,
              height: asset.height,
              loading: "lazy",
              decoding: "async",
            },
          },
        ],
      };
    },
  },
});
