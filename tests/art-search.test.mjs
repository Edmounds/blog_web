import assert from "node:assert/strict";
import test from "node:test";

import {
  searchArtCandidates, searchBooks, searchDeezerMusic, searchDeezerTracks, searchDoubanBookByIsbn, searchDoubanBooks, searchGoogleBooks,
  searchMusic, searchTmdb,
} from "../functions/_shared/art-search.js";
import { onRequestGet as searchArt } from "../functions/api/admin/art/search.js";

test("book ISBN search prefers an exact Douban result", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const value = String(url); calls.push(value);
    if (value.startsWith("https://book.douban.com/isbn/9787544258210/")) return new Response(doubanDetailPage());
    throw new Error(`Unexpected book provider request: ${value}`);
  };
  const items = await searchArtCandidates({ type: "book", query: "秘密", isbn: "9787544258210", fetchImpl });
  assert.deepEqual(items.map((item) => item.source), ["douban_books"]);
  assert.equal(items[0].coverUrl, "https://img9.doubanio.com/view/subject/l/public/s30014644.jpg");
  assert.equal(items[0].creator, "东野圭吾");
  assert.equal(items[0].isbn, "9787544258210");
  assert.equal(calls.length, 1);
  assert.equal(calls[0], "https://book.douban.com/isbn/9787544258210/");
});

test("book title search uses Douban community search and maps current result markup", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const value = String(url); calls.push(value);
    if (value.startsWith("https://www.douban.com/search")) return new Response(doubanGeneralSearchPage());
    throw new Error(`Unexpected book provider request: ${value}`);
  };
  const items = await searchArtCandidates({ type: "book", query: "秘密", creator: "东野圭吾", fetchImpl });
  assert.equal(items[0].sourceId, "27115970");
  assert.equal(items[0].title, "秘密");
  assert.equal(items[0].creator, "东野圭吾");
  assert.equal(items[0].releaseDate, "2017");
  assert.equal(items[0].coverUrl, "https://img9.doubanio.com/view/subject/l/public/s30014644.jpg");
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^https:\/\/www\.douban\.com\/search\?/);
  assert.match(calls[0], /cat=1001/);
  assert.match(calls[0], /q=%E7%A7%98%E5%AF%86\+%E4%B8%9C%E9%87%8E%E5%9C%AD%E5%90%BE/);
});

test("Douban ISBN lookup maps the current detail page", async () => {
  const items = await searchDoubanBookByIsbn({ isbn: "9787544258210", fetchImpl: async () => new Response(doubanDetailPage()) });
  assert.deepEqual(items[0], {
    source: "douban_books", sourceId: "27115970", title: "秘密", creator: "东野圭吾", originalTitle: "秘密",
    releaseDate: "2017-11", isbn: "9787544258210", description: "平介的幸福生活在39岁那年被摧毁了。",
    coverUrl: "https://img9.doubanio.com/view/subject/l/public/s30014644.jpg",
  });
});

test("book search falls back to Google Books when Douban is rate limited", async () => {
  const calls = [];
  const items = await searchBooks({
    query: "秘密", creator: "东野圭吾", env: { GOOGLE_BOOKS_API_KEY: "google-key" },
    fetchImpl: async (url) => {
      const value = String(url); calls.push(value);
      if (value.startsWith("https://www.douban.com/search")) return new Response("你没有权限访问这个页面。", { status: 403 });
      if (value.startsWith("https://www.googleapis.com/books/v1/volumes")) return googleBooksResponse();
      throw new Error(`Unexpected provider request: ${value}`);
    },
  });
  assert.deepEqual(items.map((item) => item.source), ["google_books"]);
  assert.equal(items[0].isbn, "9787544258210");
  assert.equal(calls.length, 2);
  assert.match(calls[1], /key=google-key/);
});

