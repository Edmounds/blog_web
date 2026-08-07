#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "jsonc-parser";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const wrangler = resolve(projectRoot, "node_modules/wrangler/bin/wrangler.js");
const failures = [];

process.chdir(projectRoot);

const authEnv = { ...process.env };
if (process.env.BLOG_CF_USE_ENV_TOKEN !== "1") {
  delete authEnv.CLOUDFLARE_API_TOKEN;
  delete authEnv.CLOUDFLARE_ACCOUNT_ID;
}

const configs = [
  "wrangler.astro.jsonc",
  "wrangler.art-cover-fetcher.jsonc",
  "wrangler.preferred-proxy.jsonc",
  "wrangler.smoke.jsonc",
].map((file) => ({ file, config: parse(readFileSync(file, "utf8")) }));

console.log("Cloudflare inventory");
for (const { file, config } of configs) {
  const role = config.name === "new-blog-smoke" ? "local only" : "production";
  console.log(`- ${config.name}: ${file} (${role})`);
}

function execute(args) {
  return spawnSync(process.execPath, [wrangler, ...args], {
    cwd: projectRoot,
    env: authEnv,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

function check(label, args, { retries = 0, showOutput = false } = {}) {
  let result = execute(args);
  for (let attempt = 0; result.status !== 0 && attempt < retries; attempt += 1) {
    console.warn(`[WARN] ${label} failed; retrying (${attempt + 1}/${retries}).`);
    result = execute(args);
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.status === 0) {
    console.log(`[PASS] ${label}`);
    if (showOutput && output) console.log(output);
    return output;
  }

  failures.push(label);
  console.error(`[FAIL] ${label}`);
  if (output) console.error(output);
  return output;
}

check("Wrangler is available", ["--version"]);
check("Cloudflare authentication", ["whoami"], { retries: 2 });

for (const config of [
  "wrangler.astro.jsonc",
  "wrangler.art-cover-fetcher.jsonc",
  "wrangler.preferred-proxy.jsonc",
]) {
  check(`Deployment exists: ${config}`, ["deployments", "status", "--config", config, "--json"], { retries: 2 });
}

check("D1 remote read", [
  "d1",
  "execute",
  "blog_web",
  "--remote",
  "--command",
  "SELECT 1 AS ok, COUNT(*) AS table_count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%';",
], { retries: 2, showOutput: true });

check("R2 bucket metadata", ["r2", "bucket", "info", "blog-images"], { retries: 2, showOutput: true });
check("R2 custom domain", ["r2", "bucket", "domain", "list", "blog-images"], { retries: 2, showOutput: true });
check("R2 development URL state", ["r2", "bucket", "dev-url", "get", "blog-images"], { retries: 2 });

const secretOutput = check("Worker secret inventory", [
  "secret",
  "list",
  "--config",
  "wrangler.astro.jsonc",
  "--name",
  "new-blog-ssr",
  "--format",
  "json",
], { retries: 2 });
try {
  const secrets = JSON.parse(secretOutput);
  console.log(`- ${secrets.length} secret names found; values were not requested.`);
} catch {
  if (secretOutput) console.warn("[WARN] Secret output was not JSON; inspect the Wrangler output above.");
}

if (existsSync("dist/server/wrangler.json")) {
  check("Main Astro artifact dry-run", ["deploy", "--dry-run", "--config", "dist/server/wrangler.json"]);
} else {
  console.warn("[WARN] Main Astro artifact is absent; run npm run build before deployment readiness checks.");
}
check("Cover fetcher dry-run", ["deploy", "--dry-run", "--config", "wrangler.art-cover-fetcher.jsonc"]);
check("Preferred proxy dry-run", ["deploy", "--dry-run", "--config", "wrangler.preferred-proxy.jsonc"]);

const manifest = JSON.parse(readFileSync(".blog-images-manifest.json", "utf8"));
const sampleUrl = Object.values(manifest.assets ?? {})[0]?.sources?.webp?.[0]?.url;
if (sampleUrl) {
  try {
    const response = await fetch(sampleUrl, { method: "HEAD", signal: AbortSignal.timeout(20_000) });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.startsWith("image/")) throw new Error(`HTTP ${response.status}, ${contentType || "no content type"}`);
    console.log(`[PASS] R2 representative object: ${response.status} ${contentType}`);
  } catch (error) {
    failures.push("R2 representative object");
    console.error(`[FAIL] R2 representative object: ${error.message}`);
  }
}

try {
  const response = await fetch("https://blog.muelsyse.us/", { method: "HEAD", signal: AbortSignal.timeout(20_000) });
  if (response.ok) {
    console.log(`[PASS] Production edge: HTTP ${response.status}`);
  } else if (response.headers.get("cf-mitigated") === "challenge") {
    console.warn("[WARN] Production edge returned a managed challenge; verify the homepage in a real browser.");
  } else {
    failures.push("Production edge");
    console.error(`[FAIL] Production edge: HTTP ${response.status}`);
  }
} catch (error) {
  failures.push("Production edge");
  console.error(`[FAIL] Production edge: ${error.message}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("\nAll non-browser Cloudflare checks passed.");
}
