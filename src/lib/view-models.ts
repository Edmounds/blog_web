import { defaultLocale, localizePath, type Locale } from "./i18n";
import type { ArchivePostSectionModel, ContentCardModel } from "../types/ui";

interface ContentCardSource {
  slug: string;
  title: string;
  summary: string;
  cover: string;
  category: string;
  dateLabel: string;
  readingTime: string;
  archiveTags?: string[];
}

interface ContentCardCopy {
  publishedLabel: string;
  readLabel: string;
  readArticleLabel: string;
}

interface ArchiveSectionSource {
  year: number;
  posts: ContentCardSource[];
}

const DEFAULT_CARD_COPY: ContentCardCopy = {
  publishedLabel: "Published",
  readLabel: "Read",
  readArticleLabel: "Read article",
};

export const toContentCardModel = (
  post: ContentCardSource,
  copy: ContentCardCopy = DEFAULT_CARD_COPY,
  locale: Locale = defaultLocale,
  section = "blog",
): ContentCardModel => ({
  title: post.title,
  summary: post.summary,
  href: localizePath(`/${section}/${post.slug}/`, locale),
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
  sections: ArchiveSectionSource[],
  copy: ContentCardCopy = DEFAULT_CARD_COPY,
  locale: Locale = defaultLocale,
  contentSection = "blog",
): ArchivePostSectionModel[] => sections.map((group) => ({
  year: group.year,
  cards: group.posts.map((post) => toContentCardModel(post, copy, locale, contentSection)),
  posts: group.posts.map((post) => ({
    title: post.title,
    summary: post.summary,
    href: localizePath(`/${contentSection}/${post.slug}/`, locale),
    category: post.category,
    dateLabel: post.dateLabel,
    readingTime: post.readingTime,
    tags: post.archiveTags,
  })),
}));
