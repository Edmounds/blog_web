import {
  getGameCoverUrl,
  getSteamCoverUrl,
  getSteamStoreUrl,
} from "../../functions/_shared/games.js";

export type GameSource = "steam" | "manual";

export interface GameItem {
  id: string;
  source: GameSource;
  steamAppId: number | null;
  title: string;
  steamPlaytimeMinutes: number;
  customPlaytimeMinutes: number | null;
  playtimeMinutes: number;
  isVisible: boolean;
  coverKey: string | null;
  cover: string;
  defaultCover: string;
  storeUrl: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GameSyncState {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastSyncedCount: number;
  lastError: string | null;
}

interface GameRow {
  id: string;
  source: GameSource;
  steam_app_id: number | null;
  title: string;
  steam_playtime_minutes: number;
  custom_playtime_minutes: number | null;
  is_visible: number;
  cover_key: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getPublicGameItems(db: D1Database): Promise<GameItem[]> {
  const rows = (await db.prepare(
    `SELECT * FROM game_items WHERE is_visible = 1
     ORDER BY COALESCE(custom_playtime_minutes, steam_playtime_minutes) DESC, title COLLATE NOCASE ASC, id ASC`,
  ).all<GameRow>()).results ?? [];
  return rows.map((row) => {
    const steamAppId = row.steam_app_id == null ? null : Number(row.steam_app_id);
    const customPlaytimeMinutes = row.custom_playtime_minutes == null ? null : Number(row.custom_playtime_minutes);
    const steamPlaytimeMinutes = Number(row.steam_playtime_minutes ?? 0);
    const coverKey = row.cover_key ?? null;
    return {
      id: row.id,
      source: row.source,
      steamAppId,
      title: row.title,
      steamPlaytimeMinutes,
      customPlaytimeMinutes,
      playtimeMinutes: customPlaytimeMinutes ?? steamPlaytimeMinutes,
      isVisible: true,
      coverKey,
      cover: coverKey ? getGameCoverUrl(coverKey) : steamAppId ? getSteamCoverUrl(steamAppId) : "/images/placeholders/default-cover.webp",
      defaultCover: steamAppId ? getSteamCoverUrl(steamAppId) : "/images/placeholders/default-cover.webp",
      storeUrl: steamAppId ? getSteamStoreUrl(steamAppId) : null,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}
