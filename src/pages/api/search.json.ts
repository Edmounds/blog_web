import type { APIRoute } from "astro";

import { getAllPublishedContent } from "../../lib/content";
import { defaultLocale, isLocale, localizePath, type Locale } from "../../lib/i18n";
import { jsonResponse, errorResponse } from "../../lib/engagement";
import type { SearchIndexItem } from "../../lib/search";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const rawLocale = url.searchParams.get("locale") ?? defaultLocale;
    const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

    const contents = await getAllPublishedContent(locale);
    const items: SearchIndexItem[] = contents
      .filter((c) => c.section === "blog" || c.section === "project" || c.section === "note")
      .map((c) => ({
        id: c.contentId,
        type: c.section,
        title: c.title,
        description: c.description || "",
        tags: c.tags || [],
        url: localizePath(`/${c.section}/${c.slug}/`, locale),
        date:
          c.createdAt instanceof Date
            ? c.createdAt.toISOString().slice(0, 10)
            : String(c.createdAt).slice(0, 10),
      }));

    return jsonResponse(
      { items },
      {
        headers: {
          "cache-control":
            "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch (err) {
    if (err instanceof Response) return err;
    return errorResponse(
      500,
      "SEARCH_INDEX_FAILED",
      "Failed to load search index.",
    );
  }
};
