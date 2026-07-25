export interface FooterLink {
  label: string;
  href: string;
}

export interface ArchivePostSummaryModel {
  title: string;
  summary: string;
  href: string;
  dateLabel: string;
  dateIso: string;
  readingTime: string;
  tags: string[];
}

export interface ArchivePostSectionModel {
  year: number;
  posts: ArchivePostSummaryModel[];
}
