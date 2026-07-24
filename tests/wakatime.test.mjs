import assert from "node:assert/strict";
import test from "node:test";

import {
  getCachedWakaTimeAllTime,
  getCachedWakaTimeToday,
  getWakaTimeAllTime,
  getWakaTimeToday,
  resolveWakaTimeApiKey,
  svgResponse,
} from "../src/lib/wakatime.ts";

test("WakaTime prefers the canonical runtime key and supports the legacy key", () => {
  assert.equal(resolveWakaTimeApiKey({ WAKA_TIME_API_KEY: "canonical", WAKATIME_API_KEY: "legacy" }), "canonical");
  assert.equal(resolveWakaTimeApiKey({ WAKATIME_API_KEY: "legacy" }), "legacy");
  assert.equal(resolveWakaTimeApiKey({}, { WAKA_TIME_API_KEY: "build-canonical" }), "build-canonical");
  assert.equal(resolveWakaTimeApiKey({}, { WAKATIME_API_KEY: "build-legacy" }), "build-legacy");
});

const json = (value, init) => new Response(JSON.stringify(value), { ...init, headers: { "content-type": "application/json" } });

test("WakaTime formats a complete all-time total from the dedicated endpoint", async () => {
  const calls = [];
  const data = await getWakaTimeAllTime("server-secret", {
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), authorization: init.headers.authorization });
      return json({ data: { is_up_to_date: true, total_seconds: 45_300 } });
    },
  });

  assert.deepEqual(data, { duration: "12h 35m" });
  assert.deepEqual(calls, [{
    url: "https://wakatime.com/api/v1/users/current/all_time_since_today",
    authorization: "Basic c2VydmVyLXNlY3JldA==",
  }]);
});

test("WakaTime hides all-time totals while they are incomplete", async () => {
  assert.equal(await getWakaTimeAllTime("secret", {
    fetchImpl: async () => json({ data: { is_up_to_date: false, total_seconds: 1_800 } }),
  }), undefined);
  assert.equal(await getWakaTimeAllTime("secret", {
    fetchImpl: async () => json({ data: { is_up_to_date: true, total_seconds: 1_800 } }, { status: 202 }),
  }), undefined);
});

test("WakaTime hides empty and failed all-time totals", async () => {
  assert.equal(await getWakaTimeAllTime("", { fetchImpl: async () => assert.fail("fetch must not run") }), undefined);
  assert.equal(await getWakaTimeAllTime("secret", {
    fetchImpl: async () => json({ data: { is_up_to_date: true, total_seconds: 0 } }),
  }), undefined);
  assert.equal(await getWakaTimeAllTime("secret", {
    fetchImpl: async () => new Response("no", { status: 502 }),
  }), undefined);
});

test("WakaTime combines today's summary and durations", async () => {
  const calls = [];
  const data = await getWakaTimeToday("server-secret", {
    now: new Date("2026-07-24T08:00:00Z"),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), authorization: init.headers.authorization });
      if (String(url).includes("status_bar")) {
        return json({ data: { grand_total: { total_seconds: 5_490 }, languages: [{ name: "TypeScript" }], editors: [{ name: "VS Code" }] } });
      }
      return json({ data: [{ time: 1_753_344_600, duration: 1_200 }] });
    },
  });

  assert.deepEqual(data, { duration: "1h 32m", language: "TypeScript", editor: "VS Code", lastActivity: "16:10" });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.authorization === "Basic c2VydmVyLXNlY3JldA=="));
  assert.ok(calls.every((call) => !call.url.includes("server-secret")));
});

test("WakaTime returns no public data when unconfigured or empty", async () => {
  assert.equal(await getWakaTimeToday("", { fetchImpl: async () => assert.fail("fetch must not run") }), undefined);
  assert.equal(await getWakaTimeToday("secret", {
    fetchImpl: async (url) => String(url).includes("status_bar")
      ? json({ data: { grand_total: { total_seconds: 0 } } })
      : json({ data: [] }),
  }), undefined);
});

test("WakaTime suppresses upstream errors and timeouts", async () => {
  assert.equal(await getWakaTimeToday("secret", { fetchImpl: async () => new Response("no", { status: 502 }) }), undefined);
  assert.equal(await getWakaTimeToday("secret", {
    timeoutMs: 10,
    fetchImpl: (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))),
  }), undefined);
});

test("WakaTime keeps the legacy today endpoint compatible with successful 202 responses", async () => {
  const data = await getWakaTimeToday("secret", {
    fetchImpl: async (url) => String(url).includes("status_bar")
      ? json({ data: { grand_total: { total_seconds: 1_800 }, languages: [{ name: "JavaScript" }] } }, { status: 202 })
      : json({ data: [{ time: 1_753_344_600, duration: 1_800 }] }),
  });

  assert.equal(data?.duration, "30m");
});

test("empty SVG responses do not disclose configuration", async () => {
  const response = svgResponse();
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=60");
});

test("WakaTime reuses edge-cached data without another upstream request", async () => {
  const values = new Map();
  const cache = {
    async match(request) { return values.get(request.url)?.clone(); },
    async put(request, response) { values.set(request.url, response.clone()); },
  };
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    return String(url).includes("status_bar")
      ? json({ data: { grand_total: { total_seconds: 1_800 }, languages: [{ name: "TypeScript" }], editors: [{ name: "VS Code" }] } })
      : json({ data: [{ time: 1_753_344_600, duration: 1_800 }] });
  };

  const first = await getCachedWakaTimeToday("server-secret", { cache, fetchImpl });
  const second = await getCachedWakaTimeToday("server-secret", {
    cache,
    fetchImpl: async () => assert.fail("cached WakaTime data should avoid upstream requests"),
  });

  assert.deepEqual(second, first);
  assert.equal(calls, 2);
});

test("WakaTime caches complete all-time data separately from today's data", async () => {
  const values = new Map();
  const cache = {
    async match(request) { return values.get(request.url)?.clone(); },
    async put(request, response) { values.set(request.url, response.clone()); },
  };
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return json({ data: { is_up_to_date: true, total_seconds: 2_100 } });
  };

  const first = await getCachedWakaTimeAllTime("server-secret", { cache, fetchImpl });
  const second = await getCachedWakaTimeAllTime("server-secret", {
    cache,
    fetchImpl: async () => assert.fail("cached all-time data should avoid upstream requests"),
  });

  assert.deepEqual(first, { duration: "35m" });
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
  assert.ok(values.has("https://wakatime-cache.internal/all-time"));
  assert.ok(!values.has("https://wakatime-cache.internal/today"));
});
