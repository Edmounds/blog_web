import type { APIRoute } from "astro";

import { onRequestGet, onRequestPost } from "../../../../../server/api/admin/art/items.js";
import { getRuntimeEnv } from "../../../../../lib/runtime";

export const GET: APIRoute = ({ request }) => onRequestGet({ env: getRuntimeEnv(), request });
export const POST: APIRoute = ({ request }) => onRequestPost({ env: getRuntimeEnv(), request });
