import { stripLocaleFromPath } from "./i18n.ts";

export const PRIMARY_ROUTES = [
  "/",
  "/blog/",
  "/note/",
  "/links/",
  "/about/",
] as const;

export type PrimaryRoute = (typeof PRIMARY_ROUTES)[number];

export const isPrimaryRoute = (path: string): path is PrimaryRoute =>
  (PRIMARY_ROUTES as readonly string[]).includes(path);

export const resolvePrimaryIndex = (pathname: string): number => {
  const { pathname: path } = stripLocaleFromPath(pathname);
  return PRIMARY_ROUTES.indexOf(path as PrimaryRoute);
};

export const primaryPathFor = (index: number): string =>
  PRIMARY_ROUTES[index] ?? "/";
