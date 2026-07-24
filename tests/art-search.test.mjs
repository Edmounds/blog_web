import assert from "node:assert/strict";
import test from "node:test";

import { searchArtCandidates, searchBooks, searchDeezerMusic, searchDoubanBooks, searchMusic, searchTmdb } from "../functions/_shared/art-search.js";

test("book ISBN search prefers an exact Douban result", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const value = String(url); calls.push(value);
    if (value.startsWith("https://search.douban.com")) return new Response(doubanPage([{ id: 27115970, title: "秘密", abstract: "[日] 东野圭吾 / 连子心 / 南海出版公司 / 2017-11", cover_url: "https://img9.doubanio.com/view/subject/m/public/s30014644.jpg" }]));
    throw new Error(`Unexpected book provider request: ${value}`);
  };
  const items = await searchArtCandidates({ type: "book", query: "秘密", isbn: "9787544258210", fetchImpl });
  assert.deepEqual(items.map((item) => item.source), ["douban_books"]);
  assert.equal(items[0].coverUrl, "https://img9.doubanio.com/view/subject/l/public/s30014644.jpg");
  assert.equal(items[0].creator, "东野圭吾");
  assert.equal(calls.length, 1);
  assert.match(calls[0], /search_text=9787544258210/);
});

test("book title search only calls Douban", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const value = String(url); calls.push(value);
    if (value.startsWith("https://search.douban.com")) return new Response(doubanPage([]));
    throw new Error(`Unexpected book provider request: ${value}`);
  };
  const items = await searchArtCandidates({ type: "book", query: "秘密", creator: "东野圭吾", fetchImpl });
  assert.deepEqual(items, []);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /search_text=%E7%A7%98%E5%AF%86\+%E4%B8%9C%E9%87%8E%E5%9C%AD%E5%90%BE/);
});

test("Douban book search maps its embedded result data", async () => {
  const items = await searchDoubanBooks({
    query: "秘密", creator: "东野圭吾", isbn: "9787544258210",
    fetchImpl: async () => new Response(doubanPage([{ id: 27115970, title: "秘密", abstract: "[日] 东野圭吾 / 连子心 / 南海出版公司 / 2017-11 / 45.00元", cover_url: "https://img9.doubanio.com/view/subject/m/public/s30014644.jpg" }])),
  });
  assert.deepEqual(items[0], {
    source: "douban_books", sourceId: "27115970", title: "秘密", creator: "东野圭吾", originalTitle: "秘密",
    releaseDate: "2017-11", isbn: "9787544258210", description: "[日] 东野圭吾 / 连子心 / 南海出版公司 / 2017-11 / 45.00元",
    coverUrl: "https://img9.doubanio.com/view/subject/l/public/s30014644.jpg",
  });
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
    () => searchBooks({ query: "白夜行", fetchImpl: async () => new Response("rate limit", { status: 429 }) }),
    /HTTP 429/,
  );
});

function response(value) { return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } }); }
function doubanPage(items) { return `<script>window.__DATA__ = ${JSON.stringify({ count: items.length, items })};\nwindow.__USER__ = {}</script>`; }