test("book search falls back to Google Books when Douban has no usable result", async () => {
  const calls = [];
  const items = await searchBooks({
    query: "秘密", creator: "东野圭吾",
    fetchImpl: async (url) => {
      const value = String(url); calls.push(value);
      if (value.startsWith("https://www.douban.com/search")) return new Response('<div class="result-list"><div class="result-list-ft"></div></div>');
      if (value.startsWith("https://www.googleapis.com/books/v1/volumes")) return googleBooksResponse();
      throw new Error(`Unexpected provider request: ${value}`);
    },
  });
  assert.deepEqual(items.map((item) => item.source), ["google_books"]);
  assert.equal(calls.length, 2);
});

test("book search falls back when Douban results do not match the requested creator", async () => {
  const calls = [];
  const items = await searchBooks({
    query: "秘密", creator: "东野圭吾",
    fetchImpl: async (url) => {
      const value = String(url); calls.push(value);
      if (value.startsWith("https://www.douban.com/search")) return new Response(doubanGeneralSearchPage().replace("[日] 东野圭吾", "朗达·拜恩"));
      if (value.startsWith("https://www.googleapis.com/books/v1/volumes")) return googleBooksResponse();
      throw new Error(`Unexpected provider request: ${value}`);
    },
  });
  assert.deepEqual(items.map((item) => item.source), ["google_books"]);
  assert.equal(calls.length, 2);
});

test("ISBN search falls back to Google Books when Douban detail markup is unusable", async () => {
  const calls = [];
  const items = await searchBooks({
    query: "秘密", isbn: "9787544258210",
    fetchImpl: async (url) => {
      const value = String(url); calls.push(value);
      if (value.startsWith("https://book.douban.com/isbn/9787544258210/")) return new Response("<html></html>");
      if (value.startsWith("https://www.googleapis.com/books/v1/volumes")) return googleBooksResponse();
      throw new Error(`Unexpected provider request: ${value}`);
    },
  });
  assert.deepEqual(items.map((item) => item.source), ["google_books"]);
  assert.match(calls[1], /q=isbn%3A9787544258210/);
});

test("Google Books maps metadata-only Chinese book results", async () => {
  const items = await searchGoogleBooks({
    query: "秘密", creator: "东野圭吾", env: {}, fetchImpl: async () => googleBooksResponse(),
  });
  assert.deepEqual(items[0], {
    source: "google_books", sourceId: "bP1fswEACAAJ", title: "秘密", creator: "东野圭吾", originalTitle: "秘密",
    releaseDate: "2017", isbn: "9787544258210", description: "Google Books metadata", coverUrl: "",
  });
});

test("book searches reuse successful Cache API results", async () => {
  const cache = new MemoryCache();
  let fetches = 0;
  const options = {
    query: "秘密", creator: "东野圭吾", cache,
    fetchImpl: async () => { fetches += 1; return new Response(doubanGeneralSearchPage()); },
  };
  const first = await searchBooks(options);
  const second = await searchBooks(options);
  assert.equal(first[0].sourceId, "27115970");
  assert.deepEqual(second, first);
  assert.equal(fetches, 1);
});

test("admin book search passes through Cache API results and disables response caching", async () => {
  const cache = new MemoryCache();
  let fetches = 0;
  const options = {
    env: {}, cache,
    request: new Request("https://blog.muelsyse.us/api/admin/art/search?type=book&q=%E7%A7%98%E5%AF%86&creator=%E4%B8%9C%E9%87%8E%E5%9C%AD%E5%90%BE"),
    fetchImpl: async () => { fetches += 1; return new Response(doubanGeneralSearchPage()); },
  };
  const first = await searchArt(options);
  const second = await searchArt(options);

  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  assert.equal((await second.json()).items[0].sourceId, "27115970");
  assert.equal(fetches, 1);
});

test("admin book search maps an exhausted Douban and failed fallback to a provider error", async () => {
  const originalConsoleError = console.error;
  console.error = () => {};
  let response;
  try {
    response = await searchArt({
      env: {}, request: new Request("https://blog.muelsyse.us/api/admin/art/search?type=book&q=%E7%A7%98%E5%AF%86"),
      fetchImpl: async (url) => String(url).startsWith("https://www.douban.com/search")
        ? new Response("你没有权限访问这个页面。", { status: 403 })
        : new Response("unavailable", { status: 503 }),
    });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: { code: "SEARCH_FAILED", message: "搜索服务暂时不可用。" } });
});

