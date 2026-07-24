import { spawn } from "node:child_process";

import { syncBlogImages } from "./lib/blog-images.mjs";

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

const deleteWithWrangler = ({ bucket, key }) => new Promise((resolve, reject) => {
  const child = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["wrangler", "r2", "object", "delete", `${bucket}/${key}`, "--remote"],
    { stdio: "inherit" },
  );

  child.on("error", reject);
  child.on("exit", (code, signal) => {
    if (code === 0) resolve();
    else reject(new Error(`Wrangler delete failed for ${key}${signal ? ` (${signal})` : ` (exit ${code})`}`));
  });
});

try {
  const result = await syncBlogImages({ upload: runWrangler, deleteObject: deleteWithWrangler });
  console.log(
    `Blog images ready: scanned ${result.scannedFiles} article(s), uploaded ${result.uploaded}, deleted ${result.deleted}, rewrote ${result.rewrittenFiles}.`,
  );
} catch (error) {
  console.error(`Blog image sync failed: ${error.message}`);
  process.exitCode = 1;
}
