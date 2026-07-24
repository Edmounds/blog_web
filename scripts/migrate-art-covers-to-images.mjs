import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REMOTE = process.argv.includes("--remote");
const DELETE_SOURCE = process.argv.includes("--delete-source");
const SOURCE_BUCKET = process.env.ART_COVERS_SOURCE_BUCKET ?? "blog-art-covers";
const TARGET_BUCKET = process.env.ART_COVERS_TARGET_BUCKET ?? "blog-images";
const DATABASE = process.env.ART_DATABASE ?? "blog_web";
const R2_FLAG = REMOTE ? "--remote" : "--local";
const D1_FLAG = REMOTE ? "--remote" : "--local";
const workdir = await mkdtemp(path.join(os.tmpdir(), "blog-art-cover-migrate-"));

try {
  const rows = await queryRows("SELECT DISTINCT cover_key FROM art_items ORDER BY cover_key;");
  const verified = [];
  for (let index = 0; index < rows.length; index += 1) {
    const key = rows[index].cover_key;
    if (!/^art\/[a-z0-9-]+\/[a-z0-9-]+\.(?:jpg|png|webp|avif|svg)$/i.test(key)) {
      throw new Error(`Refusing unexpected cover key: ${key}`);
    }
    const sourceFile = path.join(workdir, `source-${index}`);
    const targetFile = path.join(workdir, `target-${index}`);
    await objectGet(SOURCE_BUCKET, key, sourceFile);
    let targetMatches = false;
    try {
      await downloadTarget(key, targetFile);
      targetMatches = await sameHash(sourceFile, targetFile);
    } catch {}
    if (!targetMatches) {
      await wrangler(["r2", "object", "put", `${TARGET_BUCKET}/${key}`, "--file", sourceFile,
        "--content-type", contentType(key), "--cache-control", "public, max-age=31536000, immutable", R2_FLAG]);
      await downloadTarget(key, targetFile);
      if (!await sameHash(sourceFile, targetFile)) throw new Error(`Hash verification failed for ${key}`);
    }
    verified.push(key);
    console.log(`[verified ${verified.length}/${rows.length}] ${key}`);
  }

  if (DELETE_SOURCE) {
    for (const key of verified) {
      await wrangler(["r2", "object", "delete", `${SOURCE_BUCKET}/${key}`, R2_FLAG, "--force"]);
      console.log(`[deleted source] ${key}`);
    }
  }
  console.log(`Migration complete. Verified ${verified.length} cover objects${DELETE_SOURCE ? " and deleted their source copies" : ""}.`);
} finally {
  await rm(workdir, { recursive: true, force: true });
}

async function queryRows(sql) {
  const output = await wrangler(["d1", "execute", DATABASE, D1_FLAG, "--command", sql, "--json"], { capture: true });
  return JSON.parse(output)?.[0]?.results ?? [];
}

function objectGet(bucket, key, file) {
  return wrangler(["r2", "object", "get", `${bucket}/${key}`, "--file", file, R2_FLAG], { capture: true });
}

async function downloadTarget(key, file) {
  if (!REMOTE) return objectGet(TARGET_BUCKET, key, file);
  const url = new URL(`https://img.muelsyse.us/${key}`);
  url.searchParams.set("verify", crypto.randomUUID());
  const response = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`Target fetch failed for ${key}: ${response.status}`);
  await writeFile(file, new Uint8Array(await response.arrayBuffer()));
}

async function sameHash(first, second) {
  const [one, two] = await Promise.all([readFile(first), readFile(second)]);
  return createHash("sha256").update(one).digest("hex") === createHash("sha256").update(two).digest("hex");
}

function contentType(key) {
  return { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", svg: "image/svg+xml" }[key.split(".").pop().toLowerCase()];
}

function wrangler(args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["wrangler", ...args], { cwd: ROOT, stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"] });
    let stdout = ""; let stderr = "";
    if (capture) { child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; }); }
    child.on("error", reject);
    child.on("exit", (code, signal) => code === 0 && !signal ? resolve(stdout) : reject(new Error(stderr || `wrangler exited with ${code ?? signal}`)));
  });
}
