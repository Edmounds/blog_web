import { listPublicGames } from "../server/games.js";

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

export async function getPublicGameItems(db: D1Database): Promise<GameItem[]> {
  return listPublicGames(db) as Promise<GameItem[]>;
}
