import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const contentSchema = z.object({
  title: z.string(),
  description: z.string().default(""),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  published: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});

const blog = defineCollection({ loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }), schema: contentSchema });
const note = defineCollection({ loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/note" }), schema: contentSchema });
const project = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/project" }),
  schema: contentSchema.extend({ projectUrl: z.url().optional(), docUrl: z.url().optional() }),
});
const about = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/about" }),
  schema: z.object({
    name: z.string(),
    city: z.string(),
    major: z.string(),
    motto: z.string(),
    portrait: z.string().min(1),
  }),
});
const translations = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/translations" }),
  schema: z.looseObject({
    title: z.string().optional(), description: z.string().optional(),
    createdAt: z.coerce.date().optional(), updatedAt: z.coerce.date().optional(), published: z.boolean().optional(),
    tags: z.array(z.string()).optional(), projectUrl: z.string().optional(), docUrl: z.string().optional(),
    name: z.string().optional(), city: z.string().optional(), major: z.string().optional(), motto: z.string().optional(), portrait: z.string().optional(),
  }),
});
const site = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/site" }),
  schema: z.object({
    brand: z.string(), htmlLang: z.string(), dateLocale: z.string(), seo: z.object({ defaultDescription: z.string(), titleSeparator: z.string() }),
    nav: z.array(z.object({ label: z.string(), href: z.string(), match: z.enum(["exact", "prefix"]).optional(), children: z.array(z.object({ label: z.string(), href: z.string(), match: z.enum(["exact", "prefix"]).optional() })).optional() })),
    footerLinks: z.array(z.object({ label: z.string(), href: z.string() })), copy: z.record(z.string(), z.string()),
  }),
});

export const collections = { blog, note, project, about, site, translations };
