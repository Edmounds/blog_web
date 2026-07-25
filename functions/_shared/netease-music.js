export const NETEASE_USER_ID = "1460343107";
export const NETEASE_RECORD_URL = "https://music.163.com/api/v1/play/record";

const NETEASE_COVER_HOST = "p1.music.126.net";
const TEXT_LIMIT = 300;
const RANKING_CONFIG = {
  weekly: {
    apiType: "1",
    dataField: "weekData",
    limit: 20,
    table: "netease_weekly_ranking",
    stateTable: "netease_music_sync_state",
    label: "周排行",
  },
  total: {
    apiType: "0",
    dataField: "allData",
    limit: 50,
    table: "netease_total_ranking",
    stateTable: "netease_total_ranking_sync_state",
    label: "总排行",
  },
};

export async function fetchNeteaseRanking(env, type, fetchImpl = fetch, now = new Date()) {
  const config = getRankingConfig(type);
  const musicU = requireSecret(env?.NETEASE_MUSIC_U, "NETEASE_MUSIC_U");
  const csrf = requireSecret(env?.NETEASE_CSRF, "NETEASE_CSRF");
  const url = new URL(NETEASE_RECORD_URL);
  url.searchParams.set("uid", NETEASE_USER_ID);
  url.searchParams.set("type", config.apiType);

  let response;
  try {
    response = await fetchImpl(url, {
      headers: {
        accept: "application/json",
        cookie: `MUSIC_U=${musicU}; __csrf=${csrf}`,
        referer: "https://music.163.com/",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw syncError("NETEASE_FETCH_FAILED", `暂时无法连接网易云音乐${config.label}。`);
  }

  if (!response.ok) {
    throw syncError("NETEASE_FETCH_FAILED", `网易云音乐${config.label}同步失败（HTTP ${response.status}）。`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw syncError("NETEASE_INVALID_RESPONSE", `网易云音乐${config.label}返回了无效数据。`);
  }

  return parseNeteaseRanking(payload, type, now);
}

export function parseNeteaseRanking(payload, type, now = new Date()) {
  const config = getRankingConfig(type);
  const entries = payload?.[config.dataField];
  if (payload?.code !== 200 || !Array.isArray(entries) || entries.length < config.limit) {
    throw syncError(
      "NETEASE_INVALID_RESPONSE",
      `网易云音乐未返回完整的前 ${config.limit} 首${config.label}。`,
    );
  }

  const syncedAt = now.toISOString();
  const ranking = entries.slice(0, config.limit).map((entry, index) => {
    const songId = Number(entry?.song?.id);
    const title = cleanText(entry?.song?.name);
    const artists = Array.isArray(entry?.song?.ar)
      ? entry.song.ar.map((artist) => cleanText(artist?.name)).filter(Boolean)
      : [];
    const playCount = Number(entry?.playCount);
    const score = Number(entry?.score);

    if (!Number.isSafeInteger(songId) || songId <= 0 || !title || artists.length === 0
      || !Number.isSafeInteger(playCount) || playCount < 0 || !Number.isFinite(score) || score < 0) {
      throw syncError("NETEASE_INVALID_RESPONSE", `网易云音乐${config.label}返回了无效的歌曲排行数据。`);
    }

    return {
      rank: index + 1,
      songId,
      title,
      artists,
      coverUrl: normalizeCoverUrl(entry?.song?.al?.picUrl),
      playCount,
      score: Math.round(score),
      syncedAt,
    };
  });

  if (ranking.every((item) => item.playCount === 0)) {
    throw syncError("NETEASE_ANONYMOUS_RESPONSE", `网易云音乐${config.label}未返回有效的播放次数，已保留旧排行。`);
  }

  return ranking;
}

export async function syncNeteaseRanking(env, type, { fetchImpl = fetch, now = new Date() } = {}) {
  const config = getRankingConfig(type);
  const db = requireDb(env);
  const attemptedAt = now.toISOString();
  await recordSyncAttempt(db, config.stateTable, attemptedAt);

  try {
    const ranking = await fetchNeteaseRanking(env, type, fetchImpl, now);
    const statements = [];
    for (const item of ranking) {
      statements.push(db.prepare(
        `INSERT OR REPLACE INTO ${config.table}
         (rank, song_id, title, artists_json, cover_url, play_count, score, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        item.rank,
        item.songId,
        item.title,
        JSON.stringify(item.artists),
        item.coverUrl,
        item.playCount,
        item.score,
        item.syncedAt,
      ));
    }
    statements.push(db.prepare(
      `UPDATE ${config.stateTable}
       SET last_attempt_at = ?, last_success_at = ?, last_synced_count = ?, last_error = NULL
       WHERE id = 1`,
    ).bind(attemptedAt, attemptedAt, ranking.length));
    await db.batch(statements);
    return { type, total: ranking.length, syncedAt: attemptedAt };
  } catch (error) {
    const publicError = normalizeSyncError(error);
    try {
      await recordSyncFailure(db, config.stateTable, attemptedAt, publicError.message);
    } catch (stateError) {
      console.error(`NetEase ${type} ranking failure state could not be recorded`, stateError);
    }
    throw publicError;
  }
}

export async function syncNeteaseRankings(env, options = {}) {
  const weekly = await settleSync(() => syncNeteaseRanking(env, "weekly", options));
  const total = await settleSync(() => syncNeteaseRanking(env, "total", options));
  return { weekly, total };
}

export async function listNeteaseRanking(db, type) {
  const config = getRankingConfig(type);
  let rows;
  try {
    rows = (await db.prepare(
      `SELECT * FROM ${config.table} ORDER BY rank ASC LIMIT ${config.limit}`,
    ).all()).results ?? [];
  } catch (error) {
    if (isMissingRankingTable(error, config.table)) return [];
    throw error;
  }

  return rows.map((row) => ({
    rank: Number(row.rank),
    songId: Number(row.song_id),
    title: String(row.title),
    artists: parseArtists(row.artists_json),
    coverUrl: normalizeCoverUrl(row.cover_url),
    playCount: Number(row.play_count),
    score: Number(row.score),
    syncedAt: String(row.synced_at),
  }));
}

export function getNeteaseSongUrl(songId) {
  return `https://music.163.com/song?id=${songId}`;
}

// Retain the weekly helpers for callers deployed before the generalized interface.
export const fetchNeteaseWeeklyRanking = (env, fetchImpl = fetch, now = new Date()) => (
  fetchNeteaseRanking(env, "weekly", fetchImpl, now)
);
export const parseNeteaseWeeklyRanking = (payload, now = new Date()) => parseNeteaseRanking(payload, "weekly", now);
export const syncNeteaseWeeklyRanking = (env, options = {}) => syncNeteaseRanking(env, "weekly", options);
export const listNeteaseWeeklyRanking = (db) => listNeteaseRanking(db, "weekly");

function getRankingConfig(type) {
  const config = RANKING_CONFIG[type];
  if (!config) throw syncError("NETEASE_RANKING_TYPE_INVALID", "不支持的网易云音乐排行类型。");
  return config;
}

function normalizeCoverUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const source = new URL(value.trim());
    if (source.protocol !== "http:" && source.protocol !== "https:") return null;
    if (!/^p\d+\.music\.126\.net$/i.test(source.hostname)) return null;
    source.protocol = "https:";
    source.hostname = NETEASE_COVER_HOST;
    source.username = "";
    source.password = "";
    source.port = "";
    return source.toString();
  } catch {
    return null;
  }
}

function parseArtists(value) {
  try {
    const artists = JSON.parse(String(value));
    return Array.isArray(artists) ? artists.map(cleanText).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function cleanText(value) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text && Array.from(text).length <= TEXT_LIMIT ? text : undefined;
}

function requireSecret(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw syncError("NETEASE_SECRET_MISSING", `${name} 未配置。`);
  }
  return value.trim();
}

function requireDb(env) {
  if (!env?.DB) throw syncError("DB_NOT_CONFIGURED", "听歌排行数据库未配置。");
  return env.DB;
}

async function recordSyncAttempt(db, stateTable, attemptedAt) {
  await db.prepare(
    `INSERT INTO ${stateTable} (id, last_attempt_at, last_synced_count, last_error)
     VALUES (1, ?, 0, NULL)
     ON CONFLICT(id) DO UPDATE SET last_attempt_at = excluded.last_attempt_at`,
  ).bind(attemptedAt).run();
}

async function recordSyncFailure(db, stateTable, attemptedAt, message) {
  await db.prepare(
    `INSERT INTO ${stateTable} (id, last_attempt_at, last_synced_count, last_error)
     VALUES (1, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET last_attempt_at = excluded.last_attempt_at, last_error = excluded.last_error`,
  ).bind(attemptedAt, message).run();
}

function isMissingRankingTable(error, table) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return new RegExp(`no such table:\\s*${table}`, "i").test(message);
}

function syncError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeSyncError(error) {
  if (error && typeof error === "object" && typeof error.code === "string" && typeof error.message === "string") return error;
  return syncError("NETEASE_SYNC_FAILED", "网易云音乐同步失败，请稍后重试。");
}

async function settleSync(sync) {
  try {
    return { status: "fulfilled", value: await sync() };
  } catch (reason) {
    return { status: "rejected", reason };
  }
}
