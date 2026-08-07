import type { APIRoute } from "astro";

import { getRuntimeEnv } from "../../../../lib/runtime";
import { onRequestGet } from "../../../../server/api/art/douban-cover.js";

export const GET: APIRoute = ({ params }) => onRequestGet({ env: getRuntimeEnv(), params });
