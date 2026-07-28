import type { APIRoute } from "astro";

import { onRequestDelete, onRequestPatch } from "../../../../server/api/admin/games/[id].js";
import { getRuntimeEnv } from "../../../../lib/runtime";

export const PATCH: APIRoute = ({ params, request }) => onRequestPatch({ env: getRuntimeEnv(), params, request });
export const DELETE: APIRoute = ({ params, request }) => onRequestDelete({ env: getRuntimeEnv(), params, request });
