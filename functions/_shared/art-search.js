const DEEZER_URL = "https://api.deezer.com";
const DOUBAN_BOOK_SEARCH_URL = "https://search.douban.com/book/subject_search";
const TMDB_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w780";

export async function searchArtCandidates({ type, query, creator = "", isbn = "", env = {}, fetchImpl = fetch }) {
  if (type === "book") return searchBooks({ query, creator, isbn, fetchImpl });
  if (type === "music") return searchMusic({ query, fetchImpl });
  if (["movie", "series", "anime"].includes(type)) return searchTmdb({ type, query, env, fetchImpl });
  return [];
}

export async function searchBooks({ query, creator = "", isbn = "", fetchImpl = fetch }) {
  return rankBookCandidates(await searchDoubanBooks({ query, creator, isbn, fetchImpl }), { query, creator, isbn });
}

export async function searchDoubanBooks({ query, creator = "", isbn = "", fetchImpl = fetch }) {
  const url = new URL(DOUBAN_BOOK_SEARCH_URL);
  url.search = new URLSearchParams({ search_text: isbn || [query, creator].filter(Boolean).join(" ") }).toString();
  const response = await fetchImpl(url, {
    headers: { accept: "text/html", "user-agent": "Mozilla/5.0 (compatible; blog-art-search/1.0)" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw providerError(response, "douban_books");
  const payload = parseDoubanSearch(await response.text());
  return (payload.items ?? []).map((entry) => ({
    source: "douban_books", sourceId: String(entry.id ?? ""), title: entry.title ?? "", creator: doubanCreator(entry.abstract ?? ""),
    originalTitle: entry.title ?? "", releaseDate: doubanDate(entry.abstract ?? ""), isbn, description: entry.abstract ?? "",
    coverUrl: upgradeDoubanArtwork(entry.cover_url ?? ""),
  })).filter(validCandidate);
}

export async function searchDeezerMusic({ query, fetchImpl = fetch }) {
  const [titleMatches, artists] = await Promise.all([
    searchDeezerAlbums(query, fetchImpl),
    searchDeezerArtists(query, fetchImpl),
  ]);
  const artist = artists
    .filter((entry) => positiveNumber(entry.nb_album) > 0)
    .sort((left, right) => positiveNumber(right.nb_fan) - positiveNumber(left.nb_fan))[0];
  const artistAlbums = artist?.id
    ? (await fetchDeezerArtistAlbums(artist.id, fetchImpl)).map((entry) => ({ ...entry, artist: entry.artist ?? { name: artist.name ?? "" } }))
    : [];
  const orderedArtistAlbums = artistAlbums
    .filter(isOfficialAlbum)
    .sort(compareDeezerAlbums);
  const seen = new Set();
  return [...orderedArtistAlbums, ...titleMatches.filter(isOfficialAlbum)]
    .filter((entry) => {
      const id = String(entry?.id ?? "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(mapDeezerAlbum)
    .filter(validCandidate);
}

export async function searchMusic({ query, fetchImpl = fetch }) {
  return searchDeezerMusic({ query, fetchImpl });
}

export async function searchTmdb({ type, query, env = {}, fetchImpl = fetch }) {
  if (!env.TMDB_API_KEY) throw new Error("TMDB_API_KEY is not configured.");
  const mediaType = type === "movie" ? "movie" : "tv";
  const url = new URL(`${TMDB_URL}/search/${mediaType}`);
  url.search = new URLSearchParams({ query, language: "zh-CN", include_adult: "false", page: "1", api_key: env.TMDB_API_KEY }).toString();
  const payload = await fetchJson(url, fetchImpl);
  return (payload.results ?? []).map((entry) => ({
    source: "tmdb", sourceId: String(entry.id ?? ""), title: mediaType === "movie" ? entry.title ?? "" : entry.name ?? "", creator: "",
    originalTitle: mediaType === "movie" ? entry.original_title ?? "" : entry.original_name ?? "",
    releaseDate: mediaType === "movie" ? entry.release_date ?? "" : entry.first_air_date ?? "", description: entry.overview ?? "",
    coverUrl: entry.poster_path ? `${TMDB_IMAGE_URL}${entry.poster_path}` : "",
  })).filter((candidate) => candidate.title && candidate.sourceId);
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw providerError(response, providerForUrl(url));
  return response.json();
}

function providerError(response, provider) {
  const error = new Error(`Provider returned HTTP ${response.status}.`);
  error.status = response.status;
  error.provider = provider;
  error.retryAfter = response.headers.get("retry-after") ?? "";
  return error;
}

function validCandidate(candidate) {
  return Boolean(candidate.sourceId && candidate.title);
}

function providerForUrl(url) {
  const hostname = new URL(url).hostname;
  if (hostname === "api.deezer.com") return "deezer";
  if (hostname === "search.douban.com") return "douban_books";
  if (hostname === "api.themoviedb.org") return "tmdb";
  return "unknown";
}

function rankBookCandidates(candidates, { query, creator, isbn }) {
  const normalizedIsbn = normalizeIsbn(isbn);
  return candidates.map((candidate, index) => ({ candidate, index, score: bookCandidateScore(candidate, { query, creator, normalizedIsbn }) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ candidate }) => candidate);
}

function bookCandidateScore(candidate, { query, creator, normalizedIsbn }) {
  if (normalizedIsbn && normalizeIsbn(candidate.isbn) === normalizedIsbn) return 1_000;
  const title = normalizeSearchText(candidate.title);
  const wantedTitle = normalizeSearchText(query);
  if (!wantedTitle || (!title.includes(wantedTitle) && !wantedTitle.includes(title))) return 0;
  let score = title === wantedTitle ? 300 : 100;
  const wantedCreator = normalizeSearchText(creator);
  if (wantedCreator) {
    const candidateCreator = normalizeSearchText(candidate.creator);
    if (!candidateCreator.includes(wantedCreator) && !wantedCreator.includes(candidateCreator)) return 0;
    score += candidateCreator === wantedCreator ? 200 : 100;
  }
  if (candidate.coverUrl) score += 20;
  if (candidate.source === "douban_books") score += 10;
  return score;
}

function parseDoubanSearch(html) {
  const match = String(html).match(/window\.__DATA__\s*=\s*({[\s\S]*?});\s*(?:\n|\r\n?)?\s*window\.__USER__/);
  if (!match) return { items: [] };
  try { return JSON.parse(match[1]); } catch { return { items: [] }; }
}

function doubanCreator(value) {
  return String(value).split("/")[0]?.replace(/^\s*\[[^\]]+\]\s*/, "").trim() ?? "";
}

function doubanDate(value) {
  return String(value).match(/(?:^|\/)\s*(\d{4}(?:-\d{1,2})?(?:-\d{1,2})?)\s*(?:\/|$)/)?.[1] ?? "";
}

function normalizeSearchText(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function normalizeDate(value) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function normalizeIsbn(value) {
  return String(value ?? "").replace(/[\s-]/g, "");
}

function upgradeDoubanArtwork(value) {
  return value.replace("/view/subject/m/", "/view/subject/l/").replace(/^http:/, "https:");
}

async function searchDeezerAlbums(query, fetchImpl) {
  const url = new URL(`${DEEZER_URL}/search/album`);
  url.search = new URLSearchParams({ q: query }).toString();
  return deezerData(await fetchJson(url, fetchImpl));
}

async function searchDeezerArtists(query, fetchImpl) {
  const url = new URL(`${DEEZER_URL}/search/artist`);
  url.search = new URLSearchParams({ q: query }).toString();
  return deezerData(await fetchJson(url, fetchImpl));
}

async function fetchDeezerArtistAlbums(artistId, fetchImpl) {
  const albums = [];
  let next = new URL(`${DEEZER_URL}/artist/${encodeURIComponent(String(artistId))}/albums`);
  do {
    const payload = await fetchJson(next, fetchImpl);
    albums.push(...deezerData(payload));
    next = deezerNext(payload.next);
  } while (next);
  return albums;
}

function deezerData(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}

function deezerNext(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin === DEEZER_URL ? url : null;
  } catch {
    return null;
  }
}

function isOfficialAlbum(entry) {
  return entry?.record_type === "album";
}

function compareDeezerAlbums(left, right) {
  return positiveNumber(right.fans) - positiveNumber(left.fans)
    || normalizeDate(right.release_date).localeCompare(normalizeDate(left.release_date))
    || String(left.title ?? "").localeCompare(String(right.title ?? ""));
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function mapDeezerAlbum(entry) {
  return {
    source: "deezer_music", sourceId: String(entry.id ?? ""), title: entry.title ?? "", creator: entry.artist?.name ?? "",
    originalTitle: entry.title ?? "", releaseDate: normalizeDate(entry.release_date),
    description: entry.nb_tracks ? `${entry.nb_tracks} tracks` : "", coverUrl: entry.cover_xl ?? entry.cover_big ?? entry.cover_medium ?? entry.cover ?? "",
  };
}
