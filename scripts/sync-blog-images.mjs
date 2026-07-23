import { spawn } from "node:child_process";

import { blogImageDefaults, syncBlogImages } from "./lib/blog-images.mjs";

const runWrangler = ({ bucket, key, filePath, contentType, cacheControl }) => new Promise((resolve, reject) => {
  const child = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "wrangler",
      "r2",
      "object",
      "put",
      `${bucket}/${key}`,
      "--remote",
      "--file",
      filePath,
      "--content-type",
      contentType,
      "--cache-control",
      cacheControl,
    ],
    { stdio: "inherit" },
  );

  child.on("error", reject);
  child.on("exit", (code, signal) => {
    if (code === 0) resolve();
    else reject(new Error(`Wrangler upload failed for ${filePath}${signal ? ` (${signal})` : ` (exit ${code})`}`));
  });
});

try {
  const result = await syncBlogImages({ upload: runWrangler });
  if (result.uploaded === 0) {
    console.log(`Blog images ready: scanned ${result.scannedFiles} article(s), no local images found.`);
  } else {
    console.log(
      `Blog images ready: uploaded ${result.uploaded} image(s) to ${blogImageDefaults.bucket} and rewrote ${result.rewrittenFiles} article(s).`,
    );
  }
} catch (error) {
  console.error(`Blog image sync failed: ${error.message}`);
  process.exitCode = 1;
}
