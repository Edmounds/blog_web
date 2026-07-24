const APPLE_SEARCH_URL = "https://itunes.apple.com/search";
const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";
const DOUBAN_BOOK_SEARCH_URL = "https://search.douban.com/book/subject_search";
const TMDB_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w780";

export async function searchArtCandidates({ type, query, creator = "", isbn = "", env = {}, fetchImpl = fetch }) {
  if (type === "book") return searchBooks({ query, creator, isbn, env, fetchImpl });
  if (type === "music") return searchAppleMusic({ query, creator, fetchImpl });
  if (["movie", "series", "anime"].includes(type)) return searchTmdb({ type, query, env, fetchImpl });
  return [];
}

export async function searchBooks({ query, creator = "", isbn = "", env = {}, fetchImpl = fetch }) {
  const [doubanResult, exactResult] = await Promise.allSettled([
    searchDoubanBooks({ query, creator, isbn, fetchImpl }),
    isbn ? searchGoogleBooks({ query: `isbn:${isbn}`, apiKey: env.GOOGLE_BOOKS_API_KEY, fetchImpl, exactIsbn: isbn }) : [],
  ]);
  const douban = settledValue(doubanResult);
  const exact = settledValue(exactResult);
  if (isbn && douban.some((candidate) => candidate.coverUrl)) return dedupe([...douban, ...exact]);
  const [appleResult] = await Promise.allSettled([searchAppleBooks({ query, creator, fetchImpl })]);
  const apple = settledValue(appleResult);
  let google = [];
  try {
    google = await searchGoogleBooks({ query: googleBookQuery(query, creator), apiKey: env.GOOGLE_BOOKS_API_KEY, fetchImpl });
  } catch (error) {
    if (!douban.length && !apple.length && !exact.length) throw error;
  }
  const items = rankBookCandidates(dedupe([...douban, ...exact, ...apple, ...google]), { query, creator, isbn });
  if (items.length) return items;
  if (doubanResult.status === "rejected" && appleResult.status === "rejected" && exactResult.status === "rejected") throw doubanResult.reason;
  if (appleResult.status === "rejected") throw appleResult.reason;
  if (exactResult.status === "rejected") throw exactResult.reason;
  return [];
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

export async function searchAppleBooks({ query, creator = "", fetchImpl = fetch }) {
  const url = new URL(APPLE_SEARCH_URL);
  url.search = new URLSearchParams({ term: [query, creator].filter(Boolean).join(" "), country: "cn", media: "ebook", entity: "ebook", limit: "20" }).toString();
  const payload = await fetchJson(url, fetchImpl);
  return (payload.results ?? []).map((entry) => ({
    source: "apple_books", sourceId: String(entry.trackId ?? ""), title: entry.trackName ?? "", creator: entry.artistName ?? "",
    originalTitle: entry.trackName ?? "", releaseDate: normalizeDate(entry.releaseDate), description: stripHtml(entry.description ?? ""),
    coverUrl: upgradeAppleArtwork(entry.artworkUrl100 ?? entry.artworkUrl60 ?? ""),
  })).filter((candidate) => candidate.sourceId && candidate.title);
}

export async function searchGoogleBooks({ query, apiKey = "", fetchImpl = fetch, exactIsbn = "" }) {
  const url = new URL(GOOGLE_BOOKS_URL);
  url.search = new URLSearchParams({ q: query, printType: "books", maxResults: "20", ...(apiKey ? { key: apiKey } : {}) }).toString();
  const payload = await fetchJson(url, fetchImpl);
  return (payload.items ?? []).map((entry) => {
    const volume = entry.volumeInfo ?? {};
    const identifiers = volume.industryIdentifiers ?? [];
    const isbn = identifiers.find((item) => item.type === "ISBN_13")?.identifier ?? identifiers[0]?.identifier ?? "";
    return {
      source: "google_books", sourceId: String(entry.id ?? ""), title: volume.title ?? "", creator: (volume.authors ?? []).join(", "),
      originalTitle: volume.title ?? "", releaseDate: volume.publishedDate ?? "", isbn, description: stripHtml(volume.description ?? ""),
      coverUrl: upgradeGoogleArtwork(volume.imageLinks?.extraLarge ?? volume.imageLinks?.large ?? volume.imageLinks?.medium ?? volume.imageLinks?.thumbnail ?? ""),
    };
  }).filter((candidate) => validCandidate(candidate) && (!exactIsbn || normalizeIsbn(candidate.isbn) === normalizeIsbn(exactIsbn)));
}

export async function searchAppleMusic({ query, creator = "", fetchImpl = fetch }) {
  const url = new URL(APPLE_SEARCH_URL);
  url.search = new URLSearchParams({ term: [query, creator].filter(Boolean).join(" "), country: "cn", media: "music", entity: "album", limit: "30" }).toString();
  const payload = await fetchJson(url, fetchImpl);
  return (payload.results ?? []).map((entry) => ({
    source: "apple_music", sourceId: String(entry.collectionId ?? ""), title: entry.collectionName ?? "", creator: entry.artistName ?? "",
    originalTitle: entry.collectionName ?? "", releaseDate: normalizeDate(entry.releaseDate),
    description: entry.trackCount ? `${entry.trackCount} tracks` : "", coverUrl: upgradeAppleArtwork(entry.artworkUrl100 ?? ""),
  })).filter((candidate) => candidate.title && candidate.sourceId);
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

function settledValue(result) {
  return result.status === "fulfilled" ? result.value : [];
}

function providerForUrl(url) {
  const hostname = new URL(url).hostname;
  if (hostname === "itunes.apple.com") return "apple";
  if (hostname === "www.googleapis.com") return "google_books";
  if (hostname === "search.douban.com") return "douban_books";
  if (hostname === "api.themoviedb.org") return "tmdb";
  return "unknown";
}

function googleBookQuery(query, creator) {
  return [`intitle:${query}`, creator ? `inauthor:${creator}` : ""].filter(Boolean).join(" ");
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

function dedupe(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.source}:${candidate.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeDate(value) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function normalizeIsbn(value) {
  return String(value ?? "").replace(/[\s-]/g, "");
}

function stripHtml(value) {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function upgradeAppleArtwork(value) {
  return value.replace(/\d+x\d+bb(?=\.)/, "1000x1000bb");
}

function upgradeGoogleArtwork(value) {
  return value.replace(/^http:/, "https:").replace(/zoom=\d/, "zoom=3").replace(/&edge=curl/g, "");
}

function upgradeDoubanArtwork(value) {
  return value.replace("/view/subject/m/", "/view/subject/l/").replace(/^http:/, "https:");
}
