import type { APIRoute, GetStaticPaths } from "astro";
import { createRssResponse } from "../../lib/rss";
import { defaultLocale, localeDefinitions, type Locale } from "../../lib/i18n";

export const prerender = true;
export const getStaticPaths: GetStaticPaths = () => localeDefinitions
  .filter((item) => item.code !== defaultLocale)
  .map((item) => ({ params: { locale: item.path }, props: { locale: item.code } }));

export const GET: APIRoute = ({ props }) => createRssResponse(props.locale as Locale);
