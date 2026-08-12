import rss from "@astrojs/rss";

import { getAllPublishedContent } from "./content";
import { localizePath, type Locale } from "./i18n";

export async function createRssResponse(locale: Locale) {
  const items = await getAllPublishedContent(locale);
  return rss({
    title: "chasen",
    description: "Blog and notes by Chasen Chen.",
    site: "https://blog.muelsyse.us",
    items: items.map((item) => ({
      title: item.title,
      description: item.description,
      pubDate: item.createdAt,
      link: localizePath(`/${item.section}/${item.slug}/`, locale),
      categories: [item.section, ...item.tags],
    })),
    customData: `<language>${locale}</language>`,
  });
}
