import { migrateBlogImages } from "./lib/blog-images.mjs";
import { downloadWithWrangler, uploadWithWrangler } from "./lib/wrangler-r2.mjs";

try {
  const result = await migrateBlogImages({
    download: downloadWithWrangler,
    upload: uploadWithWrangler,
  });
  console.log(
    `Blog image migration ready: migrated ${result.migrated}, uploaded ${result.uploaded}, `
    + `rewrote ${result.rewrittenFiles}, pending cleanup ${result.pendingDeletion}.`,
  );
} catch (error) {
  console.error(`Blog image migration failed: ${error.message}`);
  process.exitCode = 1;
}
