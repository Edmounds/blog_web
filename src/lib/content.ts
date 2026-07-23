import { getCollection, type CollectionEntry } from "astro:content";

export interface SeriesSummary {
  title: string;
  slug: string;
  count: number;
}

type SiteSettings = CollectionEntry<"site">["data"];
type BlogEntry = CollectionEntry<"blog">;

const getOrder = (value: unknown): number => (typeof value === "number" ? value : Number.MAX_SAFE_INTEGER);

const sortBlogEntries = (a: BlogEntry, b: BlogEntry): number => {
  const order = getOrder(a.data.order) - getOrder(b.data.order);
  if (order !== 0) return order;
  return b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
};

const sortSeriesEntries = (a: BlogEntry, b: BlogEntry): number => {
  const order = getOrder(a.data.series?.order) - getOrder(b.data.series?.order);
  if (order !== 0) return order;
  return sortBlogEntries(a, b);
};

const getPublishedBlogEntries = async (): Promise<BlogEntry[]> => {
  const entries = await getCollection("blog", ({ data }) => !data.draft);
  return entries.sort(sortBlogEntries);
};

let siteSettingsPromise: Promise<SiteSettings> | undefined;

export const getSiteSettings = async (): Promise<SiteSettings> => {
  if (!siteSettingsPromise) {
    siteSettingsPromise = (async () => {
      const entries = await getCollection("site");
      const settings =
        entries.find((entry) => entry.slug === "settings" || entry.id === "settings.md" || entry.id === "settings") ??
        entries[0];

      if (!settings) {
        throw new Error("Missing site/settings content entry.");
      }

      return settings.data;
    })();
  }

  return siteSettingsPromise;
};

const getDateFormatters = async () => {
  const { dateLocale } = await getSiteSettings();

  return {
    monthDayFormatter: new Intl.DateTimeFormat(dateLocale, { month: "short", day: "numeric" }),
    longDateFormatter: new Intl.DateTimeFormat(dateLocale, { month: "long", day: "numeric", year: "numeric" }),
  };
};

const buildBlogSections = async (entries: BlogEntry[], sortEntries = sortBlogEntries) => {
  const groups = new Map<number, BlogEntry[]>();
  const { monthDayFormatter } = await getDateFormatters();

  for (const entry of entries) {
    const year = entry.data.archiveYear ?? entry.data.publishedAt.getFullYear();
    const group = groups.get(year);
    if (group) {
      group.push(entry);
    } else {
      groups.set(year, [entry]);
    }
  }

  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, posts]) => ({
      year,
      posts: posts.sort(sortEntries).map((entry) => ({
        slug: entry.slug,
        title: entry.data.title,
        summary: entry.data.archiveExcerpt ?? entry.data.summary,
        cover: entry.data.cover,
        category: entry.data.category,
        readingTime: entry.data.readingTime,
        dateLabel: monthDayFormatter.format(entry.data.publishedAt),
        archiveTags: entry.data.archiveTags,
      })),
    }));
};

export const getHomeBlogPosts = async () => {
  const entries = await getPublishedBlogEntries();
  const { monthDayFormatter, longDateFormatter } = await getDateFormatters();

  return entries
    .filter((entry) => entry.data.showOnHome)
    .map((entry) => ({
      slug: entry.slug,
      title: entry.data.title,
      summary: entry.data.summary,
      cover: entry.data.cover,
      category: entry.data.category,
      dateLabel: monthDayFormatter.format(entry.data.publishedAt),
      dateLong: longDateFormatter.format(entry.data.publishedAt),
      readingTime: entry.data.readingTime,
      archiveExcerpt: entry.data.archiveExcerpt,
      archiveTags: entry.data.archiveTags,
    }));
};

export const getArchiveBlogSections = async () => {
  const entries = (await getPublishedBlogEntries()).filter((entry) => entry.data.showInArchive);
  return buildBlogSections(entries);
};

export const getSeriesSummaries = async (): Promise<SeriesSummary[]> => {
  const entries = await getPublishedBlogEntries();
  const summaries = new Map<string, SeriesSummary & { order: number }>();

  for (const entry of entries) {
    const series = entry.data.series;
    if (!series) continue;

    const current = summaries.get(series.slug);
    if (current) {
      current.count += 1;
      current.order = Math.min(current.order, getOrder(series.order));
    } else {
      summaries.set(series.slug, {
        title: series.title,
        slug: series.slug,
        count: 1,
        order: getOrder(series.order),
      });
    }
  }

  return [...summaries.values()]
    .sort((a, b) => {
      const order = a.order - b.order;
      if (order !== 0) return order;
      return a.title.localeCompare(b.title);
    })
    .map(({ title, slug, count }) => ({ title, slug, count }));
};

export const getSeriesBlogSections = async (seriesSlug: string) => {
  const entries = (await getPublishedBlogEntries()).filter((entry) => entry.data.series?.slug === seriesSlug);
  return buildBlogSections(entries, sortSeriesEntries);
};

export const getSeriesStaticPaths = async () => {
  const summaries = await getSeriesSummaries();
  return summaries.map((series) => ({ params: { slug: series.slug } }));
};

export const getBlogStaticPaths = async () => {
  const entries = await getPublishedBlogEntries();
  return entries.map((entry) => ({ params: { slug: entry.slug } }));
};

export const getNextBlogPost = async (slug: string) => {
  const entries = await getPublishedBlogEntries();
  const index = entries.findIndex((entry) => entry.slug === slug);

  if (index === -1) {
    throw new Error(`Unknown blog slug: ${slug}`);
  }

  const next = entries[(index + 1) % entries.length];
  return {
    slug: next.slug,
    title: next.data.title,
  };
};

export const getAboutProfile = async () => {
  const entries = await getCollection("about");
  const profile =
    entries.find((entry) => entry.slug === "profile" || entry.id === "profile.md" || entry.id === "profile") ??
    entries[0];

  if (!profile) {
    throw new Error("Missing about/profile content entry.");
  }

  return {
    brand: profile.data.brand,
    titleLeading: profile.data.titleLeading,
    titleName: profile.data.titleName,
    subtitle: profile.data.subtitle,
    portrait: profile.data.portrait,
    meta: profile.data.meta,
    story: profile.data.story,
    focusCards: profile.data.focusCards,
    experience: profile.data.experience,
    availability: profile.data.availability,
    homeFeatured: {
      ...profile.data.homeFeatured,
      portrait: profile.data.portrait,
    },
  };
};
