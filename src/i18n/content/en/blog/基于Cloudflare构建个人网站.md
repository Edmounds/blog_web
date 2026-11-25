---
title: Build a Personal Website with Cloudflare
description: "Architecture of this site: two Workers, one SQL database, and one object storage bucket"
createdAt: 2026-08-13T00:00:00.000Z
updatedAt: 2026-08-13T00:00:00.000Z
published: true
tags:
  - Network
  - Website building
  - Optimization
slug: 20260813-02
---

## Quotation

My website runs on two Cloudflare Workers, one SQL database, and one object storage service. Comments, likes, and page views are all updated in real time. My book, music, and movie collection has its own admin dashboard, and my music-listening rankings sync automatically every day in the early hours. Apart from the domain, the rest of the bill is essentially zero.

This article introduces its structure. It is currently made up of`muelsyse-blog`directly holds the blog domain; the other`blog-art-cover-fetcher`Responsible for fetching cover images and making them available to the application through a service binding. The admin path is protected by Cloudflare Access, and scheduled synchronization tasks also run in the application Worker.

![The Blog’s Cloudflare Architecture](https://img.muelsyse.us/bed/paper-20261110-cloudflare-architecture-e308f5492721.png)

*Figure 1: The application Worker directly serves the blog domain, while the cover-fetching Worker is invoked via a service binding; D1, R2, and the static asset service each handle their respective storage and distribution responsibilities.*

## Single Request Flow

![Blog Request Processing Flow](https://img.muelsyse.us/bed/paper-20261110-cloudflare-request-34513a050cca.png)

*Figure 2: Requests are routed to static asset serving or application logic based on resource type. Pages and APIs that need data then access D1, R2, or external services as required by the business logic.*

## Database Design

D1 is Cloudflare’s managed SQLite database, used to store structured data such as comments, likes, view counts, and metadata for book, music, and movie collections.

R2 handles image hosting for article content and any image assets that need to be hosted. The main reason for choosing it is that outbound traffic is free—traffic charges are the biggest concern for an image host. Stable, directly accessible upstream cover images retain their original URLs instead of being duplicated in R2. Collection metadata is managed by D1; references to illustrations in the article body are stored in Markdown, while mappings for derived images are maintained in the build manifest.

## Image Pipeline

When I write articles in Obsidian, the image-hosting plugin uploads each image directly to R2 the moment I paste it, leaving an online URL in the Markdown. The article body references the original image via its URL, so large images don’t have to be added to the Git history every time I write.

During the build, the script generates AVIF and WebP variants for body images that need optimization, with target widths of 640 / 1280 / 1920 pixels, while avoiding upscaling based on the original image dimensions. The variants are uploaded to R2, and the mappings are written to the manifest. During rendering, the URL in the Markdown remains unchanged, but the output HTML is complete.`<picture>`: The browser selects the smallest adequate file based on the viewport and pixel density. The first image in the body is loaded at high priority, while the rest are lazy-loaded. The original image URL is retained as a fallback.

## Small Money-Saving Strategy

> If your site is a purely static blog, Astro with static asset hosting is sufficient; you don’t need to run any application Worker code.

If you need comments, an admin panel, or scheduled tasks, D1 combined with an SSR Worker is a relatively low-cost solution.

### Worker
Requests for static assets neither execute code nor count toward Workers’ 100,000 free requests per day. CSS, JavaScript, fonts, and local images all fall into this category—they’re free and unlimited. What actually consumes the 100,000-request daily allowance are requests that require the application Worker code to run, such as dynamic HTML rendering and API calls.

So I route as many requests as possible through the static layer. Only paths that require dynamic processing are configured to go through a Worker first. This keeps request usage largely within the free tier.

### D1
Pay attention to the number of rows read by D1. The free tier allows 5 million rows per day, but it counts rows scanned, not rows returned. A query that returns 20 comments could count tens of thousands of rows if it scans the entire table without using an index. Creating indexes on commonly filtered fields and paginating lists can help you make the most of D1’s free quota.

###  Be mindful of the free-tier limits.
The “zero cost” claim here needs a caveat: excluding the domain, the bill is approximately zero as long as traffic and data usage remain within the free tiers. The specific quotas are (July 2026):

| Project              | Free allowance                  |
| -------------------- | -------------------------------- |
| Workers dynamic requests | 100,000/day, shared across the account |
| Static asset requests | Free, unlimited                  |
| D1                   | 5 million row reads/day, 100,000 row writes/day |
| R2                   | 10 GB of storage, free egress   |

Note that 100,000 requests is the free daily limit for the entire account, not 100,000 per Worker. Full-table scans in D1 may quickly consume read quotas; whether charges are incurred also depends on the plan and usage. The quotas listed in the table reflect the information recorded at the time, so you should still verify the official pricing before enabling services or scaling up.

## Accelerated access in mainland China

Cloudflare’s default entry point is Anycast, with routing determined by BGP, which isn’t always ideal for China’s three major carriers. For the same site, China Telecom may be fast, while China Mobile may take a circuitous route and experience packet loss during the evening peak. My approach is to use an optimized CNAME: point the domain to a target domain that continuously measures performance and updates its DNS resolution results.

Once visitors reach the site, loading speed depends on layered caching, with the rules determined by how often the content changes:

- CSS / JS / fonts with content hashes: cache for one year
- HTML:`no-cache`, the cache must be revalidated before it can be reused
- Dynamic APIs such as comments and analytics: cache at the edge for 15 seconds; all write requests uniformly`no-store`.
- The GitHub contribution graph is cached for 6 hours, and WakaTime data is cached for 15 minutes.

## TL;DR

Serve static content directly wherever possible, put dynamic logic in the application Worker, and store structured data in D1 and article images in R2. First, clarify the routing and caching boundaries, then determine based on actual usage whether a paid plan is necessary.

## References

- [Workers Platform Limitations](https://developers.cloudflare.com/workers/platform/limits/)
- [Static Asset Billing Rules](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [MDN: Cache-Control](https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Cache-Control)