import { stripLocaleFromPath } from "./i18n";

export type BackgroundKind =
  | "plain"
  | "constellation"
  | "rain"
  | "grid"
  | "particles";

export function getBackgroundKind(pathname: string): BackgroundKind {
  const { pathname: path } = stripLocaleFromPath(pathname);
  if (path.startsWith("/admin")) return "plain";
  if (path === "/links/") return "constellation";
  if (path === "/about/") return "rain";
  if (path.startsWith("/art/")) return "constellation";
  if (path === "/blog/" || path === "/note/") return "grid";
  return "particles";
}
