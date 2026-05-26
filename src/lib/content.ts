import { getCollection, type CollectionEntry } from "astro:content";

export interface ArchiveCategorySummary {
  label: string;
  slug: string;
  count: number;
}

export interface SeriesSummary {
  title: string;
  slug: string;
  count: number;
}

type SiteSettings = CollectionEntry<"site">["data"];
type BlogEntry = CollectionEntry<"blog">;
type ProjectEntry = CollectionEntry<"projects">;

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

const sortProjectEntries = (a: CollectionEntry<"projects">, b: CollectionEntry<"projects">): number => {
  const order = getOrder(a.data.order) - getOrder(b.data.order);
  if (order !== 0) return order;
  return b.data.year - a.data.year;
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

const buildArchiveCategorySummaries = (entries: BlogEntry[]): ArchiveCategorySummary[] => {
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

const buildProjectCategorySummaries = (entries: ProjectEntry[]): ArchiveCategorySummary[] => {
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

export const getProjectStaticPaths = async () => {
  const entries = await getCollection("projects");
  return entries.map((entry) => ({ params: { slug: entry.slug }, props: { project: entry } }));
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
      href: entry.data.href,
    }));
};

const getProjectEntriesForArchive = async (): Promise<ProjectEntry[]> =>
  (await getCollection("projects")).sort(sortProjectEntries);

export const getArchiveProjectSections = async (categorySlug?: string) => {
  const allEntries = await getProjectEntriesForArchive();
  const categorySummaries = buildProjectCategorySummaries(allEntries);
  const categorySlugByLabel = new Map(categorySummaries.map((item) => [item.label, item.slug]));
  const entries = categorySlug
    ? allEntries.filter((entry) => categorySlugByLabel.get(entry.data.category) === categorySlug)
    : allEntries;
  const groups = new Map<number, ProjectEntry[]>();

  for (const entry of entries) {
    const group = groups.get(entry.data.year);
    if (group) {
      group.push(entry);
    } else {
      groups.set(entry.data.year, [entry]);
    }
  }

  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, projects]) => ({
      year,
      posts: projects.sort(sortProjectEntries).map((entry) => ({
        slug: entry.slug,
        title: entry.data.title,
        summary: entry.data.summary,
        cover: entry.data.cover,
        category: entry.data.category,
        type: entry.data.type ?? "Project",
        cta: entry.data.cta ?? "View Case Study",
        href: entry.data.href,
        dateLabel: String(entry.data.year),
      })),
    }));
};

export const getProjectCategorySummaries = async (): Promise<ArchiveCategorySummary[]> => {
  const entries = await getProjectEntriesForArchive();
  return buildProjectCategorySummaries(entries);
};

export const getNextProject = async (slug: string) => {
  const entries = (await getCollection("projects")).sort(sortProjectEntries);
  const index = entries.findIndex((entry) => entry.slug === slug);

  if (index === -1) {
    throw new Error(`Unknown project slug: ${slug}`);
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
