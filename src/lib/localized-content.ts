import { getCollection } from "astro:content";

import { getPublishedContent, type ContentSection } from "./content";
import { defaultLocale, getLocaleDefinition, type Locale } from "./i18n";
import { getMessages } from "./messages";

const getSlug = (entry: { id: string; slug?: string }) =>
  entry.id.split("/").pop()?.replace(/\.(md|mdx)$/, "") ?? entry.slug ?? "";

export const getLocalizedSite = async (locale: Locale) => {
  const messages = getMessages(locale).site;
  return {
    brand: "chasen",
    htmlLang: getLocaleDefinition(locale).htmlLang,
    dateLocale: getLocaleDefinition(locale).dateLocale,
    seo: { defaultDescription: messages.defaultDescription, titleSeparator: " | " },
    labels: messages.nav,
    copy: messages.copy,
    page: messages.page,
  };
};

export const getLocalizedContentEntries = (locale: Locale, section: ContentSection) =>
  getPublishedContent(section, locale);

export const getLocalizedContentEntry = async (locale: Locale, section: ContentSection, slug: string) =>
  (await getPublishedContent(section, locale)).find((entry) => entry.slug === slug);

export const getLocalizedContentSections = async (locale: Locale, section: ContentSection) => {
  const formatter = new Intl.DateTimeFormat(getLocaleDefinition(locale).dateLocale, { month: "short", day: "numeric" });
  const groups = new Map<number, Awaited<ReturnType<typeof getPublishedContent>>>();
  for (const item of await getPublishedContent(section, locale)) {
    const year = item.createdAt.getFullYear();
    groups.set(year, [...(groups.get(year) ?? []), item]);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([year, posts]) => ({
    year,
    posts: posts.map((item) => ({
      slug: item.slug,
      title: item.title,
      dateLabel: formatter.format(item.createdAt),
      dateIso: item.createdAt.toISOString(),
      archiveTags: item.tags,
    })),
  }));
};

export const getLocalizedAbout = async (locale: Locale) => {
  const entries = locale === defaultLocale
    ? await getCollection("about") as any[]
    : await getCollection("translations", (entry) => entry.id.toLowerCase().startsWith(`${locale.toLowerCase()}/about/`)) as any[];
  const profile = entries.find((entry) => getSlug(entry) === "profile") ?? entries[0];
  if (!profile) throw new Error(`Missing about profile for ${locale}.`);
  return profile;
};

export const getLocalizedBlogEntries = (locale: Locale) => getLocalizedContentEntries(locale, "blog");
export const getLocalizedBlogEntry = (locale: Locale, slug: string) => getLocalizedContentEntry(locale, "blog", slug);
export const getLocalizedBlogSections = (locale: Locale) => getLocalizedContentSections(locale, "blog");
export const getLocalizedProjectEntries = (locale: Locale) => getLocalizedContentEntries(locale, "project");
export const getLocalizedProjectEntry = (locale: Locale, slug: string) => getLocalizedContentEntry(locale, "project", slug);
export const getLocalizedProjectSections = (locale: Locale) => getLocalizedContentSections(locale, "project");
export const getLocalizedNextPost = async (locale: Locale, slug: string) => {
  const entries = await getPublishedContent("blog", locale);
  const index = entries.findIndex((entry) => entry.slug === slug);
  if (index < 0 || entries.length < 2) return undefined;
  const next = entries[(index + 1) % entries.length];
  return { slug: next.slug, title: next.title };
};
