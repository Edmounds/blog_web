import type { APIRoute } from "astro";

import { onRequestDelete, onRequestPost } from "../../../../../functions/api/admin/art/covers.js";
import { getRuntimeEnv } from "../../../../lib/runtime";

export const POST: APIRoute = ({ locals, request }) => onRequestPost({
  env: getRuntimeEnv(),
  request,
  waitUntil: locals.runtime?.ctx?.waitUntil.bind(locals.runtime.ctx),
});

export const DELETE: APIRoute = ({ request }) => onRequestDelete({ env: getRuntimeEnv(), request });
