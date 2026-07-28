import type { APIRoute } from "astro";

import { onRequestPost } from "../../../../server/api/admin/art/translate.js";
import { getRuntimeEnv } from "../../../../lib/runtime";

export const POST: APIRoute = ({ request }) => onRequestPost({ env: getRuntimeEnv(), request });
