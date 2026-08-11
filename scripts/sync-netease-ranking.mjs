import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";

import { fetchNeteaseRanking } from "../src/server/netease-music.js";

const { values } = parseArgs({
  options: {
    remote: { type: "boolean", default: false },
  },
  strict: true,
});

const musicU = process.env.NETEASE_MUSIC_U?.trim();
const csrf = process.env.NETEASE_CSRF?.trim();
if (!musicU || !csrf) throw new Error("NETEASE_MUSIC_U and NETEASE_CSRF are required.");

const env = { NETEASE_MUSIC_U: musicU, NETEASE_CSRF: csrf };
const results = await Promise.allSettled([
  fetchNeteaseRanking(env, "weekly"),
  fetchNeteaseRanking(env, "total"),
]);
let failed = false;

for (const [index, result] of results.entries()) {
  const type = index === 0 ? "weekly" : "total";
  if (result.status === "rejected") {
    failed = true;
    console.error(`NetEase ${type} ranking sync failed: ${safeErrorMessage(result.reason)}`);
    continue;
  }
  executeRankingSync(type, result.value);
}

if (failed) process.exitCode = 1;

function executeRankingSync(type, ranking) {
  const table = type === "weekly" ? "netease_weekly_ranking" : "netease_total_ranking";
  const stateTable = type === "weekly" ? "netease_music_sync_state" : "netease_total_ranking_sync_state";
  const syncedAt = ranking[0].syncedAt;
  const statements = [];
  for (const item of ranking) {
    statements.push(
      `INSERT OR REPLACE INTO ${table} (rank, song_id, title, artists_json, cover_url, play_count, score, synced_at) VALUES (`
        + `${sqlNumber(item.rank)}, ${sqlNumber(item.songId)}, ${sqlText(item.title)}, ${sqlText(JSON.stringify(item.artists))}, `
        + `${sqlText(item.coverUrl)}, ${sqlNumber(item.playCount)}, ${sqlNumber(item.score)}, ${sqlText(item.syncedAt)})`,
    );
  }
  statements.push(
    `UPDATE ${stateTable} SET last_attempt_at = ${sqlText(syncedAt)}, last_success_at = ${sqlText(syncedAt)}, last_synced_count = ${ranking.length}, last_error = NULL WHERE id = 1`,
  );

  const args = [
    "./node_modules/wrangler/bin/wrangler.js",
    "d1",
    "execute",
    "blog_web",
    "--config",
    "./wrangler.astro.jsonc",
    values.remote ? "--remote" : "--local",
    "--command",
    `${statements.join(";\n")};`,
  ];
  const child = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: sanitizedEnvironment(),
    stdio: "inherit",
  });

  if (child.status !== 0) {
    failed = true;
    console.error(`Could not write NetEase ${type} ranking to D1.`);
    return;
  }
  console.log(`Synced ${ranking.length} NetEase ${type} ranking rows to ${values.remote ? "remote" : "local"} D1.`);
}

function sanitizedEnvironment() {
  const env = { ...process.env };
  delete env.CLOUDFLARE_API_TOKEN;
  delete env.CLOUDFLARE_ACCOUNT_ID;
  delete env.NETEASE_MUSIC_U;
  delete env.NETEASE_CSRF;
  return env;
}

function safeErrorMessage(error) {
  return error instanceof Error ? error.message : "Unknown sync error.";
}

function sqlText(value) {
  if (value == null) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNumber(value) {
  if (!Number.isFinite(value)) throw new Error("Invalid numeric ranking value.");
  return String(value);
}
