import { defaultLocale, localizePath, type Locale } from "./i18n";
import type { ArchivePostSectionModel } from "../types/ui";

interface ContentListSource {
  slug: string;
  title: string;
  summary: string;
  dateLabel: string;
  readingTime: string;
  archiveTags: string[];
}

interface ArchiveSectionSource {
  year: number;
  posts: ContentListSource[];
}

export const toArchivePostSections = (
  sections: ArchiveSectionSource[],
  locale: Locale = defaultLocale,
  contentSection = "blog",
): ArchivePostSectionModel[] => sections.map((group) => ({
  year: group.year,
  posts: group.posts.map((post) => ({
    title: post.title,
    summary: post.summary,
    href: localizePath(`/${contentSection}/${post.slug}/`, locale),
    dateLabel: post.dateLabel,
    readingTime: post.readingTime,
    tags: post.archiveTags,
  })),
}));
