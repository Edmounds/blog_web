import path from "node:path";

import { lexer } from "css-tree/dist/csstree.esm";
import { parse as parseYaml } from "yaml";

const GRID_LAYOUTS = {
  a: 2,
  b: 2,
  c: 2,
  d: 3,
  e: 3,
  f: 4,
  g: 4,
  h: 3,
  i: 4,
  single: 1,
};
const FIT_MODES = new Set(["cover", "contain", "natural"]);
const OVERLAY_MODES = new Set(["never", "hover", "always"]);
const ALIGN_MODES = new Set(["left", "center", "right", "full"]);
const IMAGE_EXTENSIONS = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const CONTENT_PATH_MARKER = "/src/content/";
const LOCALIZED_CONTENT_PATH_MARKER = "/src/i18n/content/";

export const IMAGE_LAYOUTS_COMPATIBILITY_VERSION = "0.18.0";

export const BUILT_IN_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="#88888822"/><circle cx="240" cy="170" r="36" fill="#88888855"/><path d="M120 360l110-140 80 95 60-60 130 105z" fill="#88888855"/></svg>',
)}`;

export const IMAGE_LAYOUT_LANGUAGES = [
  "image-layout",
  ...["a", "b", "c", "d", "e", "f", "g", "h", "i", "single", "left", "center", "right", "custom", "carousel"]
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

const validCssProperty = (property, value) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = value.trim();
  if (/url\s*\(|[;{}]/i.test(normalized)) return undefined;
  try {
    return lexer.matchProperty(property, normalized).matched ? normalized : undefined;
  } catch {
    return undefined;
  }
};

export const safeCssLength = (value, fallback) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return `${value}px`;
  return validCssProperty("width", value) ?? fallback;
};

export const safeCssColor = (value, fallback) => validCssProperty("background-color", value) ?? fallback;

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
  const parts = typeof value === "string" ? value.split("|") : [];
  const descriptions = [];
  let width;
  let height;
  for (const part of parts) {
    const normalized = part.trim();
    const size = normalized.match(/^(\d+)(?:x(\d+))?$/);
    if (size) {
      width = Number(size[1]);
      height = size[2] ? Number(size[2]) : undefined;
    } else if (normalized) {
      descriptions.push(normalized);
    }
  }
  return {
    alt: descriptions.join("|"),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };
};

const splitDestinationAndTitle = (value) => {
  const normalized = value.trim();
  if (normalized.startsWith("<")) {
    const close = normalized.indexOf(">");
    return close >= 0 ? normalized.slice(1, close) : "";
  }
  const title = normalized.match(/\s+(?:"[^"\n]*"|'[^'\n]*'|\([^\n)]*\))\s*$/);
  return (title ? normalized.slice(0, title.index) : normalized).trim();
};

export const parseLayoutImageLine = (line) => {
  const value = line.trim();
  const wiki = value.match(/^!\[\[([^\]]+)\]\]/);
  if (wiki) {
    const [link, ...parts] = wiki[1].split("|");
    if (!link.trim()) return null;
    return { type: "wiki", link: link.trim(), ...parseObsidianImageAlt(parts.join("|")) };
  }
  const markdown = value.match(/^!\[([^\]]*)\]\(([\s\S]+)\)$/);
  if (!markdown) return null;
  const link = splitDestinationAndTitle(markdown[2]);
  if (!link) return null;
  return {
    type: /^https?:/i.test(link) || link.startsWith("/") ? "external" : "wiki",
    link,
    ...parseObsidianImageAlt(markdown[1]),
  };
};

const normalizeVaultPath = (value) => {
  if (typeof value !== "string") return "";
  const decoded = (() => {
    try { return decodeURIComponent(value); } catch { return value; }
  })();
  const normalized = path.posix.normalize(decoded.replaceAll("\\", "/").replace(/^\.\//, ""));
  return normalized === "." || normalized.startsWith("../") || normalized === ".."
    ? ""
    : normalized.replace(/^\//, "");
};

const sourceVaultPath = (fileURL) => {
  const pathname = fileURL?.pathname;
  if (!pathname) return "";
  const markerIndex = pathname.indexOf(CONTENT_PATH_MARKER);
  if (markerIndex >= 0) return normalizeVaultPath(pathname.slice(markerIndex + CONTENT_PATH_MARKER.length));
  const localizedMarkerIndex = pathname.indexOf(LOCALIZED_CONTENT_PATH_MARKER);
  if (localizedMarkerIndex < 0) return "";
  const localizedPath = pathname.slice(localizedMarkerIndex + LOCALIZED_CONTENT_PATH_MARKER.length);
  return normalizeVaultPath(localizedPath.split("/").slice(1).join("/"));
};

const assetUrl = (asset) => asset?.fallback ?? asset?.fallbackUrl ?? asset?.url;

export const createVaultResolver = (vaultAssets = {}) => {
  const entries = Object.entries(vaultAssets)
    .map(([key, value]) => [normalizeVaultPath(key), value])
    .filter(([key, value]) => key && assetUrl(value));
  const byPath = new Map(entries);

  const resolvePath = (link, fileURL) => {
    if (/^(?:https?:|data:|\/)/i.test(link)) return { link, resolved: true, placeholder: false };
    if (/^file:\/\//i.test(link)) return { link, resolved: false, placeholder: false };
    const normalized = normalizeVaultPath(link);
    const sourcePath = sourceVaultPath(fileURL);
    const relative = sourcePath ? normalizeVaultPath(path.posix.join(path.posix.dirname(sourcePath), normalized)) : "";
    const extension = path.posix.extname(normalized);
    const candidates = [normalized, relative];
    if (!extension) {
      for (const ext of IMAGE_EXTENSIONS) candidates.push(`${normalized}.${ext}`, relative ? `${relative}.${ext}` : "");
    }
    for (const candidate of candidates) {
      const asset = byPath.get(candidate);
      if (asset) return { link: assetUrl(asset), asset, vaultPath: candidate, resolved: true, placeholder: false };
    }
    const basename = path.posix.basename(normalized).toLocaleLowerCase();
    const stem = extension ? basename : `${basename}.`;
    const match = entries.find(([candidate]) => {
      const name = path.posix.basename(candidate).toLocaleLowerCase();
      return extension ? name === basename : name.startsWith(stem);
    });
    return match
      ? { link: assetUrl(match[1]), asset: match[1], vaultPath: match[0], resolved: true, placeholder: false }
      : { link, resolved: false, placeholder: false };
  };

  const fromFolder = (folder, options = {}) => {
    const normalized = normalizeVaultPath(folder).replace(/\/$/, "");
    if (!normalized) return [];
    const prefix = `${normalized}/`;
    const images = entries
      .filter(([candidate]) => candidate.startsWith(prefix)
        && !candidate.slice(prefix.length).includes("/")
        && IMAGE_EXTENSIONS.has(path.posix.extname(candidate).slice(1).toLowerCase()))
      .map(([candidate, asset]) => ({
        type: "resolved",
        link: assetUrl(asset),
        vaultPath: candidate,
        mtime: Number(asset.mtime) || 0,
      }));
    images.sort(options.sortBy === "mtime"
      ? (a, b) => a.mtime - b.mtime
      : (a, b) => path.posix.basename(a.vaultPath).localeCompare(path.posix.basename(b.vaultPath)));
    if (options.reverse === true) images.reverse();
    return typeof options.limit === "number" && options.limit > 0 ? images.slice(0, options.limit) : images;
  };

  return { resolvePath, fromFolder };
};

const collectImages = (body, options, fileURL, resolver) => {
  const explicit = body.split("\n")
    .filter((line) => line.trimStart().startsWith("!"))
    .map(parseLayoutImageLine)
    .filter(Boolean)
    .map((image) => ({ ...image, ...resolver.resolvePath(image.link, fileURL) }));
  const folder = options.fromFolder
    ? resolver.fromFolder(options.fromFolder, options)
    : [];
  return [...explicit, ...folder];
};

const sizedImage = (image, description, placeholder = false) => {
  const parsedDescription = parseObsidianImageAlt(description ?? image.alt ?? "");
  const width = image.width ?? parsedDescription.width;
  const height = image.height ?? parsedDescription.height;
  const styles = [];
  if (width) styles.push(`--obsidian-image-width: ${width}px`);
  if (height) styles.push(`--obsidian-image-height: ${height}px`);
  return element("img", {
    src: image.link,
    alt: placeholder ? "" : parsedDescription.alt,
    className: classes("image-layout__image", width && "obsidian-image-size", placeholder && "image-layout__placeholder"),
    ...(placeholder ? { dataImageLayoutPlaceholder: "", ariaHidden: "true" } : {}),
    ...(styles.length ? { style: styles.join("; ") } : {}),
  });
};

const imageItem = (image, index, options, gridArea) => {
  const description = options.descriptions[index] ?? image.alt ?? "";
  const parsed = parseObsidianImageAlt(description);
  const placeholder = image.placeholder === true;
  const overlay = !placeholder && options.overlay !== "never" && parsed.alt
    ? element("span", { className: ["image-layout__overlay"], ariaHidden: "true" }, [text(parsed.alt)])
    : null;
  const styles = [];
  if (gridArea) styles.push(`grid-area: ${gridArea}`);
  if (image.width) styles.push(`--image-layout-item-width: ${image.width}px`);
  if (image.height) styles.push(`--image-layout-item-height: ${image.height}px`);
  return element("div", {
    className: classes("image-layout__item", placeholder && "image-layout__item--placeholder"),
    ...(styles.length ? { style: styles.join("; ") } : {}),
  }, [sizedImage(image, description, placeholder), ...(overlay ? [overlay] : [])]);
};

const layoutCaption = (caption) => caption
  ? element("figcaption", { className: ["image-layout__caption"] }, [text(caption)])
  : null;

export const parseCustomGrid = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return { error: "A custom layout needs a `grid` option with rows of letters, e.g.\ngrid: |\n  A A B\n  A A C" };
  }
  const rows = value.split("\n").map((row) => row.trim()).filter(Boolean).map((row) => row.split(/\s+/));
  const columns = rows[0].length;
  if (rows.some((row) => row.length !== columns)) return { error: "Every row in `grid` must have the same number of cells." };
  const tokens = [];
  for (const row of rows) for (const token of row) if (token !== "." && !tokens.includes(token)) tokens.push(token);
  if (!tokens.length) return { error: "The `grid` needs at least one image cell." };
  if (tokens.length > 20) return { error: "`grid` supports up to 20 images." };
  for (const token of tokens) {
    let minRow = Infinity;
    let maxRow = -1;
    let minColumn = Infinity;
    let maxColumn = -1;
    let count = 0;
    rows.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
      if (cell !== token) return;
      minRow = Math.min(minRow, rowIndex);
      maxRow = Math.max(maxRow, rowIndex);
      minColumn = Math.min(minColumn, columnIndex);
      maxColumn = Math.max(maxColumn, columnIndex);
      count += 1;
    }));
    if (count !== (maxRow - minRow + 1) * (maxColumn - minColumn + 1)) {
      return { error: `The cells for "${token}" must form a solid rectangle.` };
    }
  }
  const areas = rows.map((row) => row.map((token) => token === "." ? "." : `image-${tokens.indexOf(token)}`));
  return {
    columns,
    rows: rows.length,
    slots: tokens.length,
    style: `grid-template-columns: repeat(${columns}, minmax(0, 1fr)); grid-template-areas: ${areas.map((row) => `"${row.join(" ")}"`).join(" ")}`,
  };
};

const normalizeOptions = (raw, language, settings) => {
  let layout = typeof raw.layout === "string" ? raw.layout : "";
  const legacy = language.slice("image-layout-".length);
  if (!layout && language !== "image-layout") layout = legacy;
  if (layout.startsWith("legacy-layout-")) layout = layout.slice("legacy-layout-".length);
  if (["left", "center", "right"].includes(layout)) {
    raw = { ...raw, align: layout };
    layout = "single";
  }
  const settingOverlay = OVERLAY_MODES.has(settings.overlayMode)
    ? settings.overlayMode
    : settings.shouldOverlayPermanently === true ? "always" : "hover";
  const overlay = OVERLAY_MODES.has(raw.overlay)
    ? raw.overlay
    : typeof raw.permanentOverlay === "boolean"
      ? raw.permanentOverlay ? "always" : "hover"
      : settingOverlay;
  return {
    ...raw,
    layout,
    fit: FIT_MODES.has(raw.fit) ? raw.fit : "cover",
    overlay,
    align: ALIGN_MODES.has(raw.align) ? raw.align : "full",
    width: safeCssLength(raw.width, undefined),
    caption: typeof raw.caption === "string" ? raw.caption.trim() : "",
    descriptions: Array.isArray(raw.descriptions) ? raw.descriptions.map((value) => value == null ? "" : String(value)) : [],
    carouselShowThumbnails: raw.carouselShowThumbnails === true,
    carouselBackground: safeCssColor(raw.carouselBackground, undefined),
    carouselHeight: safeCssLength(raw.carouselHeight, "24rem"),
  };
};

const placeholderImage = (settings, resolver, fileURL) => {
  const configured = typeof settings.placeholderImage === "string" ? settings.placeholderImage.trim() : "";
  if (!configured) return BUILT_IN_PLACEHOLDER;
  if (/^(?:https?:|data:)/i.test(configured)) return configured;
  const resolved = resolver.resolvePath(configured, fileURL);
  return resolved.resolved ? resolved.link : BUILT_IN_PLACEHOLDER;
};

const paddedImages = (images, count, placeholder) => images.length >= count
  ? images.slice(0, count)
  : [...images, ...Array.from({ length: count - images.length }, () => ({ link: placeholder, placeholder: true }))];

const errorLayout = (message) => element("div", {
  className: ["image-layout-error"],
  role: "status",
  dataImageLayoutError: "",
}, [text(`Image Layouts: ${message}`)]);

const carousel = (images, options, placeholder) => {
  const carouselImages = images.length ? images : [{ link: placeholder, placeholder: true }];
  const slides = carouselImages.map((image, index) => element("div", {
    className: ["image-layout__slide"],
    dataCarouselSlide: String(index),
    dataActive: index === 0 ? "true" : "false",
    ariaHidden: index === 0 ? "false" : "true",
  }, [sizedImage(image, options.descriptions[index] ?? image.alt, image.placeholder)]));
  const pagination = carouselImages.map((image, index) => options.carouselShowThumbnails
    ? element("button", {
      type: "button",
      className: ["image-layout__thumbnail"],
      dataCarouselGoTo: String(index),
      ariaLabel: `Show image ${index + 1}`,
      ariaCurrent: index === 0 ? "true" : "false",
    }, [sizedImage(image, options.descriptions[index] ?? image.alt, image.placeholder)])
    : element("button", {
      type: "button",
      className: ["image-layout__pill"],
      dataCarouselGoTo: String(index),
      ariaLabel: `Show image ${index + 1}`,
      ariaCurrent: index === 0 ? "true" : "false",
    }));
  const firstDescription = parseObsidianImageAlt(options.descriptions[0] ?? carouselImages[0]?.alt ?? "").alt;
  const caption = layoutCaption(options.caption);
  const styles = [`--image-layout-carousel-height: ${options.carouselHeight}`];
  if (options.carouselBackground) styles.push(`--image-layout-carousel-background: ${options.carouselBackground}`);
  return element("figure", {
    className: ["image-layout", "image-layout--carousel"],
    dataImageLayoutCarousel: "",
    dataCarouselThumbnails: String(options.carouselShowThumbnails),
    style: styles.join("; "),
  }, [
    element("div", { className: ["image-layout__stage"], tabIndex: 0, role: "group", ariaRoledescription: "carousel" }, [
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
    images.flatMap((image, index) => index % columns === column ? [imageItem(image, index, options)] : []),
  ));
  const caption = layoutCaption(options.caption);
  return element("figure", {
    className: classes("image-layout", "image-layout--masonry", `image-layout--overlay-${options.overlay}`),
    style: `--image-layout-columns: ${columns}`,
  }, [element("div", { className: ["image-layout__masonry"] }, columnNodes), ...(caption ? [caption] : [])]);
};

const grid = (images, options, custom, placeholder) => {
  const itemCount = custom?.slots ?? GRID_LAYOUTS[options.layout];
  const items = paddedImages(images, itemCount, placeholder).map((image, index) => imageItem(image, index, options, `image-${index}`));
  const className = classes(
    "image-layout",
    "image-layout--grid",
    options.layout === "custom" ? "image-layout--custom" : `image-layout--${options.layout}`,
    `image-layout--fit-${options.fit}`,
    `image-layout--overlay-${options.overlay}`,
    options.align !== "full" && `image-layout--align-${options.align}`,
  );
  const caption = layoutCaption(options.caption);
  return element("figure", {
    className,
    ...(options.width ? { style: `--image-layout-width: ${options.width}` } : {}),
  }, [
    element("div", { className: ["image-layout__grid"], ...(custom ? { style: custom.style } : {}) }, items),
    ...(caption ? [caption] : []),
  ]);
};

export const renderImageLayout = (language, source, configuration = {}, context = {}) => {
  if (!IMAGE_LAYOUT_LANGUAGES.includes(language)) return null;
  const resolver = createVaultResolver(configuration.vaultAssets);
  const settings = configuration.settings ?? {};
  const { options: rawOptions, body } = parseFrontmatter(source);
  const options = normalizeOptions(rawOptions, language, settings);
  const images = collectImages(body, options, context.fileURL, resolver);
  const placeholder = placeholderImage(settings, resolver, context.fileURL);

  if (!options.layout) return errorLayout("Choose a layout in Obsidian before publishing this block.");
  if (options.layout === "carousel") return carousel(images, options, placeholder);
  const masonryMatch = options.layout.match(/^masonry-([2-6])$/);
  if (masonryMatch) return masonry(images, options, Number(masonryMatch[1]));
  if (options.layout === "custom") {
    const custom = parseCustomGrid(options.grid);
    return custom.error ? errorLayout(custom.error) : grid(images, options, custom, placeholder);
  }
  return GRID_LAYOUTS[options.layout]
    ? grid(images, options, null, placeholder)
    : errorLayout(`Unknown layout "${options.layout}".`);
};

const codeLanguage = (node) => {
  const code = node.children?.find((child) => child.type === "element" && child.tagName === "code");
  const languageClass = code?.properties?.className?.find?.((name) => String(name).startsWith("language-"));
  return typeof languageClass === "string" ? languageClass.slice("language-".length) : "";
};

export const createImageLayoutsPlugin = (configuration = {}) => ({
  name: "render-obsidian-image-layouts",
  element: {
    filter: ["pre"],
    visit(node, ctx) {
      const rendered = renderImageLayout(codeLanguage(node), ctx.textContent(node), configuration, ctx);
      if (rendered) return rendered;
    },
  },
});

export const createObsidianImageSizePlugin = (configuration = {}) => {
  const resolver = createVaultResolver(configuration.vaultAssets);
  return {
  name: "render-obsidian-image-sizes",
  element: {
    filter: ["img"],
    visit(node, context) {
      const source = node.properties?.src;
      const resolvedSource = typeof source === "string" && !/^(?:https?:|data:|\/)/i.test(source)
        ? resolver.resolvePath(source, context.fileURL).link
        : source;
      const parsed = parseObsidianImageAlt(node.properties?.alt);
      if (!parsed.width && resolvedSource === source) return;
      const className = Array.isArray(node.properties?.className) ? [...node.properties.className] : [];
      if (parsed.width && !className.includes("obsidian-image-size")) className.push("obsidian-image-size");
      const style = [node.properties?.style, parsed.width && `--obsidian-image-width: ${parsed.width}px`];
      if (parsed.height) style.push(`--obsidian-image-height: ${parsed.height}px`);
      return {
        ...node,
        properties: {
          ...node.properties,
          src: resolvedSource,
          alt: parsed.alt,
          ...(className.length ? { className } : {}),
          ...(style.some(Boolean) ? { style: style.filter(Boolean).join("; ") } : {}),
        },
      };
    },
  },
  };
};

export const createObsidianWikiImagePlugin = (configuration = {}) => {
  const resolver = createVaultResolver(configuration.vaultAssets);
  return {
    name: "render-obsidian-wiki-images",
    text(node, ctx) {
      if (!node.value.includes("![[")) return;
      const children = [];
      let offset = 0;
      for (const match of node.value.matchAll(/!\[\[([^\]]+)\]\]/g)) {
        if (match.index > offset) children.push({ type: "text", value: node.value.slice(offset, match.index) });
        const parsed = parseLayoutImageLine(match[0]);
        if (!parsed) continue;
        const resolved = resolver.resolvePath(parsed.link, ctx.fileURL);
        const extension = path.posix.extname(parsed.link).slice(1).toLowerCase();
        if (!resolved.resolved && !IMAGE_EXTENSIONS.has(extension)) continue;
        const size = [parsed.alt, parsed.width && `${parsed.width}${parsed.height ? `x${parsed.height}` : ""}`].filter(Boolean).join("|");
        children.push({ type: "image", url: resolved.link, alt: size, title: null });
        offset = match.index + match[0].length;
      }
      if (!children.length) return;
      if (offset < node.value.length) children.push({ type: "text", value: node.value.slice(offset) });
      ctx.insertBefore(node, children);
      ctx.removeNode(node);
    },
  };
};
