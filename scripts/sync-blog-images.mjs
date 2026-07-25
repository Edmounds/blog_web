import { syncBlogImages } from "./lib/blog-images.mjs";
import { uploadWithWrangler } from "./lib/wrangler-r2.mjs";

try {
  const result = await syncBlogImages({ upload: uploadWithWrangler });
  console.log(
    `Blog images ready: scanned ${result.scannedFiles} article(s), uploaded ${result.uploaded}, `
    + `rewrote ${result.rewrittenFiles}, pending cleanup ${result.pendingDeletion}.`,
  );
} catch (error) {
  console.error(`Blog image sync failed: ${error.message}`);
  process.exitCode = 1;
}
