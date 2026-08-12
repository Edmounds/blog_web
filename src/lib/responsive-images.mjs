export const ARTICLE_IMAGE_SIZES = "(max-width: 48rem) calc(100vw - 2rem), 46rem";

// Content images live in R2 behind img.muelsyse.us, which bypasses the
// preferred-proxy route and needs an extra DNS+TLS handshake. Serving them
// same-origin through /media/img/* keeps them on the optimized path.
const REMOTE_IMAGE_PREFIX = /^https:\/\/img\.muelsyse\.us\/((?:blog|bed)\/)/;

export const toSameOriginImageUrl = (url) =>
  typeof url === "string"
    ? url.replace(REMOTE_IMAGE_PREFIX, "/media/img/$1")
    : url;

const srcset = (items) => items.map((item) => `${toSameOriginImageUrl(item.url)} ${item.width}w`).join(", ");

export const createResponsiveImagePlugin = ({ manifest, version = "static" }) => {
  const counterKey = `responsiveImageIndex:${version}`;
  return {
    name: `responsive-images-${version}`,
    element: {
      filter: ["img"],
      visit(node, context = { data: {} }) {
        const imageIndex = Number(context.data[counterKey] ?? 0);
        context.data[counterKey] = imageIndex + 1;
        const priority = imageIndex === 0
          ? { loading: "eager", fetchPriority: "high" }
          : { loading: "lazy", fetchPriority: "auto" };
      const source = node.properties?.src;
      if (typeof source !== "string") return;
      const asset = manifest?.assets?.[source];
      const image = {
        ...node,
        properties: {
          ...node.properties,
          ...priority,
          decoding: "async",
        },
      };
      if (!asset) return image;
      const managedImage = {
        ...image,
        properties: {
          ...image.properties,
          src: toSameOriginImageUrl(asset.fallback ?? source),
          width: asset.width,
          height: asset.height,
        },
      };
      if (asset.kind === "passthrough") return managedImage;
      return {
        type: "element",
        tagName: "picture",
        properties: { className: ["article-picture"] },
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
            ...managedImage,
          },
        ],
      };
      },
    },
  };
};
