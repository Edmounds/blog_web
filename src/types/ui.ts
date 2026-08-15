export interface FooterLink {
  label: string;
  href: string;
}

export interface ArchivePostSummaryModel {
  title: string;
  href: string;
  dateLabel: string;
  dateIso: string;
  tags: string[];
}

export interface ArchivePostSectionModel {
  year: number;
  posts: ArchivePostSummaryModel[];
}
