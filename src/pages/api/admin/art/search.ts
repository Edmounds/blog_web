import type { APIRoute } from "astro";

import { onRequestGet } from "../../../../server/api/admin/art/search.js";
import { getRuntimeEnv } from "../../../../lib/runtime";

export const GET: APIRoute = ({ request }) => onRequestGet({
  env: getRuntimeEnv(),
  request,
  cache: (caches as CacheStorage & { default?: Cache }).default,
});
