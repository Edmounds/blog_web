export const routes = {
  home: "/",
  blogs: "/blogs/",
  blogCategory: (slug: string) => `/blogs/category/${slug}/`,
  series: "/series/",
  seriesDetail: (slug: string) => `/series/${slug}/`,
  projects: "/projects/",
  projectCategory: (slug: string) => `/projects/category/${slug}/`,
  project: (slug: string) => `/projects/${slug}/`,
  about: "/about/",
};
