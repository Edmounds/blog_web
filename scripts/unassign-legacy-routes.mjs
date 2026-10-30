const zoneId = "3c5030120b1db7ca31dbd5db80e03f3e";
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!token) {
  console.log("[unassign] No CLOUDFLARE_API_TOKEN in environment; skipping legacy route cleanup.");
  process.exit(0);
}

try {
  console.log(`[unassign] Fetching worker routes for zone ${zoneId}...`);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (response.ok) {
    const payload = await response.json();
    const routes = payload.result ?? [];
    console.log(`[unassign] Found ${routes.length} route(s) on zone ${zoneId}.`);

    for (const route of routes) {
      console.log(`[unassign] Route: id=${route.id}, pattern=${route.pattern}, script=${route.script}`);
      if (route.pattern?.includes("blog.muelsyse.us") && route.script !== "muelsyse-blog") {
        console.log(`[unassign] Deleting legacy route ${route.id} (${route.pattern} -> ${route.script})...`);
        const delRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes/${route.id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const delText = await delRes.text().catch(() => "");
        console.log(`[unassign] Delete route ${route.id} result: HTTP ${delRes.status} -> ${delText}`);
      }
    }
  } else {
    const errText = await response.text().catch(() => "");
    console.warn(`[unassign] List routes returned HTTP ${response.status}: ${errText}`);
  }
} catch (error) {
  console.warn("[unassign] Legacy route cleanup error:", error);
}
