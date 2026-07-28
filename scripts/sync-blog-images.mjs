import { migrateBlogImages, syncBlogImages } from "./lib/blog-images.mjs";
import { downloadWithWrangler, uploadWithWrangler } from "./lib/wrangler-r2.mjs";

try {
  const local = await syncBlogImages({ upload: uploadWithWrangler });
  const remote = await migrateBlogImages({
    download: downloadWithWrangler,
    upload: uploadWithWrangler,
  });
  console.log(
    `Blog images ready: scanned ${local.scannedFiles} article(s), processed ${remote.migrated} remote source(s), `
    + `uploaded ${local.uploaded + remote.uploaded}, rewrote ${local.rewrittenFiles}, `
    + `pending cleanup ${remote.pendingDeletion}.`,
  );
} catch (error) {
  console.error(`Blog image sync failed: ${error.message}`);
  process.exitCode = 1;
}
