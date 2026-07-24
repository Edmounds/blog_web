export type ArtType = "book" | "music" | "movie" | "series" | "anime";
export type ArtLocale = "zh-CN" | "zh-TW" | "en" | "ja";

export interface ArtTranslation {
  title: string;
  creator: string;
  extra: string;
}

export interface ArtRecord {
  id: string;
  type: ArtType;
  source: string;
  sourceId: string;
  isbn: string;
  originalTitle: string;
  releaseDate: string;
  coverKey: string;
  coverSourceUrl: string;
  coverUrl: string;
  collectedOn: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
  translations: Partial<Record<ArtLocale, ArtTranslation>>;
}

export interface ArtItem {
  id: string;
  type: ArtType;
  title: string;
  creator: string;
  extra: string;
  cover: string;
}

interface ArtRow {
  id: string;
  type: ArtType;
  source: string;
  source_id: string | null;
  isbn: string | null;
  original_title: string | null;
  release_date: string | null;
  cover_key: string;
  cover_source_url: string | null;
  collected_on: string;
  is_visible: number;
  created_at: string;
  updated_at: string;
  locale: ArtLocale | null;
  title: string | null;
  creator: string | null;
  extra: string | null;
}

const LOCALES = new Set<ArtLocale>(["zh-CN", "zh-TW", "en", "ja"]);
const ART_COVER_BASE_URL = "https://img.muelsyse.us";

export async function getPublicArtItems(db: D1Database, locale: ArtLocale, types: ArtType[]): Promise<ArtItem[]> {
  if (!types.length) return [];
  const placeholders = types.map(() => "?").join(", ");
  const rows = (await db.prepare(
    `SELECT item.*, translation.locale, translation.title, translation.creator, translation.extra
     FROM art_items item
     LEFT JOIN art_item_translations translation ON translation.item_id = item.id
     WHERE item.is_visible = 1 AND item.type IN (${placeholders})
     ORDER BY item.collected_on DESC, item.created_at DESC, item.id DESC, translation.locale ASC`,
  ).bind(...types).all<ArtRow>()).results ?? [];
  return localize(groupRows(rows), locale);
}

function groupRows(rows: ArtRow[]): ArtRecord[] {
  const items = new Map<string, ArtRecord>();
  for (const row of rows) {
    let item = items.get(row.id);
    if (!item) {
      item = {
        id: row.id,
        type: row.type,
        source: row.source,
        sourceId: row.source_id ?? "",
        isbn: row.isbn ?? "",
        originalTitle: row.original_title ?? "",
        releaseDate: row.release_date ?? "",
        coverKey: row.cover_key,
        coverSourceUrl: row.cover_source_url ?? "",
        coverUrl: `${ART_COVER_BASE_URL}/${row.cover_key}`,
        collectedOn: row.collected_on,
        isVisible: Number(row.is_visible) === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        translations: {},
      };
      items.set(row.id, item);
    }
    if (row.locale && LOCALES.has(row.locale) && row.title && row.creator) {
      item.translations[row.locale] = { title: row.title, creator: row.creator, extra: row.extra ?? "" };
    }
  }
  return [...items.values()];
}

function localize(items: ArtRecord[], locale: ArtLocale): ArtItem[] {
  return items.flatMap((item) => {
    const translation = item.translations[locale] ?? item.translations["zh-CN"];
    if (!translation) return [];
    return [{ id: item.id, type: item.type, title: translation.title, creator: translation.creator, extra: translation.extra, cover: item.coverUrl }];
  });
}
