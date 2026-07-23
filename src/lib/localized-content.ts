import { getCollection } from "astro:content";

import { defaultLocale, getLocaleDefinition, type Locale } from "./i18n";
import { getMessages } from "./messages";
import type { NavItem } from "../types/ui";

const getSlug = (entry: { id: string; slug?: string }) =>
  entry.id.split("/").pop()?.replace(/\.md$/, "") ?? entry.slug ?? "";

const getOrder = (entry: any) => typeof entry.data.order === "number" ? entry.data.order : Number.MAX_SAFE_INTEGER;

const getBlogEntries = async (locale: Locale) => {
  if (locale === defaultLocale) return getCollection("blog", ({ data }) => !data.draft) as Promise<any[]>;
  return getCollection("translations", (entry) => entry.id.startsWith(`${locale}/blog/`) && !entry.data.draft) as Promise<any[]>;
};

export const getLocalizedSite = async (locale: Locale) => {
  const messages = getMessages(locale).site;
  const nav: NavItem[] = [
    { label: messages.nav.home, href: "/", match: "exact" },
    { label: messages.nav.blog, href: "/blogs/", match: "prefix" },
    { label: messages.nav.about, href: "/about/", match: "prefix" },
    {
      label: messages.nav.art,
      href: "/art/screen/",
      match: "prefix",
      children: [
        { label: messages.nav.book, href: "/art/book/", match: "prefix" },
        { label: messages.nav.music, href: "/art/music/", match: "prefix" },
        { label: messages.nav.screen, href: "/art/screen/", match: "prefix" },
      ],
    },
  ];
  return {
    brand: messages.brand,
    htmlLang: getLocaleDefinition(locale).htmlLang,
    dateLocale: getLocaleDefinition(locale).dateLocale,
    seo: { defaultDescription: messages.defaultDescription, titleSeparator: " | " },
    nav,
    labels: messages.nav,
    copy: messages.copy,
    page: messages.page,
  };
};

export const getLocalizedBlogEntries = async (locale: Locale) =>
  (await getBlogEntries(locale)).sort((a, b) => {
    const order = getOrder(a) - getOrder(b);
    return order || new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime();
  });

export const getLocalizedBlogEntry = async (locale: Locale, slug: string) =>
  (await getLocalizedBlogEntries(locale)).find((entry) => getSlug(entry) === slug);

export const getLocalizedBlogSections = async (locale: Locale) => {
  const entries = (await getLocalizedBlogEntries(locale)).filter((entry) => entry.data.showInArchive);
  const formatter = new Intl.DateTimeFormat(getLocaleDefinition(locale).dateLocale, { month: "short", day: "numeric" });
  const groups = new Map<number, any[]>();
  for (const entry of entries) {
    const date = new Date(entry.data.publishedAt);
    const year = entry.data.archiveYear ?? date.getFullYear();
    groups.set(year, [...(groups.get(year) ?? []), entry]);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([year, posts]) => ({
    year,
    posts: posts.map((entry) => ({
      slug: getSlug(entry),
      title: entry.data.title,
      summary: entry.data.archiveExcerpt ?? entry.data.summary,
      cover: entry.data.cover,
      category: entry.data.category,
      readingTime: entry.data.readingTime,
      dateLabel: formatter.format(new Date(entry.data.publishedAt)),
      archiveTags: entry.data.archiveTags,
    })),
  }));
};

export const getLocalizedNextPost = async (locale: Locale, slug: string) => {
  const entries = await getLocalizedBlogEntries(locale);
  const index = entries.findIndex((entry) => getSlug(entry) === slug);
  if (index < 0) throw new Error(`Unknown blog slug: ${slug}`);
  const next = entries[(index + 1) % entries.length];
  return { slug: getSlug(next), title: next.data.title };
};

export const getLocalizedAbout = async (locale: Locale) => {
  const entries = locale === defaultLocale
    ? await getCollection("about") as any[]
    : await getCollection("translations", (entry) => entry.id.startsWith(`${locale}/about/`)) as any[];
  const profile = entries.find((entry) => getSlug(entry) === "profile") ?? entries[0];
  if (!profile) throw new Error(`Missing about profile for ${locale}.`);
  return { ...profile.data, homeFeatured: { ...profile.data.homeFeatured, portrait: profile.data.portrait } };
};
