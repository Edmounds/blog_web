export const LIFE_TYPES = ["book", "music", "screen", "game"] as const;

export type LifeType = (typeof LIFE_TYPES)[number];

export const LIFE_TITLES: Record<LifeType, string> = {
  book: "BOOKS",
  music: "MUSIC",
  screen: "MOVIES",
  game: "GAMES",
};

export const isLifeType = (value: string | undefined): value is LifeType =>
  typeof value === "string" && (LIFE_TYPES as readonly string[]).includes(value);

export interface SubmenuShiftParams {
  triggerRight: number;
  submenuWidth: number;
  searchLeft: number;
  navLeft: number;
  logoRight: number;
  searchBuffer?: number;
  logoBuffer?: number;
}

export function computeSubmenuShift({
  triggerRight,
  submenuWidth,
  searchLeft,
  navLeft,
  logoRight,
  searchBuffer = 12,
  logoBuffer = 16,
}: SubmenuShiftParams): number {
  const neededRight = triggerRight + submenuWidth + searchBuffer;
  const overflow = Math.max(0, neededRight - searchLeft);
  if (overflow === 0) return 0;
  const maxAllowedShift = Math.max(0, navLeft - logoRight - logoBuffer);
  return Math.min(overflow, maxAllowedShift);
}

