import type { APIRoute } from "astro";

import { getRuntimeEnv } from "../../../../lib/runtime";
import { onRequestGet } from "../../../../server/api/admin/netease/status.js";

export const GET: APIRoute = () => onRequestGet({ env: getRuntimeEnv() });
