import type { APIRoute } from "astro";

import { onRequestDelete, onRequestPost } from "../../../../server/api/admin/games/covers.js";
import { getRuntimeEnv } from "../../../../lib/runtime";

export const POST: APIRoute = ({ request }) => onRequestPost({ env: getRuntimeEnv(), request });
export const DELETE: APIRoute = ({ request }) => onRequestDelete({ env: getRuntimeEnv(), request });
