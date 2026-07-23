import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    publishedAt: z.coerce.date(),
    cover: z.string().min(1),
    readingTime: z.string(),
    category: z.string(),
    showOnHome: z.boolean(),
    showInArchive: z.boolean(),
    order: z.number(),
    draft: z.boolean().default(false),
    archiveYear: z.number().optional(),
    archiveTags: z.array(z.string()).optional(),
    archiveExcerpt: z.string().optional(),
    series: z
      .object({
        title: z.string(),
        slug: z.string(),
        order: z.number().optional(),
      })
      .optional(),
    tags: z.array(z.string()).default([]),
  }),
});

const about = defineCollection({
  type: "content",
  schema: z.object({
    brand: z.string(),
    titleLeading: z.string(),
    titleName: z.string(),
    subtitle: z.string(),
    portrait: z.string().min(1),
    meta: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    ),
    story: z.array(z.string()),
    focusCards: z.array(
      z.object({
        title: z.string(),
        icon: z.string(),
        text: z.string(),
      }),
    ),
    experience: z.array(
      z.object({
        years: z.string(),
        role: z.string(),
        company: z.string(),
        text: z.string(),
      }),
    ),
    availability: z.string(),
    homeFeatured: z.object({
      badge: z.string(),
      title: z.string(),
      name: z.string(),
      description: z.string(),
      location: z.string(),
    }),
  }),
});

const translations = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string().optional(),
    summary: z.string().optional(),
    publishedAt: z.coerce.date().optional(),
    cover: z.string().optional(),
    readingTime: z.string().optional(),
    category: z.string().optional(),
    showOnHome: z.boolean().optional(),
    showInArchive: z.boolean().optional(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
    archiveYear: z.number().optional(),
    archiveTags: z.array(z.string()).optional(),
    archiveExcerpt: z.string().optional(),
    series: z.object({ title: z.string(), slug: z.string(), order: z.number().optional() }).optional(),
    tags: z.array(z.string()).optional(),
    brand: z.string().optional(),
    titleLeading: z.string().optional(),
    titleName: z.string().optional(),
    subtitle: z.string().optional(),
    portrait: z.string().optional(),
    meta: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    story: z.array(z.string()).optional(),
    focusCards: z.array(z.object({ title: z.string(), icon: z.string(), text: z.string() })).optional(),
    experience: z.array(z.object({ years: z.string(), role: z.string(), company: z.string(), text: z.string() })).optional(),
    availability: z.string().optional(),
    homeFeatured: z.object({ badge: z.string(), title: z.string(), name: z.string(), description: z.string(), location: z.string() }).optional(),
  }).passthrough(),
});

const site = defineCollection({
  type: "content",
  schema: z.object({
    brand: z.string(),
    htmlLang: z.string(),
    dateLocale: z.string(),
    seo: z.object({
      defaultDescription: z.string(),
      titleSeparator: z.string(),
    }),
    nav: z.array(
      z.object({
        label: z.string(),
        href: z.string(),
        match: z.enum(["exact", "prefix"]).optional(),
        children: z.array(
          z.object({
            label: z.string(),
            href: z.string(),
            match: z.enum(["exact", "prefix"]).optional(),
          })
        ).optional(),
      }),
    ),
    footerLinks: z.array(
      z.object({
        label: z.string(),
        href: z.string(),
      }),
    ),
    copy: z.object({
      blogMetaPublished: z.string(),
      blogMetaRead: z.string(),
      blogReadArticle: z.string(),
      blogNextArticle: z.string(),
      blogReadNext: z.string(),
      homeRecentBlogsTitle: z.string(),
      homeRecentBlogsCta: z.string(),
      seriesTitle: z.string(),
      seriesDescription: z.string(),
      seriesAllPostsCta: z.string(),
    }),
  }),
});

export const collections = { blog, about, site, translations };
