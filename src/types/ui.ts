export interface FooterLink {
  label: string;
  href: string;
}

export interface CardMeta {
  label: string;
  value: string;
}

export interface ContentCardModel {
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
