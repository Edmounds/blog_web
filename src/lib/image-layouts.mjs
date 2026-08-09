import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import { parse as parseYaml } from "yaml";

const GRID_LAYOUTS = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i", "single"]);
const FIT_MODES = new Set(["cover", "contain", "natural"]);
const OVERLAY_MODES = new Set(["never", "hover", "always"]);
const ALIGN_MODES = new Set(["left", "center", "right", "full"]);
const LENGTH_PATTERN = /^\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh|dvh)$/;

export const IMAGE_LAYOUT_LANGUAGES = [
  "image-layout",
  ...["a", "b", "c", "d", "e", "f", "g", "h", "i", "single", "left", "center", "right", "carousel"]
    .map((name) => `image-layout-${name}`),
  ...[2, 3, 4, 5, 6].map((columns) => `image-layout-masonry-${columns}`),
];

const classes = (...values) => values.filter(Boolean);
const text = (value) => ({ type: "text", value: String(value) });
const element = (tagName, properties = {}, children = []) => ({
  type: "element",
  tagName,
  properties,
  children,
});

const safeLength = (value, fallback) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return `${value}px`;
  if (typeof value === "string" && LENGTH_PATTERN.test(value.trim())) return value.trim();
  return fallback;
};

const parseFrontmatter = (source) => {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)([\s\S]*)$/);
  if (!match) return { options: {}, body: source };
  try {
    const options = parseYaml(match[1]);
    return {
      options: options && typeof options === "object" && !Array.isArray(options) ? options : {},
      body: match[2],
    };
  } catch {
    return { options: {}, body: match[2] };
  }
};

export const parseObsidianImageAlt = (value) => {
  const alt = typeof value === "string" ? value.trim() : "";
  const match = alt.match(/^(.*)\|(\d{1,4})(?:x(\d{1,4}))?$/);
  if (!match) return { alt };
  const width = Number(match[2]);
  const height = match[3] ? Number(match[3]) : undefined;
  if (width < 1 || width > 4096 || (height !== undefined && (height < 1 || height > 4096))) {
    return { alt };
  }
  return { alt: match[1].trim(), width, height };
};

const collectImages = (body) => {
  const tree = unified().use(remarkParse).parse(body);
  const images = [];
  visit(tree, "image", (node) => {
    if (typeof node.url !== "string" || !node.url.trim()) return;
    images.push({ src: node.url.trim(), alt: node.alt ?? "", title: node.title ?? undefined });
  });
  return images;
};

const sizedImage = ({ src, alt, title }, description) => {
  const parsed = parseObsidianImageAlt(description ?? alt);
  const className = ["image-layout__image"];
  const styles = [];
  if (parsed.width) {
    className.push("obsidian-image-size");
    styles.push(`--obsidian-image-width: ${parsed.width}px`);
  }
  if (parsed.height) styles.push(`--obsidian-image-height: ${parsed.height}px`);
  return element("img", {
    src,
    alt: parsed.alt,
    ...(title ? { title } : {}),
    className,
    ...(styles.length ? { style: styles.join("; ") } : {}),
  });
};

const imageItem = (image, index, options, gridArea) => {
  const description = options.descriptions[index] ?? image.alt;
  const parsed = parseObsidianImageAlt(description);
  const overlay = options.overlay !== "never" && parsed.alt
    ? element("span", { className: ["image-layout__overlay"], ariaHidden: "true" }, [text(parsed.alt)])
    : null;
  return element("div", {
    className: ["image-layout__item"],
    ...(gridArea ? { style: `grid-area: ${gridArea}` } : {}),
  }, [sizedImage(image, description), ...(overlay ? [overlay] : [])]);
};

const layoutCaption = (caption) => caption
  ? element("figcaption", { className: ["image-layout__caption"] }, [text(caption)])
  : null;

