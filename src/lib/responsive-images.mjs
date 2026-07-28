export const ARTICLE_IMAGE_SIZES = "(max-width: 48rem) calc(100vw - 2rem), 46rem";

const srcset = (items) => items.map((item) => `${item.url} ${item.width}w`).join(", ");

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
          src: asset.fallback ?? source,
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
