import { routes } from "./routes";
import { defaultLocale, localizePath, type Locale } from "./i18n";
import type {
  ArchivePostSectionModel,
  ArticleMetaModel,
  ContentCardModel,
  SeriesSummaryModel,
} from "../types/ui";

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

interface ArchiveBlogSectionSource {
  year: number;
  posts: BlogCardSource[];
}

interface SeriesSummarySource {
  title: string;
  slug: string;
  count: number;
}

interface ArticleMetaSource {
  category: string;
  dateLong: string;
  readingTime: string;
}

interface ArticleMetaLabels {
  categoryLabel: string;
  publishedLabel: string;
  readingTimeLabel: string;
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
};

export const toBlogCardModel = (
  post: BlogCardSource,
  copy: BlogCardCopy = DEFAULT_BLOG_CARD_COPY,
  locale: Locale = defaultLocale,
): ContentCardModel => ({
  title: post.title,
  summary: post.summary,
  href: localizePath(`/blog/${post.slug}/`, locale),
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

export const toArchivePostSections = (
  sections: ArchiveBlogSectionSource[],
  copy: BlogCardCopy = DEFAULT_BLOG_CARD_COPY,
  locale: Locale = defaultLocale,
): ArchivePostSectionModel[] =>
  sections.map((section) => ({
    year: section.year,
    cards: section.posts.map((post) => toBlogCardModel(post, copy, locale)),
    posts: section.posts.map((post) => ({
      title: post.title,
      summary: post.summary,
      href: localizePath(`/blog/${post.slug}/`, locale),
      category: post.category,
      dateLabel: post.dateLabel,
      readingTime: post.readingTime,
      tags: post.archiveTags,
    })),
  }));

export const toSeriesSummaryModel = (series: SeriesSummarySource): SeriesSummaryModel => ({
  title: series.title,
  href: routes.seriesDetail(series.slug),
  count: series.count,
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
  ];
};
