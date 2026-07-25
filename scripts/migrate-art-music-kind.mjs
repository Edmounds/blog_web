import { spawn } from "node:child_process";

const remote = process.argv.includes("--remote");
const target = remote ? "blog_web" : "DB";
const location = remote ? "--remote" : "--local";

const columns = await wrangler(["d1", "execute", target, location, "--command", "PRAGMA table_info(art_items);", "--json"]);
const payload = JSON.parse(columns);
const rows = payload.flatMap((entry) => entry.results ?? []);

if (!rows.some((column) => column.name === "music_kind")) {
  await wrangler(["d1", "execute", target, location, "--command", "ALTER TABLE art_items ADD COLUMN music_kind TEXT CHECK (music_kind IN ('album', 'single'));", "--json"]);
}

await wrangler(["d1", "execute", target, location, "--command", "UPDATE art_items SET music_kind = 'album' WHERE type = 'music' AND music_kind IS NULL;", "--json"]);
console.log(`Music classification migrated in ${remote ? "remote" : "local"} D1.`);

function wrangler(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["wrangler", ...args], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code, signal) => code === 0 && !signal ? resolve(stdout) : reject(new Error(stderr || `wrangler exited with ${code ?? signal}`)));
  });
}
