export const locales = ["zh-CN", "zh-TW", "en", "ja"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh-CN";

export interface LocaleDefinition {
  code: Locale;
  path: string;
  label: string;
  htmlLang: string;
  dateLocale: string;
  deeplxCode: string;
  dir: "ltr" | "rtl";
}

export const localeDefinitions: readonly LocaleDefinition[] = [
  { code: "zh-CN", path: "", label: "简体中文", htmlLang: "zh-CN", dateLocale: "zh-CN", deeplxCode: "ZH", dir: "ltr" },
  { code: "zh-TW", path: "zh-TW", label: "繁體中文", htmlLang: "zh-TW", dateLocale: "zh-TW", deeplxCode: "ZH-TW", dir: "ltr" },
  { code: "en", path: "en", label: "English", htmlLang: "en", dateLocale: "en-US", deeplxCode: "EN", dir: "ltr" },
  { code: "ja", path: "ja", label: "日本語", htmlLang: "ja", dateLocale: "ja-JP", deeplxCode: "JA", dir: "ltr" },
];

const definitionByLocale = new Map(localeDefinitions.map((definition) => [definition.code, definition]));
const localeByPath = new Map(localeDefinitions.filter((definition) => definition.path).map((definition) => [definition.path, definition.code]));

export const isLocale = (value: string | undefined): value is Locale =>
  typeof value === "string" && locales.includes(value as Locale);

export const getLocaleDefinition = (locale: Locale): LocaleDefinition => definitionByLocale.get(locale)!;

const normalizePathname = (pathname: string): string => {
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (withLeadingSlash === "/") return "/";
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
};

export const stripLocaleFromPath = (pathname: string): { locale: Locale; pathname: string } => {
  const normalized = normalizePathname(pathname);
  const [firstSegment] = normalized.slice(1).split("/");
  const locale = localeByPath.get(firstSegment) ?? defaultLocale;

  if (locale === defaultLocale) return { locale, pathname: normalized };

  const stripped = normalized.slice(firstSegment.length + 1) || "/";
  return { locale, pathname: normalizePathname(stripped) };
};

export const localizePath = (pathname: string, locale: Locale): string => {
  const { pathname: unlocalized } = stripLocaleFromPath(pathname);
  const definition = getLocaleDefinition(locale);
  return definition.path ? `/${definition.path}${unlocalized === "/" ? "/" : unlocalized}` : unlocalized;
};

export const switchLocaleInUrl = (value: string, locale: Locale): string => {
  const url = new URL(value, "https://local.invalid");
  url.pathname = localizePath(url.pathname, locale);
  return `${url.pathname}${url.search}${url.hash}`;
};

export const getAlternatePaths = (pathname: string) =>
  localeDefinitions.map((definition) => ({
    locale: definition.code,
    htmlLang: definition.htmlLang,
    href: localizePath(pathname, definition.code),
  }));