test("provider mappings retain metadata-only candidates without covers", async () => {
  const movie = await searchTmdb({
    type: "movie",
    query: "film",
    env: { TMDB_API_KEY: "secret" },
    fetchImpl: async () => response({ results: [{ id: 10, title: "No Poster", poster_path: null }] }),
  });
  assert.equal(movie[0].coverUrl, "");
});

test("Deezer album search maps official albums with selectable covers", async () => {
  const items = await searchDeezerMusic({
    query: "Abbey Road",
    fetchImpl: async (url) => {
      if (String(url).includes("/search/album")) return response({ data: [{ id: 12, title: "Abbey Road (Remastered)", record_type: "album", artist: { name: "The Beatles" }, release_date: "1969-09-26", nb_tracks: 17, cover_xl: "https://deezer.test/cover.jpg" }, { id: 13, title: "Abbey Road EP", record_type: "ep" }] });
      if (String(url).includes("/search/artist")) return response({ data: [] });
      throw new Error(`Unexpected Deezer request: ${url}`);
    },
  });
  assert.deepEqual(items[0], { source: "deezer_music", sourceId: "12", title: "Abbey Road (Remastered)", creator: "The Beatles", originalTitle: "Abbey Road (Remastered)", releaseDate: "1969-09-26", description: "17 tracks", coverUrl: "https://deezer.test/cover.jpg" });
  assert.equal(items.length, 1);
});

test("Deezer track search maps songs with artist and album artwork", async () => {
  const items = await searchDeezerTracks({
    query: "Birds of a Feather",
    fetchImpl: async (url) => {
      assert.match(String(url), /\/search\/track\?q=Birds\+of\+a\+Feather/);
      return response({ data: [{
        id: 3135558851,
        title: "BIRDS OF A FEATHER",
        artist: { name: "Billie Eilish" },
        album: { title: "HIT ME HARD AND SOFT", cover_xl: "https://deezer.test/song.jpg" },
      }] });
    },
  });
  assert.deepEqual(items, [{
    source: "deezer_track",
    sourceId: "3135558851",
    title: "BIRDS OF A FEATHER",
    creator: "Billie Eilish",
    originalTitle: "BIRDS OF A FEATHER",
    releaseDate: "",
    description: "HIT ME HARD AND SOFT",
    coverUrl: "https://deezer.test/song.jpg",
  }]);
});

test("art candidate search requires a music kind and separates album and track providers", async () => {
  const album = await searchArtCandidates({
    type: "music", musicKind: "album", query: "Album",
    fetchImpl: async (url) => String(url).includes("/search/album") ? response({ data: [] }) : response({ data: [] }),
  });
  const single = await searchArtCandidates({
    type: "music", musicKind: "single", query: "Song",
    fetchImpl: async (url) => {
      assert.match(String(url), /\/search\/track/);
      return response({ data: [{ id: 1, title: "Song", artist: { name: "Artist" }, album: { cover_big: "https://deezer.test/track.jpg" } }] });
    },
  });
  assert.deepEqual(album, []);
  assert.equal(single[0].source, "deezer_track");
});

