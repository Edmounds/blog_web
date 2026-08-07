import { listArtItems, localizeArtItems } from "../server/art.js";

export type ArtType = "book" | "music" | "movie" | "series" | "anime";
export type ArtMusicKind = "album" | "single";
export type ArtLocale = "zh-CN" | "zh-TW" | "en" | "ja";

export interface ArtTranslation {
  title: string;
  creator: string;
  extra: string;
}

export interface ArtRecord {
  id: string;
  type: ArtType;
  musicKind: ArtMusicKind | null;
  source: string;
  sourceId: string;
  isbn: string;
  originalTitle: string;
  releaseDate: string;
  coverKey: string | null;
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
  musicKind: ArtMusicKind | null;
  title: string;
  creator: string;
  extra: string;
  cover: string;
  coverFallback: string | null;
}

export async function getPublicArtItems(db: D1Database, locale: ArtLocale, types: ArtType[]): Promise<ArtItem[]> {
  if (!types.length) return [];
  const items = await listArtItems(db, { types, visibleOnly: true }) as ArtRecord[];
  return localizeArtItems(
    items.filter((item) => item.translations[locale] ?? item.translations["zh-CN"]),
    locale,
  ) as ArtItem[];
}
