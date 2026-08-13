import { ART_COVER_BASE_URL, parseExternalArtCoverUrl } from "../../src/server/art.js";
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
const bucketUrl = (key) => `${ART_COVER_BASE_URL}/${String(key).replace(/^\/+/, "")}`;

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
  sections: Object.fromEntries(LIFE_COVER_SECTIONS.map((section) => [section, []])),
});

export function artCoverSource(row) {
  if (row?.cover_key) return { url: bucketUrl(row.cover_key) };
  const external = parseExternalArtCoverUrl(row?.source, row?.cover_source_url ?? "");
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
export function selectCoverSources(rows, resolveSource, limit = LIFE_COVER_LIMIT) {
  const selected = [];
  for (const row of rows ?? []) {
    if (selected.length >= limit) break;
    const source = resolveSource(row);
    if (!source) continue;
    selected.push({ id: String(row.id), ...source });
  }
  return selected;
}

export function selectLifeCoverSources(rowsBySection, limit = LIFE_COVER_LIMIT) {
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