test("music search uses only the query for both Deezer searches and picks the most popular released artist", async () => {
  const calls = [];
  const items = await searchMusic({
    query: "Queen",
    creator: "ignored legacy field",
    fetchImpl: async (url) => {
      const value = String(url); calls.push(value);
      if (value.includes("/search/album")) return response({ data: [] });
      if (value.includes("/search/artist")) return response({ data: [
        { id: 1, name: "Queen tribute", nb_fan: 999999, nb_album: 0 },
        { id: 2, name: "Queen", nb_fan: 500000, nb_album: 20 },
        { id: 3, name: "Queen cover band", nb_fan: 100, nb_album: 2 },
      ] });
      if (value.includes("/artist/2/albums")) return response({ data: [{ id: 20, title: "A Night at the Opera", record_type: "album", artist: { name: "Queen" }, fans: 10 }] });
      throw new Error(`Unexpected Deezer request: ${value}`);
    },
  });
  assert.deepEqual(items.map((item) => item.source), ["deezer_music"]);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((url) => url.startsWith("https://api.deezer.com/")));
  assert.match(calls[0], /\/search\/album\?q=Queen/);
  assert.match(calls[1], /\/search\/artist\?q=Queen/);
  assert.ok(calls.every((url) => !url.includes("ignored")));
});

test("artist albums follow pagination, exclude non-albums, sort by popularity, and precede deduplicated title matches", async () => {
  const items = await searchMusic({
    query: "Artist",
    fetchImpl: async (url) => {
      const value = String(url);
      if (value.includes("/search/album")) return response({ data: [
        { id: 3, title: "Duplicate title result", record_type: "album", artist: { name: "Artist" }, fans: 1 },
        { id: 9, title: "Title-only match", record_type: "album", artist: { name: "Someone else" } },
      ] });
      if (value.includes("/search/artist")) return response({ data: [{ id: 7, name: "Artist", nb_fan: 42, nb_album: 5 }] });
      if (value.includes("index=2")) return response({ data: [
        { id: 3, title: "Alpha", record_type: "album", release_date: "2024-01-01", fans: 100, artist: { name: "Artist" } },
        { id: 4, title: "Newest tie", record_type: "album", release_date: "2025-01-01", fans: 100, artist: { name: "Artist" } },
      ] });
      if (value.includes("/artist/7/albums")) return response({
        data: [
          { id: 1, title: "Less popular", record_type: "album", release_date: "2025-01-01", fans: 10 },
          { id: 2, title: "Not an album", record_type: "ep", fans: 1000 },
        ],
        next: "https://api.deezer.com/artist/7/albums?index=2",
      });
      throw new Error(`Unexpected Deezer request: ${value}`);
    },
  });
  assert.deepEqual(items.map((item) => item.sourceId), ["4", "3", "1", "9"]);
  assert.equal(items.find((item) => item.sourceId === "3")?.title, "Alpha");
  assert.equal(items.find((item) => item.sourceId === "1")?.creator, "Artist");
});

test("music search still returns title matches when no valid artist exists", async () => {
  const items = await searchMusic({
    query: "Unknown",
    fetchImpl: async (url) => String(url).includes("/search/album")
      ? response({ data: [{ id: 5, title: "Unknown Album", record_type: "album", artist: { name: "Known Artist" } }] })
      : response({ data: [{ id: 6, name: "Unknown", nb_fan: 100, nb_album: 0 }] }),
  });
  assert.deepEqual(items.map((item) => item.sourceId), ["5"]);
});

test("music search still returns artist albums when the title search is empty", async () => {
  const items = await searchMusic({
    query: "Exact Artist",
    fetchImpl: async (url) => {
      const value = String(url);
      if (value.includes("/search/album")) return response({ data: [] });
      if (value.includes("/search/artist")) return response({ data: [{ id: 8, name: "Exact Artist", nb_fan: 10, nb_album: 1 }] });
      return response({ data: [{ id: 81, title: "Only Album", record_type: "album", artist: { name: "Exact Artist" } }] });
    },
  });
  assert.deepEqual(items.map((item) => item.sourceId), ["81"]);
});

test("music search rejects invalid Deezer payloads", async () => {
  const items = await searchMusic({ query: "album", fetchImpl: async () => response({ data: "invalid" }) });
  assert.deepEqual(items, []);
});

