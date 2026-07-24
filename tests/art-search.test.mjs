import assert from "node:assert/strict";
import test from "node:test";

import { searchArtCandidates, searchAppleMusic, searchBooks, searchDoubanBooks, searchTmdb } from "../functions/_shared/art-search.js";

test("book ISBN search prefers an exact Douban result", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const value = String(url); calls.push(value);
    if (value.startsWith("https://search.douban.com")) return new Response(doubanPage([{ id: 27115970, title: "秘密", abstract: "[日] 东野圭吾 / 连子心 / 南海出版公司 / 2017-11", cover_url: "https://img9.doubanio.com/view/subject/m/public/s30014644.jpg" }]));
    return response({ items: [{ id: "g1", volumeInfo: { title: "秘密", authors: ["东野圭吾"], industryIdentifiers: [{ type: "ISBN_13", identifier: "9787544258210" }], imageLinks: { thumbnail: "http://google.test/cover.jpg?zoom=1" } } }] });
  };
  const items = await searchArtCandidates({ type: "book", query: "秘密", isbn: "9787544258210", fetchImpl });
  assert.deepEqual(items.map((item) => item.source), ["douban_books", "google_books"]);
  assert.equal(items[0].coverUrl, "https://img9.doubanio.com/view/subject/l/public/s30014644.jpg");
  assert.equal(items[0].creator, "东野圭吾");
  assert.equal(calls.length, 2);
  assert.match(calls[0], /search_text=9787544258210/);
  assert.match(calls[1], /isbn%3A9787544258210/);
});

test("book title search rejects unrelated provider matches", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const value = String(url); calls.push(value);
    if (value.startsWith("https://search.douban.com")) return new Response(doubanPage([]));
    if (value.startsWith("https://itunes.apple.com")) return response({ results: [{ trackId: 1, trackName: "当我们谈论东野圭吾时，我们在谈论什么", artistName: "彭麦峰", artworkUrl100: "https://apple.test/100x100bb.jpg" }] });
    return response({ items: [
      { id: "g1", volumeInfo: { title: "出版人", authors: ["创作者待补充"], imageLinks: { thumbnail: "https://google.test/one.jpg" } } },
      { id: "g2", volumeInfo: { title: "全国新书目", authors: ["创作者待补充"], imageLinks: { thumbnail: "https://google.test/two.jpg" } } },
    ] });
  };
  const items = await searchArtCandidates({ type: "book", query: "秘密", creator: "东野圭吾", fetchImpl });
  assert.deepEqual(items, []);
  assert.equal(calls.length, 3);
  assert.match(calls[2], /intitle%3A%E7%A7%98%E5%AF%86/);
  assert.match(calls[2], /inauthor%3A%E4%B8%9C%E9%87%8E%E5%9C%AD%E5%90%BE/);
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

test("book search keeps Apple results when optional Google ISBN lookup is rate limited", async () => {
  const items = await searchBooks({
    query: "秘密",
    isbn: "9787544258210",
    fetchImpl: async (url) => String(url).startsWith("https://search.douban.com")
      ? new Response(doubanPage([]))
      : String(url).startsWith("https://itunes.apple.com")
        ? response({ results: [{ trackId: 1, trackName: "秘密", artistName: "东野圭吾", artworkUrl100: "https://apple.test/100x100bb.jpg" }] })
        : new Response("rate limit", { status: 429 }),
  });

  assert.deepEqual(items.map((item) => item.source), ["apple_books"]);
});

test("book search falls back to Google when Apple is rate limited", async () => {
  const items = await searchBooks({
    query: "白夜行",
    fetchImpl: async (url) => String(url).startsWith("https://search.douban.com") || String(url).startsWith("https://itunes.apple.com")
      ? new Response("rate limit", { status: 429 })
      : response({ items: [{ id: "g3", volumeInfo: { title: "白夜行", authors: ["东野圭吾"], imageLinks: { thumbnail: "https://google.test/cover.jpg" } } }] }),
  });

  assert.deepEqual(items.map((item) => item.source), ["google_books"]);
});

test("book search still surfaces a rate limit when every provider fails", async () => {
  await assert.rejects(
    () => searchBooks({ query: "白夜行", fetchImpl: async () => new Response("rate limit", { status: 429 }) }),
    /HTTP 429/,
  );
});

function response(value) { return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } }); }
function doubanPage(items) { return `<script>window.__DATA__ = ${JSON.stringify({ count: items.length, items })};\nwindow.__USER__ = {}</script>`; }
