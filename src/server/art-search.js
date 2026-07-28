const DEEZER_URL = "https://api.deezer.com";
const NETEASE_SEARCH_URL = "https://music.163.com/api/cloudsearch/pc";
const DOUBAN_BOOK_SEARCH_URL = "https://www.douban.com/search";
const DOUBAN_BOOK_URL = "https://book.douban.com";
const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";
const TMDB_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w780";
const BOOK_CACHE_SECONDS = 7 * 24 * 60 * 60;

export async function searchArtCandidates({ type, musicKind, query, creator = "", isbn = "", env = {}, fetchImpl = fetch, cache }) {
  if (type === "book") return searchBooks({ query, creator, isbn, env, fetchImpl, cache });
  if (type === "music") return musicKind === "single" ? searchTracks({ query, fetchImpl }) : searchMusic({ query, fetchImpl });
  if (["movie", "series", "anime"].includes(type)) return searchTmdb({ type, query, env, fetchImpl });
  return [];
}

export async function searchBooks({ query, creator = "", isbn = "", env = {}, fetchImpl = fetch, cache }) {
  const key = bookCacheKey({ query, creator, isbn });
  const cached = await readBookCache(cache, key);
  if (cached) return cached;

  let candidates;
  try {
    candidates = isbn
      ? await searchDoubanBookByIsbn({ isbn, fetchImpl })
      : await searchDoubanBooks({ query, creator, fetchImpl });
  } catch (error) {
    if (!isRecoverableBookProviderError(error)) throw error;
    candidates = await searchGoogleBooks({ query, creator, isbn, env, fetchImpl });
  }
  let items = rankBookCandidates(candidates, { query, creator, isbn });
  if (!items.length && !candidates.some((candidate) => candidate.source === "google_books")) {
    items = rankBookCandidates(await searchGoogleBooks({ query, creator, isbn, env, fetchImpl }), { query, creator, isbn });
  }
  await writeBookCache(cache, key, items);
  return items;
}

export async function searchDoubanBooks({ query, creator = "", isbn = "", fetchImpl = fetch }) {
  if (isbn) return searchDoubanBookByIsbn({ isbn, fetchImpl });
  const url = new URL(DOUBAN_BOOK_SEARCH_URL);
  url.search = new URLSearchParams({ cat: "1001", q: [query, creator].filter(Boolean).join(" ") }).toString();
  const response = await fetchHtml(url, fetchImpl, "douban_books");
  const html = await response.text();
  assertDoubanSearchAvailable(html);
  return parseDoubanGeneralSearch(html);
}

export async function searchDoubanBookByIsbn({ isbn, fetchImpl = fetch }) {
  const response = await fetchHtml(`${DOUBAN_BOOK_URL}/isbn/${encodeURIComponent(isbn)}/`, fetchImpl, "douban_books");
  const candidate = parseDoubanBookDetail(await response.text(), response.url, isbn);
  return candidate ? [candidate] : [];
}

export async function searchGoogleBooks({ query, creator = "", isbn = "", env = {}, fetchImpl = fetch }) {
  const url = new URL(GOOGLE_BOOKS_URL);
  const wanted = isbn ? `isbn:${isbn}` : [`intitle:${query}`, creator ? `inauthor:${creator}` : ""].filter(Boolean).join(" ");
  url.search = new URLSearchParams({ q: wanted, maxResults: "20", printType: "books", ...(env.GOOGLE_BOOKS_API_KEY ? { key: env.GOOGLE_BOOKS_API_KEY } : {}) }).toString();
  const payload = await fetchJson(url, fetchImpl);
  return (payload.items ?? []).map(mapGoogleBook).filter(validCandidate);
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
  return searchNeteaseAlbums({ query, fetchImpl });
}

export async function searchTracks({ query, fetchImpl = fetch }) {
  try {
    const items = await searchNeteaseTracks({ query, fetchImpl });
    if (items.length) return items;
  } catch {}
  return searchDeezerTracks({ query, fetchImpl });
}

export async function searchNeteaseAlbums({ query, fetchImpl = fetch }) {
  const payload = await searchNetease(query, 10, fetchImpl);
  return (Array.isArray(payload?.result?.albums) ? payload.result.albums : []).map(mapNeteaseAlbum).filter(validCandidate);
}

export async function searchNeteaseTracks({ query, fetchImpl = fetch }) {
  const payload = await searchNetease(query, 1, fetchImpl);
  return (Array.isArray(payload?.result?.songs) ? payload.result.songs : []).map(mapNeteaseTrack).filter(validCandidate);
}

