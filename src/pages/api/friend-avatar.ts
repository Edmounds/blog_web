import type { APIRoute } from "astro";

import { onRequestGet } from "../../server/api/friend-avatar.js";
import { getRuntimeEnv } from "../../lib/runtime";

export const GET: APIRoute = ({ request }) => onRequestGet({ env: getRuntimeEnv(), request });
