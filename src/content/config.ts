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

const projects = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    year: z.number(),
    category: z.string(),
    cover: z.string().min(1),
    showOnHome: z.boolean(),
    showInTimeline: z.boolean(),
    order: z.number(),
    type: z.string().optional(),
    cta: z.string().optional(),
    side: z.enum(["left", "right"]).optional(),
    href: z.string().url().optional(),
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
      archiveAllCategories: z.string(),
      archiveSidebarTitle: z.string(),
      blogMetaPublished: z.string(),
      blogMetaRead: z.string(),
      blogReadArticle: z.string(),
      blogNextArticle: z.string(),
      blogReadNext: z.string(),
      timelineViewCaseStudy: z.string(),
      homeRecentBlogsTitle: z.string(),
      homeRecentBlogsCta: z.string(),
      homeRecentProjectsTitle: z.string(),
      homeRecentProjectsCta: z.string(),
      seriesTitle: z.string(),
      seriesDescription: z.string(),
      seriesAllPostsCta: z.string(),
    }),
  }),
});

export const collections = { blog, projects, about, site };