test("TMDB maps movie and TV search without inferring series versus anime", async () => {
  const seen = [];
  const fetchImpl = async (url) => { seen.push(String(url)); return response({ results: [{ id: 7, name: "葬送的芙莉莲", original_name: "Frieren", first_air_date: "2023-09-29", poster_path: "/poster.jpg", overview: "简介" }] }); };
  const series = await searchTmdb({ type: "series", query: "芙莉莲", env: { TMDB_API_KEY: "secret" }, fetchImpl });
  const anime = await searchTmdb({ type: "anime", query: "芙莉莲", env: { TMDB_API_KEY: "secret" }, fetchImpl });
  assert.deepEqual(series, anime);
  assert.match(seen[0], /\/search\/tv/);
  assert.match(seen[0], /language=zh-CN/);
  assert.doesNotMatch(seen[0], /secret.*secret/);
});

test("provider errors are surfaced", async () => {
  await assert.rejects(
    () => searchMusic({ query: "album", fetchImpl: async () => new Response("rate limit", { status: 429, headers: { "retry-after": "30" } }) }),
    (error) => error.status === 429 && error.provider === "deezer" && error.retryAfter === "30",
  );
});

test("book search surfaces a Douban rate limit", async () => {
  await assert.rejects(
    () => searchDoubanBooks({ query: "白夜行", fetchImpl: async () => new Response(doubanSoftRateLimitPage()) }),
    (error) => error.status === 429 && error.provider === "douban_books",
  );
});

function response(value) { return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } }); }
function googleBooksResponse() {
  return response({ items: [{ id: "bP1fswEACAAJ", volumeInfo: {
    title: "秘密", authors: ["东野圭吾"], publishedDate: "2017", description: "Google Books metadata",
    industryIdentifiers: [{ type: "ISBN_10", identifier: "7544258211" }, { type: "ISBN_13", identifier: "9787544258210" }],
  } }] });
}
function doubanGeneralSearchPage() {
  return `<div class="result-list">
    <div class="result"><div class="pic"><a class="nbg" href="https://www.douban.com/link2/?url=https%3A%2F%2Fbook.douban.com%2Fsubject%2F27115970%2F&amp;cat_id=1001" onclick="moreurl(this,{sid: 27115970})" title="秘密"><img src="https://img9.doubanio.com/view/subject/s/public/s30014644.jpg"></a></div><div class="content"><div class="title"><h3><a>秘密</a></h3><div class="rating-info"><span class="rating_nums">8.0</span><span class="subject-cast">[日] 东野圭吾 / 连子心 / 南海出版公司 / 2017</span></div></div><p>平介的幸福生活在39岁那年被摧毁了。</p></div></div>
    <div class="result"><div class="pic"><a class="nbg" href="https://www.douban.com/link2/?url=https%3A%2F%2Fbook.douban.com%2Fsubject%2F3266968%2F&amp;cat_id=1001" title="秘密"><img src="https://img9.doubanio.com/view/subject/s/public/s3331205.jpg"></a></div><div class="content"><div class="title"><span class="subject-cast">[澳] 朗达·拜恩 / 中国城市出版社 / 2008</span></div><p>另一本同名书。</p></div></div>
    <div class="result-list-ft"></div>
  </div>`;
}
function doubanDetailPage() {
  return `<html><head><link rel="canonical" href="https://book.douban.com/subject/27115970/"><meta property="og:image" content="https://img9.doubanio.com/view/subject/s/public/s30014644.jpg"><meta name="description" content="平介的幸福生活在39岁那年被摧毁了。"></head><body><span property="v:itemreviewed">秘密</span><div id="info">作者: <a>[日] 东野圭吾</a><br>译者: 连子心<br>出版社: 南海出版公司<br>出版年: 2017-11<br>ISBN: 9787544258210<br>原作名: 秘密</div></body></html>`;
}
function doubanSoftRateLimitPage() {
  return `<script>window.__DATA__ = ${JSON.stringify({ total: 0, items: [], error_info: "搜索访问太频繁。" })}; window.__USER__ = {}</script>`;
}
class MemoryCache {
  entries = new Map();
  async match(request) { return this.entries.get(request.url)?.clone(); }
  async put(request, response) { this.entries.set(request.url, response.clone()); }
}
