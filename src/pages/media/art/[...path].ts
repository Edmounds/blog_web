import type { APIRoute } from "astro";

import { onRequestGet } from "../../../server/api/media-art.js";
import { getRuntimeEnv } from "../../../lib/runtime";

export const GET: APIRoute = ({ params, request }) => onRequestGet({ env: getRuntimeEnv(), params, request });
