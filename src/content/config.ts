import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    publishedAt: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    cover: z.string().url(),
    readingTime: z.string(),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    year: z.number(),
    category: z.string(),
    cover: z.string().url(),
    href: z.string().url().optional(),
  }),
});

const about = defineCollection({
  type: "content",
  schema: z.object({
    name: z.string(),
    role: z.string(),
    location: z.string(),
    intro: z.string(),
    focus: z.array(z.string()),
    availability: z.string(),
  }),
});

export const collections = { blog, projects, about };
