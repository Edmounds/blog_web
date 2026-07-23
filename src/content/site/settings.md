---
brand: chasen
htmlLang: zh-CN
dateLocale: en-US
seo:
  defaultDescription: Personal blog and projects.
  titleSeparator: " | "
nav:
  - label: Home
    href: /
    match: exact
  - label: Content
    href: /blogs/
    match: prefix
    children:
      - label: Blog
        href: /blogs/
        match: prefix
      - label: Projects
        href: /projects/
        match: prefix
  - label: Art
    href: /art/music/
    match: prefix
    children:
      - label: Music
        href: /art/music/
        match: prefix
      - label: Book
        href: /art/book/
        match: prefix
      - label: Movie
        href: /art/movie/
        match: prefix
  - label: About
    href: /about/
    match: prefix
footerLinks:
  - label: Blogs
    href: /blogs/
  - label: Projects
    href: /projects/
  - label: About
    href: /about/
copy:
  archiveAllCategories: All Categories
  archiveSidebarTitle: Filter
  blogMetaPublished: Published
  blogMetaRead: Read
  blogReadArticle: Read article
  blogNextArticle: Next article
  blogReadNext: Read next
  timelineViewCaseStudy: View case study
  homeRecentBlogsTitle: Recent Blogs
  homeRecentBlogsCta: View all blogs
  homeRecentProjectsTitle: Recent Projects
  homeRecentProjectsCta: View all projects
  seriesTitle: Series
  seriesDescription: Themed paths through related essays and notes.
  seriesAllPostsCta: View series
---
