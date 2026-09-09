export type SearchSection = "blog" | "project" | "note";

export interface SearchIndexItem {
  id: string;
  type: SearchSection;
  title: string;
  description: string;
  tags: string[];
  url: string;
  date: string;
}

export interface SearchMatch {
  item: SearchIndexItem;
  score: number;
}

/**
 * Pure search matching and ranking function.
 * Matches all search tokens against item title, tags, and description.
 * Returns items sorted by relevance score descending.
 */
export function searchContent(
  items: readonly SearchIndexItem[],
  query: string,
  limit = 8,
): SearchIndexItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  // Split query into terms on whitespace
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const results: SearchMatch[] = [];

  for (const item of items) {
    const titleLower = item.title.toLowerCase();
    const descLower = item.description.toLowerCase();
    const tagsLower = item.tags.map((t) => t.toLowerCase());

    let matchAll = true;
    let score = 0;

    for (const term of terms) {
      const inTitle = titleLower.includes(term);
      const inTags = tagsLower.some((t) => t.includes(term));
      const inDesc = descLower.includes(term);

      if (!inTitle && !inTags && !inDesc) {
        matchAll = false;
        break;
      }

      // Title matches have the highest weight
      if (inTitle) {
        if (titleLower === term) {
          score += 100;
        } else if (titleLower.startsWith(term)) {
          score += 50;
        } else {
          score += 30;
        }
      }

      // Tag matches have medium weight
      if (inTags) {
        if (tagsLower.includes(term)) {
          score += 25;
        } else {
          score += 15;
        }
      }

      // Description matches have lower weight
      if (inDesc) {
        score += 5;
      }
    }

    if (matchAll && score > 0) {
      results.push({ item, score });
    }
  }

  // Sort by score descending; if tied, sort by date descending (newest first)
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.item.date.localeCompare(a.item.date);
  });

  return results.slice(0, limit).map((r) => r.item);
}