export async function searchDeezerTracks({ query, fetchImpl = fetch }) {
  const url = new URL(`${DEEZER_URL}/search/track`);
  url.search = new URLSearchParams({ q: query }).toString();
  return deezerData(await fetchJson(url, fetchImpl)).map(mapDeezerTrack).filter(validCandidate);
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

async function fetchHtml(url, fetchImpl, provider) {
  const response = await fetchImpl(url, {
    headers: { accept: "text/html", "user-agent": "Mozilla/5.0 (compatible; blog-art-search/1.0)" },
    redirect: "follow",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw providerError(response, provider);
  return response;
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
  if (hostname === "music.163.com") return "netease";
  if (["www.douban.com", "search.douban.com", "book.douban.com"].includes(hostname)) return "douban_books";
  if (hostname === "www.googleapis.com") return "google_books";
  if (hostname === "api.themoviedb.org") return "tmdb";
  return "unknown";
}

function isRecoverableBookProviderError(error) {
  return error?.provider === "douban_books" || error?.name === "TimeoutError";
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

function assertDoubanSearchAvailable(html) {
  if (String(html).includes("你没有权限访问这个页面")) throw doubanRateLimitError();
  const match = String(html).match(/window\.__DATA__\s*=\s*({[\s\S]*?});\s*(?:\n|\r\n?)?\s*window\.__USER__/);
  if (!match) return;
  try {
    if (JSON.parse(match[1]).error_info) throw doubanRateLimitError();
  } catch (error) {
    if (error?.provider === "douban_books") throw error;
  }
}

function doubanRateLimitError() {
  const error = new Error("Douban search is rate limited.");
  error.status = 429;
  error.provider = "douban_books";
  error.retryAfter = "";
  return error;
}

function parseDoubanGeneralSearch(html) {
  const candidates = [];
  for (const match of String(html).matchAll(/<div class="result">([\s\S]*?)(?=<div class="result">|<div class="result-list-ft">)/g)) {
    const block = match[1];
    const sourceId = doubanSubjectId(decodeHtml(block.match(/class="nbg"[^>]+href="([^"]+)"/)?.[1] ?? ""), block);
    const title = decodeHtml(block.match(/class="nbg"[^>]*title="([^"]*)"/)?.[1] ?? "").trim();
    const abstract = stripHtml(block.match(/class="subject-cast">([\s\S]*?)<\/span>/)?.[1] ?? "");
    candidates.push({
      source: "douban_books", sourceId, title, creator: doubanCreator(abstract), originalTitle: title,
      releaseDate: doubanDate(abstract), isbn: "", description: stripHtml(block.match(/<div class="content">[\s\S]*?<p>([\s\S]*?)<\/p>/)?.[1] ?? ""),
      coverUrl: upgradeDoubanArtwork(decodeHtml(block.match(/class="nbg"[\s\S]*?<img[^>]+src="([^"]+)"/)?.[1] ?? "")),
    });
  }
  return candidates.filter(validCandidate);
}

function parseDoubanBookDetail(html, finalUrl, requestedIsbn) {
  const sourceId = String(finalUrl || "").match(/\/subject\/(\d+)/)?.[1]
    ?? String(html).match(/book\.douban\.com\/subject\/(\d+)\//)?.[1]
    ?? "";
  const title = stripHtml(String(html).match(/<span property="v:itemreviewed">([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const info = stripHtml(String(html).match(/<div id="info"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const creator = infoField(info, "作者", ["译者", "出版社", "出品方", "出版年", "ISBN", "页数", "定价", "装帧", "原作名", "丛书"])
    .replace(/^\s*\[[^\]]+\]\s*/, "").trim();
  const isbn = info.match(/(?:^|\s)ISBN\s*:\s*([0-9Xx-]+)/)?.[1]?.replace(/-/g, "") ?? requestedIsbn;
  const originalTitle = infoField(info, "原作名", ["丛书"]) || title;
  const cover = decodeHtml(String(html).match(/<meta property="og:image" content="([^"]+)"/i)?.[1]
    ?? String(html).match(/id="mainpic"[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1] ?? "");
  const description = decodeHtml(String(html).match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? "").trim();
  const candidate = {
    source: "douban_books", sourceId, title, creator, originalTitle,
    releaseDate: infoField(info, "出版年", ["ISBN", "页数", "定价", "装帧", "原作名", "丛书"]),
    isbn, description, coverUrl: upgradeDoubanArtwork(cover),
  };
  return validCandidate(candidate) ? candidate : undefined;
}

function doubanSubjectId(href, block) {
  try {
    const decoded = new URL(href, "https://www.douban.com").searchParams.get("url") ?? href;
    return decoded.match(/\/subject\/(\d+)/)?.[1] ?? block.match(/(?:sid|subject_id)\s*:\s*['"]?(\d+)/)?.[1] ?? "";
  } catch {
    return block.match(/(?:sid|subject_id)\s*:\s*['"]?(\d+)/)?.[1] ?? "";
  }
}

function doubanCreator(value) {
  return String(value).split("/")[0]?.replace(/^\s*\[[^\]]+\]\s*/, "").trim() ?? "";
}

function doubanDate(value) {
  return String(value).match(/(?:^|\/)\s*(\d{4}(?:-\d{1,2})?(?:-\d{1,2})?)\s*(?:\/|$)/)?.[1] ?? "";
}

function infoField(info, name, nextNames) {
  const next = nextNames.map(escapeRegExp).join("|");
  return info.match(new RegExp(`(?:^|\\s)${escapeRegExp(name)}\\s*:\\s*(.*?)(?=\\s+(?:${next})\\s*:|$)`))?.[1]?.trim() ?? "";
}

function mapGoogleBook(entry) {
  const info = entry?.volumeInfo ?? {};
  const identifiers = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];
  const isbn = identifiers.find((item) => item?.type === "ISBN_13")?.identifier
    ?? identifiers.find((item) => item?.type === "ISBN_10")?.identifier
    ?? "";
  return {
    source: "google_books", sourceId: String(entry?.id ?? ""), title: info.title ?? "", creator: Array.isArray(info.authors) ? info.authors.join(" / ") : "",
    originalTitle: info.title ?? "", releaseDate: info.publishedDate ?? "", isbn, description: info.description ?? "",
    coverUrl: upgradeGoogleArtwork(info.imageLinks?.extraLarge ?? info.imageLinks?.large ?? info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? ""),
  };
}

function stripHtml(value) {
  return decodeHtml(String(value)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return String(value).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/gi, "'").replace(/&nbsp;|&#160;/g, " ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  return value.replace(/\/view\/subject\/[sm]\//, "/view/subject/l/").replace(/^http:/, "https:");
}

function upgradeGoogleArtwork(value) {
  return String(value).replace(/^http:/, "https:").replace(/&zoom=\d+/, "&zoom=2");
}

function bookCacheKey({ query, creator, isbn }) {
  const url = new URL("https://book-search-cache.internal/results");
  if (isbn) url.searchParams.set("isbn", normalizeIsbn(isbn));
  else {
    url.searchParams.set("q", normalizeSearchText(query));
    if (creator) url.searchParams.set("creator", normalizeSearchText(creator));
  }
  return new Request(url);
}

async function readBookCache(cache, key) {
  if (!cache) return undefined;
  try {
    const response = await cache.match(key);
    return response?.ok ? response.json() : undefined;
  } catch {
    return undefined;
  }
}

async function writeBookCache(cache, key, items) {
  if (!cache || !items.length) return;
  try {
    await cache.put(key, new Response(JSON.stringify(items), {
      headers: { "content-type": "application/json", "cache-control": `public, max-age=${BOOK_CACHE_SECONDS}` },
    }));
  } catch {}
}

async function searchDeezerAlbums(query, fetchImpl) {
  const url = new URL(`${DEEZER_URL}/search/album`);
  url.search = new URLSearchParams({ q: query }).toString();
  return deezerData(await fetchJson(url, fetchImpl));
}

async function searchNetease(query, type, fetchImpl) {
  const url = new URL(NETEASE_SEARCH_URL);
  url.search = new URLSearchParams({ s: query, type: String(type), limit: "30", offset: "0" }).toString();
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/json",
      referer: "https://music.163.com/",
      "user-agent": "Mozilla/5.0 (compatible; blog-art-search/1.0)",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw providerError(response, "netease");
  const payload = await response.json();
  if (payload?.code !== 200) {
    const error = new Error("NetEase search returned an invalid response.");
    error.status = 502;
    error.provider = "netease";
    error.retryAfter = "";
    throw error;
  }
  return payload;
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

function mapDeezerTrack(entry) {
  const album = entry?.album ?? {};
  return {
    source: "deezer_track", sourceId: String(entry?.id ?? ""), title: entry?.title ?? "", creator: entry?.artist?.name ?? "",
    originalTitle: entry?.title ?? "", releaseDate: normalizeDate(entry?.release_date), description: album.title ?? "",
    coverUrl: album.cover_xl ?? album.cover_big ?? album.cover_medium ?? album.cover ?? "",
  };
}

function mapNeteaseAlbum(entry) {
  const artists = Array.isArray(entry?.artists) ? entry.artists : entry?.artist ? [entry.artist] : [];
  return {
    source: "netease_album", sourceId: String(entry?.id ?? ""), title: entry?.name ?? "", creator: artistNames(artists),
    originalTitle: entry?.name ?? "", releaseDate: neteaseDate(entry?.publishTime),
    description: positiveNumber(entry?.size) ? `${entry.size} tracks` : "", coverUrl: normalizeNeteaseCover(entry?.picUrl ?? entry?.blurPicUrl),
  };
}

function mapNeteaseTrack(entry) {
  const album = entry?.al ?? entry?.album ?? {};
  const artists = Array.isArray(entry?.ar) ? entry.ar : Array.isArray(entry?.artists) ? entry.artists : [];
  return {
    source: "netease_track", sourceId: String(entry?.id ?? ""), title: entry?.name ?? "", creator: artistNames(artists),
    originalTitle: entry?.name ?? "", releaseDate: neteaseDate(entry?.publishTime), description: album.name ?? "",
    coverUrl: normalizeNeteaseCover(album.picUrl ?? album.blurPicUrl),
  };
}

function artistNames(artists) {
  return artists.map((artist) => artist?.name).filter(Boolean).join(" / ");
}

function neteaseDate(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp === 0) return "";
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date(timestamp)); } catch { return ""; }
}

function normalizeNeteaseCover(value) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    if (!/^p\d+\.music\.126\.net$/i.test(url.hostname)) return "";
    url.protocol = "https:";
    url.hostname = "p1.music.126.net";
    return url.toString();
  } catch {
    return "";
  }
}
