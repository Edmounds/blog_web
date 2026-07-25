import { cleanupBlogImages } from "./lib/blog-images.mjs";
import { deleteWithWrangler, verifyDeletedWithWrangler } from "./lib/wrangler-r2.mjs";

if (!process.argv.includes("--confirmed-production")) {
  console.error("Refusing cleanup without --confirmed-production after production verification.");
  process.exitCode = 1;
} else {
  try {
    const result = await cleanupBlogImages({
      deleteObject: deleteWithWrangler,
      verifyDeleted: verifyDeletedWithWrangler,
    });
    console.log(`Deleted and verified ${result.deleted} pending R2 image object(s).`);
  } catch (error) {
    console.error(`Blog image cleanup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
