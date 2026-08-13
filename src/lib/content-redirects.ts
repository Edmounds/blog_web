import { isLifeType } from "./spa-routes.ts";

const LEGACY_CONTENT_SLUGS: Record<string, string> = {
  "blog/designing-for-clarity-in-chaos": "blog/20260128-01",
  "blog/first-note": "blog/20260128-01",
  "note/arknights-p3r": "note/20260726-01",
  "note/dongyeguiwu-passaway": "note/20260727-01",
};

const CONTENT_PATH_PATTERN = /^\/(?:(en|ja|zh-TW)\/)?(blog|note)\/([^/]+)\/?$/;

const ART_PATH_PATTERN = /^\/(?:(en|ja|zh-TW)\/)?art(?:\/([^/]+))?\/?$/;

export const getLegacyContentRedirect = (requestUrl: URL): URL | undefined => {
  const match = requestUrl.pathname.match(CONTENT_PATH_PATTERN);
  if (!match) return undefined;

  const [, locale, section, slug] = match;
  const destination = LEGACY_CONTENT_SLUGS[`${section}/${slug}`];
  if (!destination) return undefined;

  const redirectUrl = new URL(requestUrl);
  redirectUrl.pathname = `/${locale ? `${locale}/` : ""}${destination}/`;
  return redirectUrl;
};

/** The Life collections moved from `/art/*` to `/life/*` when Life joined the SPA. */
export const getLegacyArtRedirect = (requestUrl: URL): URL | undefined => {
  const match = requestUrl.pathname.match(ART_PATH_PATTERN);
  if (!match) return undefined;

  const [, locale, type] = match;
  if (type !== undefined && !isLifeType(type)) return undefined;

  const redirectUrl = new URL(requestUrl);
  redirectUrl.pathname = `/${locale ? `${locale}/` : ""}life/${type ? `${type}/` : ""}`;
  return redirectUrl;
};
