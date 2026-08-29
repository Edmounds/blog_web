import {
  ART_COVER_BASE_URL,
  parseExternalArtCoverUrl,
} from "../../src/server/art.js";
import { getSteamCoverUrl } from "../../src/server/games.js";

/** Covers shown in one Life home deck. */
export const LIFE_COVER_LIMIT = 6;

/** Rows to read per section so items without a usable cover can be skipped. */
export const LIFE_COVER_CANDIDATES = 18;

/** Thumbnails are baked at roughly twice the deck size so they stay crisp. */
export const LIFE_COVER_BOXES = {
  book: { width: 96, height: 144 },
  music: { width: 112, height: 112 },
  screen: { width: 96, height: 144 },
  game: { width: 96, height: 144 },
};

export const LIFE_COVER_SECTIONS = ["book", "music", "screen", "game"];

const DOUBAN_REFERER = "https://book.douban.com/";

/**
 * Art and game covers share one bucket. The site serves game covers through
 * its own `/media/game/` proxy, which a build running outside the Worker
 * cannot reach, so the snapshot reads the bucket origin directly.
 */
const bucketUrl = (key) =>
  `${ART_COVER_BASE_URL}/${String(key).replace(/^\/+/, "")}`;

const artQuery = (types, extraWhere = "") =>
  `SELECT id, source, cover_key, cover_source_url FROM art_items
   WHERE is_visible = 1 AND type IN (${types.map((type) => `'${type}'`).join(", ")})${extraWhere}
   ORDER BY collected_on DESC, created_at DESC, id DESC
   LIMIT ${LIFE_COVER_CANDIDATES}`;

/** Mirrors the ordering the public Life pages use, so the deck previews the top of each grid. */
export const LIFE_COVER_QUERIES = {
  book: artQuery(["book"]),
  // Singles reuse their album artwork, so the deck only reads albums.
  music: artQuery(["music"], " AND music_kind = 'album'"),
  screen: artQuery(["movie", "series", "anime"]),
  game: `SELECT id, steam_app_id, cover_key FROM game_items
   WHERE is_visible = 1
   ORDER BY COALESCE(custom_playtime_minutes, steam_playtime_minutes) DESC, title COLLATE NOCASE ASC, id ASC
   LIMIT ${LIFE_COVER_CANDIDATES}`,
};

export const emptyLifeCovers = () => ({
  generatedAt: null,
  sections: Object.fromEntries(
    LIFE_COVER_SECTIONS.map((section) => [section, []]),
  ),
});

export function artCoverSource(row) {
  if (row?.cover_key) return { url: bucketUrl(row.cover_key) };
  const external = parseExternalArtCoverUrl(
    row?.source,
    row?.cover_source_url ?? "",
  );
  if (!external) return null;
  return new URL(external).hostname.endsWith(".doubanio.com")
    ? { url: external, referer: DOUBAN_REFERER }
    : { url: external };
}

export function gameCoverSource(row) {
  if (row?.cover_key) return { url: bucketUrl(row.cover_key) };
  if (row?.steam_app_id == null) return null;
  const appId = Number(row.steam_app_id);
  return Number.isFinite(appId) ? { url: getSteamCoverUrl(appId) } : null;
}

/** Keeps the first `limit` rows that resolve to a real cover, dropping the rest. */
export function selectCoverSources(
  rows,
  resolveSource,
  limit = LIFE_COVER_LIMIT,
) {
  const selected = [];
  for (const row of rows ?? []) {
    if (selected.length >= limit) break;
    const source = resolveSource(row);
    if (!source) continue;
    selected.push({ id: String(row.id), ...source });
  }
  return selected;
}

export function selectLifeCoverSources(
  rowsBySection,
  limit = LIFE_COVER_LIMIT,
) {
  return Object.fromEntries(
    LIFE_COVER_SECTIONS.map((section) => [
      section,
      selectCoverSources(
        rowsBySection?.[section],
        section === "game" ? gameCoverSource : artCoverSource,
        limit,
      ),
    ]),
  );
}

/**
 * Resolves thumbnails for a section, reusing existing thumbnails when available
 * unless force is enabled.
 */
export async function resolveSectionCovers({
  sources = [],
  existingCovers = [],
  box,
  renderThumbnail,
  force = false,
}) {
  const existingById = new Map(
    (existingCovers ?? [])
      .filter((cover) => Boolean(cover?.id && cover?.thumbnail))
      .map((cover) => [String(cover.id), cover]),
  );

  const covers = [];
  let cached = 0;
  let fresh = 0;

  for (const source of sources) {
    const existing = !force ? existingById.get(String(source.id)) : undefined;
    if (
      existing &&
      existing.thumbnail &&
      existing.width === box.width &&
      existing.height === box.height
    ) {
      covers.push({
        id: String(source.id),
        width: box.width,
        height: box.height,
        thumbnail: existing.thumbnail,
      });
      cached += 1;
    } else {
      const thumbnail = await renderThumbnail(source, box);
      covers.push({
        id: String(source.id),
        width: box.width,
        height: box.height,
        thumbnail,
      });
      fresh += 1;
    }
  }

  return { covers, stats: { total: sources.length, cached, fresh } };
}

/**
 * Checks if two sections maps have identical items, order, dimensions, and thumbnails.
 */
export function areLifeCoverSectionsEqual(prevSections, nextSections) {
  if (!prevSections || !nextSections) return false;
  for (const section of LIFE_COVER_SECTIONS) {
    const prev = prevSections[section] ?? [];
    const next = nextSections[section] ?? [];
    if (prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i += 1) {
      const p = prev[i];
      const n = next[i];
      if (
        p?.id !== n?.id ||
        p?.width !== n?.width ||
        p?.height !== n?.height ||
        p?.thumbnail !== n?.thumbnail
      ) {
        return false;
      }
    }
  }
  return true;
}