const parseCustomGrid = (value) => {
  if (typeof value !== "string") return null;
  const rows = value.trim().split("\n").map((row) => row.trim().split(/\s+/)).filter((row) => row.length);
  if (!rows.length || rows.some((row) => row.length !== rows[0].length)) return null;
  const slots = new Map();
  const areas = rows.map((row) => row.map((token) => {
    if (token === ".") return ".";
    if (!slots.has(token)) slots.set(token, `image-${slots.size}`);
    return slots.get(token);
  }));
  return {
    columns: rows[0].length,
    slots: slots.size,
    style: `grid-template-columns: repeat(${rows[0].length}, minmax(0, 1fr)); grid-template-areas: ${areas.map((row) => `"${row.join(" ")}"`).join(" ")}`,
  };
};

const normalizeOptions = (raw, language) => {
  let layout = typeof raw.layout === "string" ? raw.layout : "";
  const legacy = language.slice("image-layout-".length);
  if (!layout && language !== "image-layout") layout = legacy;
  if (layout.startsWith("legacy-layout-")) layout = layout.slice("legacy-layout-".length);
  if (["left", "center", "right"].includes(layout)) {
    raw = { ...raw, align: layout };
    layout = "single";
  }
  return {
    layout,
    fit: FIT_MODES.has(raw.fit) ? raw.fit : "cover",
    overlay: OVERLAY_MODES.has(raw.overlay)
      ? raw.overlay
      : raw.permanentOverlay === true ? "always" : "hover",
    align: ALIGN_MODES.has(raw.align) ? raw.align : "full",
    width: safeLength(raw.width, undefined),
    caption: typeof raw.caption === "string" ? raw.caption.trim() : "",
    descriptions: Array.isArray(raw.descriptions)
      ? raw.descriptions.map((value) => typeof value === "string" ? value : "")
      : [],
    carouselShowThumbnails: raw.carouselShowThumbnails === true,
    carouselHeight: safeLength(raw.carouselHeight, "24rem"),
    grid: raw.grid,
  };
};

const carousel = (images, options) => {
  const slides = images.map((image, index) => element("div", {
    className: ["image-layout__slide"],
    dataCarouselSlide: String(index),
    dataActive: index === 0 ? "true" : "false",
    ariaHidden: index === 0 ? "false" : "true",
  }, [sizedImage(image, options.descriptions[index] ?? image.alt)]));
  const pagination = images.map((image, index) => {
    if (options.carouselShowThumbnails) {
      return element("button", {
        type: "button",
        className: ["image-layout__thumbnail"],
        dataCarouselGoTo: String(index),
        ariaLabel: `Show image ${index + 1}`,
        ariaCurrent: index === 0 ? "true" : "false",
      }, [sizedImage(image, options.descriptions[index] ?? image.alt)]);
    }
    return element("button", {
      type: "button",
      className: ["image-layout__pill"],
      dataCarouselGoTo: String(index),
      ariaLabel: `Show image ${index + 1}`,
      ariaCurrent: index === 0 ? "true" : "false",
    });
  });
  const firstDescription = parseObsidianImageAlt(options.descriptions[0] ?? images[0]?.alt ?? "").alt;
  const caption = layoutCaption(options.caption);
  return element("figure", {
    className: ["image-layout", "image-layout--carousel"],
    dataImageLayoutCarousel: "",
    dataCarouselThumbnails: String(options.carouselShowThumbnails),
    style: `--image-layout-carousel-height: ${options.carouselHeight}`,
  }, [
    element("div", {
      className: ["image-layout__stage"],
      tabIndex: 0,
      role: "group",
      ariaRoledescription: "carousel",
    }, [
      ...slides,
      element("button", { type: "button", className: ["image-layout__arrow", "image-layout__arrow--previous"], dataCarouselPrevious: "", ariaLabel: "Previous image" }),
      element("button", { type: "button", className: ["image-layout__arrow", "image-layout__arrow--next"], dataCarouselNext: "", ariaLabel: "Next image" }),
    ]),
    element("p", { className: ["image-layout__description"], dataCarouselDescription: "" }, firstDescription ? [text(firstDescription)] : []),
    element("div", { className: ["image-layout__pagination"] }, pagination),
    ...(caption ? [caption] : []),
  ]);
};

