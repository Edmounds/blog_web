import assert from "node:assert/strict";
import test from "node:test";

import { searchArtCandidates, searchAppleMusic, searchBooks, searchDeezerMusic, searchDoubanBooks, searchMusic, searchTmdb } from "../functions/_shared/art-search.js";

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
  const music = await searchAppleMusic({
    query: "album",
    fetchImpl: async () => response({ results: [{ collectionId: 9, collectionName: "No Cover", artistName: "Artist" }] }),
  });
  const movie = await searchTmdb({
    type: "movie",
    query: "film",
    env: { TMDB_API_KEY: "secret" },
    fetchImpl: async () => response({ results: [{ id: 10, title: "No Poster", poster_path: null }] }),
  });
  assert.equal(music[0].coverUrl, "");
  assert.equal(movie[0].coverUrl, "");
});

test("Apple Music maps albums and upgrades artwork", async () => {
  const items = await searchAppleMusic({ query: "Abbey Road", fetchImpl: async () => response({ results: [{ collectionId: 3, collectionName: "Abbey Road", artistName: "The Beatles", releaseDate: "1969-09-26T00:00:00Z", trackCount: 17, artworkUrl100: "https://apple.test/100x100bb.jpg" }] }) });
  assert.deepEqual(items[0], { source: "apple_music", sourceId: "3", title: "Abbey Road", creator: "The Beatles", originalTitle: "Abbey Road", releaseDate: "1969-09-26", description: "17 tracks", coverUrl: "https://apple.test/1000x1000bb.jpg" });
});

test("Deezer maps albums with selectable covers", async () => {
  const items = await searchDeezerMusic({
    query: "Abbey Road",
    creator: "The Beatles",
    fetchImpl: async () => response({ data: [{ id: 12, title: "Abbey Road (Remastered)", artist: { name: "The Beatles" }, release_date: "1969-09-26", nb_tracks: 17, cover_xl: "https://deezer.test/cover.jpg" }] }),
  });
  assert.deepEqual(items[0], { source: "deezer_music", sourceId: "12", title: "Abbey Road (Remastered)", creator: "The Beatles", originalTitle: "Abbey Road (Remastered)", releaseDate: "1969-09-26", description: "17 tracks", coverUrl: "https://deezer.test/cover.jpg" });
});

test("music search falls back to Deezer when Apple Music fails", async () => {
  const calls = [];
  const items = await searchMusic({
    query: "Abbey Road",
    creator: "The Beatles",
    fetchImpl: async (url) => {
      const value = String(url); calls.push(value);
      if (value.startsWith("https://itunes.apple.com")) return new Response("upstream failed", { status: 502 });
      return response({ data: [{ id: 12, title: "Abbey Road", artist: { name: "The Beatles" }, nb_tracks: 17, cover_xl: "https://deezer.test/cover.jpg" }] });
    },
  });
  assert.deepEqual(items.map((item) => item.source), ["deezer_music"]);
  assert.match(calls[1], /^https:\/\/api\.deezer\.com\/search\/album\?/);
  assert.match(calls[1], /q=Abbey\+Road\+The\+Beatles/);
});

test("music search does not call the backup when Apple Music succeeds", async () => {
  const calls = [];
  const items = await searchMusic({
    query: "Abbey Road",
    creator: "The Beatles",
    fetchImpl: async (url) => {
      calls.push(String(url));
      return response({ results: [{ collectionId: 3, collectionName: "Abbey Road", artistName: "The Beatles", artworkUrl100: "https://apple.test/100x100bb.jpg" }] });
    },
  });
  assert.deepEqual(items.map((item) => item.source), ["apple_music"]);
  assert.equal(calls.length, 1);
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
    () => searchAppleMusic({ query: "album", fetchImpl: async () => new Response("rate limit", { status: 429, headers: { "retry-after": "30" } }) }),
    (error) => error.status === 429 && error.provider === "apple" && error.retryAfter === "30",
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
