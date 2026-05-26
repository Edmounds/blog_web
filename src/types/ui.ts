export interface NavItem {
  label: string;
  href: string;
  match?: "exact" | "prefix";
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface SectionCta {
  label: string;
  href: string;
}

export interface CardMeta {
  label: string;
  value: string;
}

export type CardVariant = "blog" | "project";

export interface ContentCardModel {
  variant: CardVariant;
  title: string;
  summary: string;
  href: string;
  image: string;
  imageAlt?: string;
  eyebrow?: string;
  meta?: CardMeta[];
  tags?: string[];
  footerText?: string;
}

export interface ArchiveFilterModel {
  label: string;
  count: number;
  href: string;
  active: boolean;
}

export interface ArchivePostSummaryModel {
  title: string;
  summary: string;
  href: string;
  category: string;
  dateLabel: string;
  readingTime: string;
  tags?: string[];
}

export interface ArchivePostSectionModel {
  year: number;
  cards: ContentCardModel[];
  posts: ArchivePostSummaryModel[];
}

export interface ArchiveViewCopy {
  emptyLabel: string;
  searchPlaceholder: string;
  countLabel: string;
  listTitleLabel: string;
  listCategoryLabel: string;
  listReadingLabel: string;
  listDateLabel: string;
}

export interface SeriesSummaryModel {
  title: string;
  href: string;
  count: number;
}

export interface TimelineItemModel {
  title: string;
  year: string;
  category: string;
  summary: string;
  image: string;
  href: string;
  side: "left" | "right";
  ctaLabel: string;
}

export interface ArticleMetaModel {
  label: string;
  value: string;
}

export interface AboutMetaItem {
  label: string;
  value: string;
}

export interface AboutFocusCard {
  title: string;
  icon: string;
  text: string;
}

export interface ExperienceItem {
  years: string;
  role: string;
  company: string;
  text: string;
}
