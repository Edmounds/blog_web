import { routes } from "./routes";
import type { ArchiveFilterModel, ArticleMetaModel, ContentCardModel, TimelineItemModel } from "../types/ui";

interface BlogCardSource {
  slug: string;
  title: string;
  summary: string;
  cover: string;
  category: string;
  dateLabel: string;
  readingTime: string;
  archiveTags?: string[];
}

interface BlogCardCopy {
  publishedLabel: string;
  readLabel: string;
  readArticleLabel: string;
}

interface ProjectCardSource {
  title: string;
  summary: string;
  cover: string;
  category: string;
  type: string;
  cta: string;
  href?: string;
}

interface ArchiveCategorySummarySource {
  label: string;
  slug: string;
  count: number;
}

interface TimelineProjectSource {
  title: string;
  year: string;
  category: string;
  summary: string;
  cover: string;
  href?: string;
  side: "left" | "right";
}

interface ArticleMetaSource {
  slug: string;
  category: string;
  dateLong: string;
  readingTime: string;
}

interface ArticleMetaLabels {
  categoryLabel: string;
  publishedLabel: string;
  readingTimeLabel: string;
  slugLabel: string;
}

const DEFAULT_BLOG_CARD_COPY: BlogCardCopy = {
  publishedLabel: "Published",
  readLabel: "Read",
  readArticleLabel: "Read article",
};

const DEFAULT_ARTICLE_META_LABELS: ArticleMetaLabels = {
  categoryLabel: "Category",
  publishedLabel: "Published",
  readingTimeLabel: "Reading time",
  slugLabel: "Slug",
};

export const toBlogCardModel = (post: BlogCardSource, copy: BlogCardCopy = DEFAULT_BLOG_CARD_COPY): ContentCardModel => ({
  variant: "blog",
  title: post.title,
  summary: post.summary,
  href: `/blog/${post.slug}/`,
  image: post.cover,
  imageAlt: post.title,
  eyebrow: post.category,
  meta: [
    { label: copy.publishedLabel, value: post.dateLabel },
    { label: copy.readLabel, value: post.readingTime },
  ],
  tags: post.archiveTags,
  footerText: copy.readArticleLabel,
});

export const toProjectCardModel = (project: ProjectCardSource): ContentCardModel => ({
  variant: "project",
  title: project.title,
  summary: project.summary,
  href: project.href ?? routes.projects,
  image: project.cover,
  imageAlt: project.title,
  eyebrow: project.category,
  meta: [{ label: "Type", value: project.type }],
  footerText: project.cta,
});

export const toArchiveFilters = (
  categories: ArchiveCategorySummarySource[],
  allLabel = "All Categories",
  activeCategorySlug?: string,
): ArchiveFilterModel[] => {
  const totalCount = categories.reduce((total, category) => total + category.count, 0);

  return [
    {
      label: allLabel,
      count: totalCount,
      href: routes.blogs,
      active: !activeCategorySlug,
    },
    ...categories.map((category) => ({
      label: category.label,
      count: category.count,
      href: routes.blogCategory(category.slug),
      active: category.slug === activeCategorySlug,
    })),
  ];
};

export const toTimelineItemModel = (
  project: TimelineProjectSource,
  options: { fallbackHref?: string; ctaLabel?: string } = {},
): TimelineItemModel => ({
  title: project.title,
  year: project.year,
  category: project.category,
  summary: project.summary,
  image: project.cover,
  href: project.href ?? options.fallbackHref ?? routes.projects,
  side: project.side,
  ctaLabel: options.ctaLabel ?? "View case study",
});

export const toArticleMetaItems = (
  post: ArticleMetaSource,
  labels: Partial<ArticleMetaLabels> = {},
): ArticleMetaModel[] => {
  const resolved = { ...DEFAULT_ARTICLE_META_LABELS, ...labels };

  return [
    { label: resolved.categoryLabel, value: post.category },
    { label: resolved.publishedLabel, value: post.dateLong },
    { label: resolved.readingTimeLabel, value: post.readingTime },
    { label: resolved.slugLabel, value: post.slug },
  ];
};
