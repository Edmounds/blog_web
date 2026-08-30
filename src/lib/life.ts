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
