import {
  ART_COVER_BASE_URL,
  parseExternalArtCoverUrl,
} from "../../src/server/art.js";
import { getSteamCoverUrl } from "../../src/server/games.js";

const DOUBAN_REFERER = "https://book.douban.com/";

const bucketUrl = (key) =>
  `${ART_COVER_BASE_URL}/${String(key).replace(/^\/+/, "")}`;

export function artCoverSource(row) {
  if (row?.cover_key) return { url: bucketUrl(row.cover_key) };
  const external = parseExternalArtCoverUrl(
    row?.source,
    row?.cover_source_url ?? "",
  );
  if (!external) return null;
  return new URL(external).hostname.endsWith(".doubanio.com")
    ? { url: external, referer: DOUBAN_REFERER }
    : { url: external };
}

export function gameCoverSource(row) {
  if (row?.cover_key) return { url: bucketUrl(row.cover_key) };
  if (row?.steam_app_id == null) return null;
  const appId = Number(row.steam_app_id);
  return Number.isFinite(appId) ? { url: getSteamCoverUrl(appId) } : null;
}

export function selectCoverSources(
  rows,
  resolveSource,
  limit = 6,
) {
  const selected = [];
  for (const row of rows ?? []) {
    if (selected.length >= limit) break;
    const source = resolveSource(row);
    if (!source) continue;
    selected.push({ id: String(row.id), ...source });
  }
  return selected;
}
