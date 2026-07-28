import type { APIRoute } from "astro";

import { onRequestPost } from "../../../../server/api/admin/games/sync.js";
import { getRuntimeEnv } from "../../../../lib/runtime";

export const POST: APIRoute = ({ request }) => onRequestPost({ env: getRuntimeEnv(), request });