const masonry = (images, options, columns) => {
  const columnNodes = Array.from({ length: columns }, (_, column) => element(
    "div",
    { className: ["image-layout__masonry-column"] },
    images.flatMap((image, index) => index % columns === column
      ? [imageItem(image, index, options)]
      : []),
  ));
  const caption = layoutCaption(options.caption);
  return element("figure", {
    className: classes("image-layout", "image-layout--masonry", `image-layout--overlay-${options.overlay}`),
    style: `--image-layout-columns: ${columns}`,
  }, [
    element("div", { className: ["image-layout__masonry"] }, columnNodes),
    ...(caption ? [caption] : []),
  ]);
};

const grid = (images, options) => {
  const custom = options.layout === "custom" ? parseCustomGrid(options.grid) : null;
  const itemCount = custom?.slots ?? images.length;
  const items = images.slice(0, itemCount).map((image, index) => imageItem(
    image,
    index,
    options,
    `image-${index}`,
  ));
  const className = classes(
    "image-layout",
    "image-layout--grid",
    options.layout === "custom" ? "image-layout--custom" : `image-layout--${options.layout}`,
    `image-layout--fit-${options.fit}`,
    `image-layout--overlay-${options.overlay}`,
    options.align !== "full" && `image-layout--align-${options.align}`,
  );
  const styles = [];
  if (options.width) styles.push(`--image-layout-width: ${options.width}`);
  const caption = layoutCaption(options.caption);
  return element("figure", {
    className,
    ...(styles.length ? { style: styles.join("; ") } : {}),
  }, [
    element("div", {
      className: ["image-layout__grid"],
      ...(custom ? { style: custom.style } : {}),
    }, items),
    ...(caption ? [caption] : []),
  ]);
};

export const renderImageLayout = (language, source) => {
  if (!IMAGE_LAYOUT_LANGUAGES.includes(language)) return null;
  const { options: rawOptions, body } = parseFrontmatter(source);
  const options = normalizeOptions(rawOptions, language);
  const images = collectImages(body);
  if (!images.length || !options.layout) return null;
  if (options.layout === "carousel") return carousel(images, options);
  const masonryMatch = options.layout.match(/^masonry-([2-6])$/);
  if (masonryMatch) return masonry(images, options, Number(masonryMatch[1]));
  if (options.layout === "custom") return parseCustomGrid(options.grid) ? grid(images, options) : null;
  return GRID_LAYOUTS.has(options.layout) ? grid(images, options) : null;
};

const codeLanguage = (node) => {
  const code = node.children?.find((child) => child.type === "element" && child.tagName === "code");
  const languageClass = code?.properties?.className?.find?.((name) => String(name).startsWith("language-"));
  return typeof languageClass === "string" ? languageClass.slice("language-".length) : "";
};

export const createImageLayoutsPlugin = () => ({
  name: "render-obsidian-image-layouts",
  element: {
    filter: ["pre"],
    visit(node, ctx) {
      const rendered = renderImageLayout(codeLanguage(node), ctx.textContent(node));
      if (rendered) return rendered;
    },
  },
});

export const createObsidianImageSizePlugin = () => ({
  name: "render-obsidian-image-sizes",
  element: {
    filter: ["img"],
    visit(node) {
      const parsed = parseObsidianImageAlt(node.properties?.alt);
      if (!parsed.width) return;
      const className = Array.isArray(node.properties?.className) ? [...node.properties.className] : [];
      if (!className.includes("obsidian-image-size")) className.push("obsidian-image-size");
      const style = [node.properties?.style, `--obsidian-image-width: ${parsed.width}px`];
      if (parsed.height) style.push(`--obsidian-image-height: ${parsed.height}px`);
      return {
        ...node,
        properties: {
          ...node.properties,
          alt: parsed.alt,
          className,
          style: style.filter(Boolean).join("; "),
        },
      };
    },
  },
});
