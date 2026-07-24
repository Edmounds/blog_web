import type { APIRoute } from "astro";

export const ALL: APIRoute = () =>
  Response.json(
    { error: { code: "NOT_FOUND", message: "Not found." } },
    { status: 404 },
  );
