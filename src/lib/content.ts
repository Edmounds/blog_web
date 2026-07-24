import { getCollection, type CollectionEntry } from "astro:content";

import { defaultLocale, type Locale } from "./i18n";

export const CONTENT_SECTIONS = ["blog", "note", "project"] as const;
export type ContentSection = (typeof CONTENT_SECTIONS)[number];
export type ContentEntry = CollectionEntry<ContentSection>;

type SiteSettings = CollectionEntry<"site">["data"];

export interface ContentSummary {
  contentId: string;
  section: ContentSection;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: Date;
  updatedAt?: Date;
  readingTime: string;
  projectUrl?: string;
  docUrl?: string;
  entry: ContentEntry;
}

const slugFromEntry = (entry: { id: string; slug?: string }) =>
  entry.slug || entry.id.split("/").pop()?.replace(/\.(md|mdx)$/, "") || "";

export const getContentId = (section: ContentSection, slug: string) => `${section}/${slug}`;

const compareEntries = (a: ContentEntry, b: ContentEntry) => {
  const order = (a.data.order ?? Number.MAX_SAFE_INTEGER) - (b.data.order ?? Number.MAX_SAFE_INTEGER);
  return order || b.data.createdAt.getTime() - a.data.createdAt.getTime();
};

export const readingTimeForBody = (body = "", locale: Locale = defaultLocale) => {
  const text = body.replace(/```[\s\S]*?```/g, " ").replace(/<[^>]+>/g, " ");
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]/g) ?? []).length;
  const words = (text.replace(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]/g, " ").match(/[\p{L}\p{N}]+/gu) ?? []).length;
  const minutes = Math.max(1, Math.ceil(cjk / 350 + words / 220));
  if (locale === "zh-CN" || locale === "zh-TW") return `${minutes} 分钟`;
  if (locale === "ja") return `${minutes} 分`;
  return `${minutes} min`;
};

const summarize = (entry: ContentEntry, section: ContentSection, locale: Locale): ContentSummary => {
  const slug = slugFromEntry(entry);
  return {
    contentId: getContentId(section, slug),
    section,
    slug,
    title: entry.data.title,
    description: entry.data.description,
    tags: entry.data.tags,
    createdAt: entry.data.createdAt,
    updatedAt: entry.data.updatedAt,
    readingTime: readingTimeForBody(entry.body, locale),
    projectUrl: "projectUrl" in entry.data ? entry.data.projectUrl : undefined,
    docUrl: "docUrl" in entry.data ? entry.data.docUrl : undefined,
    entry,
  };
};

export const getPublishedContent = async (section: ContentSection, locale: Locale = defaultLocale) => {
  const entries = locale === defaultLocale
    ? await getCollection(section, ({ data }) => data.published)
    : await getCollection("translations", (entry) =>
        entry.id.toLowerCase().startsWith(`${locale.toLowerCase()}/${section}/`) && entry.data.published !== false,
      );

  return (entries as ContentEntry[]).sort(compareEntries).map((entry) => summarize(entry, section, locale));
};

export const getAllPublishedContent = async (locale: Locale = defaultLocale) => {
  const groups = await Promise.all(CONTENT_SECTIONS.map((section) => getPublishedContent(section, locale)));
  return groups.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

export const getContentBySlug = async (section: ContentSection, slug: string, locale: Locale = defaultLocale) =>
  (await getPublishedContent(section, locale)).find((item) => item.slug === slug);

export const getContentStaticPaths = async (section: ContentSection) =>
  (await getPublishedContent(section)).map((item) => ({ params: { slug: item.slug }, props: { item } }));

export const getLocalizedContentStaticPaths = async (section: ContentSection) => {
  const locales: Locale[] = ["en", "ja", "zh-TW"];
  const groups = await Promise.all(locales.map(async (locale) =>
    (await getPublishedContent(section, locale)).map((item) => ({
      params: { locale, slug: item.slug },
      props: { item, locale },
    })),
  ));
  return groups.flat();
};

export const getNextContent = async (section: ContentSection, slug: string, locale: Locale = defaultLocale) => {
  const entries = await getPublishedContent(section, locale);
  const index = entries.findIndex((entry) => entry.slug === slug);
  return index < 0 || entries.length < 2 ? undefined : entries[(index + 1) % entries.length];
};

let siteSettingsPromise: Promise<SiteSettings> | undefined;

export const getSiteSettings = async (): Promise<SiteSettings> => {
  if (!siteSettingsPromise) {
    siteSettingsPromise = (async () => {
      const entries = await getCollection("site");
      const settings = entries.find((entry) => entry.id === "settings.md" || entry.id === "settings") ?? entries[0];
      if (!settings) throw new Error("Missing site/settings content entry.");
      return settings.data;
    })();
  }
  return siteSettingsPromise;
};

export const getAboutProfile = async () => {
  const entries = await getCollection("about");
  const profile = entries.find((entry) => entry.id === "profile.md" || entry.id === "profile") ?? entries[0];
  if (!profile) throw new Error("Missing about/profile content entry.");
  return profile;
};
