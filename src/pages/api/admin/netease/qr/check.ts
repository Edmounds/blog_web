import type { APIRoute } from "astro";

import { getRuntimeEnv } from "../../../../../lib/runtime";
import { onRequestPost } from "../../../../../server/api/admin/netease/qr-check.js";

export const POST: APIRoute = ({ request }) => onRequestPost({ env: getRuntimeEnv(), request });
