import { stripLocaleFromPath } from "./i18n.ts";

export const LIFE_TYPES = ["book", "music", "screen", "game"] as const;

export type LifeType = (typeof LIFE_TYPES)[number];

export const LIFE_TITLES: Record<LifeType, string> = {
  book: "BOOKS",
  music: "MUSIC",
  screen: "MOVIES",
  game: "GAMES",
};

export const LIFE_HOME_ROUTE = "/life/";

export const TOP_ROUTES = [
  "/",
  "/blog/",
  "/note/",
  "/links/",
  "/about/",
  LIFE_HOME_ROUTE,
] as const;

export const LIFE_TOP_INDEX = TOP_ROUTES.indexOf(LIFE_HOME_ROUTE);

export const LIFE_ROUTES = [
  LIFE_HOME_ROUTE,
  ...LIFE_TYPES.map((type) => `/life/${type}/`),
];

export interface SpaLocation {
  /** Index in `TOP_ROUTES`, or -1 when the path is not an SPA route. */
  top: number;
  /** Index in `LIFE_ROUTES`; always 0 outside the Life slide. */
  life: number;
}

export const isLifeType = (value: string | undefined): value is LifeType =>
  typeof value === "string" && LIFE_TYPES.includes(value as LifeType);

export const resolveSpaLocation = (pathname: string): SpaLocation => {
  const { pathname: path } = stripLocaleFromPath(pathname);
  const life = LIFE_ROUTES.indexOf(path);
  if (life >= 0) return { top: LIFE_TOP_INDEX, life };
  return { top: TOP_ROUTES.indexOf(path as (typeof TOP_ROUTES)[number]), life: 0 };
};

export const spaPathFor = (top: number, life = 0): string => {
  if (top === LIFE_TOP_INDEX) return LIFE_ROUTES[life] ?? LIFE_HOME_ROUTE;
  return TOP_ROUTES[top] ?? "/";
};
