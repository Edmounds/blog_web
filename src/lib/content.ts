import { getCollection, type CollectionEntry } from "astro:content";

export interface ArchiveCategorySummary {
  label: string;
  slug: string;
  count: number;
}

type SiteSettings = CollectionEntry<"site">["data"];

const getOrder = (value: unknown): number => (typeof value === "number" ? value : Number.MAX_SAFE_INTEGER);

const sortBlogEntries = (a: CollectionEntry<"blog">, b: CollectionEntry<"blog">): number => {
  const order = getOrder(a.data.order) - getOrder(b.data.order);
  if (order !== 0) return order;
  return b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
};

const sortProjectEntries = (a: CollectionEntry<"projects">, b: CollectionEntry<"projects">): number => {
  const order = getOrder(a.data.order) - getOrder(b.data.order);
  if (order !== 0) return order;
  return b.data.year - a.data.year;
};

const getPublishedBlogEntries = async (): Promise<CollectionEntry<"blog">[]> => {
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

const toCategorySlug = (label: string): string => {
  const normalized = label
    .toLowerCase()
    .trim()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "category";
};

const buildArchiveCategorySummaries = (entries: CollectionEntry<"blog">[]): ArchiveCategorySummary[] => {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const current = counts.get(entry.data.category) ?? 0;
    counts.set(entry.data.category, current + 1);
  }

  const slugCounts = new Map<string, number>();

  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, count]) => {
      const baseSlug = toCategorySlug(label);
      const current = (slugCounts.get(baseSlug) ?? 0) + 1;
      slugCounts.set(baseSlug, current);

      return {
        label,
        slug: current === 1 ? baseSlug : `${baseSlug}-${current}`,
        count,
      };
    });
};

export const getArchiveCategorySummaries = async (): Promise<ArchiveCategorySummary[]> => {
  const entries = (await getPublishedBlogEntries()).filter((entry) => entry.data.showInArchive);
  return buildArchiveCategorySummaries(entries);
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

export const getArchiveBlogSections = async (categorySlug?: string) => {
  const allEntries = (await getPublishedBlogEntries()).filter((entry) => entry.data.showInArchive);
  const categorySummaries = buildArchiveCategorySummaries(allEntries);
  const categorySlugByLabel = new Map(categorySummaries.map((item) => [item.label, item.slug]));
  const entries = categorySlug
    ? allEntries.filter((entry) => categorySlugByLabel.get(entry.data.category) === categorySlug)
    : allEntries;
  const groups = new Map<number, typeof entries>();
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
      posts: posts.sort(sortBlogEntries).map((entry) => ({
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

export const getHomeProjects = async () => {
  const entries = (await getCollection("projects")).sort(sortProjectEntries);
  return entries
    .filter((entry) => entry.data.showOnHome)
    .map((entry) => ({
      slug: entry.slug,
      title: entry.data.title,
      category: entry.data.category,
      type: entry.data.type ?? "Project",
      summary: entry.data.summary,
      cover: entry.data.cover,
      cta: entry.data.cta ?? "View Case Study",
    }));
};

export const getTimelineProjects = async () => {
  const entries = (await getCollection("projects"))
    .sort(sortProjectEntries)
    .filter((entry) => entry.data.showInTimeline);

  return entries.map((entry, index) => ({
    slug: entry.slug,
    title: entry.data.title,
    year: String(entry.data.year),
    category: entry.data.category,
    summary: entry.data.summary,
    cover: entry.data.cover,
    href: entry.data.href,
    side: entry.data.side ?? (index % 2 === 0 ? "left" : "right"),
  }));
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
