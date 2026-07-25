import { spawn } from "node:child_process";

const wrangler = process.platform === "win32" ? "npx.cmd" : "npx";

const runWrangler = (args, errorMessage, stdio = "inherit") => new Promise((resolve, reject) => {
  const child = spawn(wrangler, ["wrangler", ...args], { stdio });
  let stderr = "";
  let stdout = "";
  if (child.stdout) child.stdout.on("data", (chunk) => { stdout += chunk; });
  if (child.stderr) child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", reject);
  child.on("exit", (code, signal) => {
    if (code === 0) resolve({ stdout, stderr });
    else reject(new Error(`${errorMessage}${signal ? ` (${signal})` : ` (exit ${code})`}${stderr ? `: ${stderr.trim()}` : ""}`));
  });
});

export const uploadWithWrangler = ({ bucket, key, filePath, contentType, cacheControl }) => runWrangler(
  ["r2", "object", "put", `${bucket}/${key}`, "--remote", "--file", filePath, "--content-type", contentType, "--cache-control", cacheControl],
  `Wrangler upload failed for ${filePath}`,
);

export const deleteWithWrangler = ({ bucket, key }) => runWrangler(
  ["r2", "object", "delete", `${bucket}/${key}`, "--remote"],
  `Wrangler delete failed for ${key}`,
);

export const downloadWithWrangler = ({ bucket, key, filePath }) => runWrangler(
  ["r2", "object", "get", `${bucket}/${key}`, "--remote", "--file", filePath],
  `Wrangler download failed for ${key}`,
);

export const verifyDeletedWithWrangler = async ({ bucket, key }) => {
  try {
    await runWrangler(
      ["r2", "object", "get", `${bucket}/${key}`, "--remote", "--file", process.platform === "win32" ? "NUL" : "/dev/null"],
      `Wrangler still found ${key}`,
      ["ignore", "ignore", "pipe"],
    );
  } catch (error) {
    if (/not found|does not exist|10007|no such object/i.test(error.message)) return;
    throw error;
  }
  throw new Error(`${key} still exists in R2 after deletion`);
};

export const inspectWithWrangler = ({ bucket, key }) => runWrangler(
  ["r2", "object", "get", `${bucket}/${key}`, "--remote", "--file", process.platform === "win32" ? "NUL" : "/dev/null"],
  `Wrangler inspection failed for ${key}`,
  ["ignore", "pipe", "pipe"],
);
