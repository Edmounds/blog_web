import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { parseArgs, parseEnv } from "node:util";

const DEFAULT_ENV_FILE = ".env";
const DEFAULT_CONFIG = "wrangler.astro.jsonc";
const DEFAULT_WORKER = "new-blog-ssr";

const { values } = parseArgs({
  options: {
    "env-file": { type: "string", default: DEFAULT_ENV_FILE },
    config: { type: "string", default: DEFAULT_CONFIG },
    worker: { type: "string", default: DEFAULT_WORKER },
  },
  strict: true,
});

const envSource = await readFile(values["env-file"], "utf8");
const secrets = parseEnv(envSource);
const secretNames = Object.keys(secrets).sort();

if (secretNames.length === 0) {
  throw new Error(`${values["env-file"]} does not contain any environment variables.`);
}

const wrangler = spawn(
  process.execPath,
  [
    "./node_modules/wrangler/bin/wrangler.js",
    "secret",
    "bulk",
    "--config",
    values.config,
    "--name",
    values.worker,
  ],
  {
    env: {
      ...process.env,
      CLOUDFLARE_API_TOKEN: undefined,
      CLOUDFLARE_ACCOUNT_ID: undefined,
    },
    stdio: ["pipe", "inherit", "inherit"],
  },
);

wrangler.stdin.end(JSON.stringify(secrets));

const exitCode = await new Promise((resolve, reject) => {
  wrangler.once("error", reject);
  wrangler.once("close", resolve);
});

if (exitCode !== 0) {
  process.exitCode = typeof exitCode === "number" ? exitCode : 1;
} else {
  console.log(`Synced ${secretNames.length} secrets to ${values.worker}: ${secretNames.join(", ")}`);
}
