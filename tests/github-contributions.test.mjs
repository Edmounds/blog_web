import assert from "node:assert/strict";
import test from "node:test";

import {
  createGitHubContributionHeatmap,
  createGitHubContributionHeatmapSkeleton,
  getGitHubContributionHeatmap,
  parseGitHubContributionHtml,
} from "../src/lib/github-contributions.ts";

test("GitHub contribution HTML parsing preserves dates, counts, labels, and clamped levels", () => {
  const days = parseGitHubContributionHtml(`
    <table>
      <td class="ContributionCalendar-day" data-date="2026-07-23" data-level="3"></td>
      <tool-tip>12 contributions on July 23, 2026.</tool-tip>
      <td class="ContributionCalendar-day" data-date="2026-07-24" data-level="9"></td>
      <tool-tip>No contributions on July 24, 2026.</tool-tip>
    </table>
  `);

  assert.deepEqual(days, [
    { count: 12, date: "2026-07-23", label: "12 contributions on July 23, 2026.", level: 3 },
    { count: 0, date: "2026-07-24", label: "No contributions on July 24, 2026.", level: 4 },
  ]);
});

test("GitHub contribution heatmaps cover the latest 365 days across year boundaries", () => {
  const heatmap = createGitHubContributionHeatmap([
    { count: 2, date: "2025-01-01", label: "2 contributions on January 1, 2025.", level: 2 },
    { count: 7, date: "2026-01-01", label: "7 contributions on January 1, 2026.", level: 4 },
  ], new Date("2026-01-02T12:00:00Z"));

  assert.equal(heatmap.rangeStart, "2025-01-03");
  assert.equal(heatmap.rangeEnd, "2026-01-02");
  assert.equal(heatmap.days.filter((day) => !day.isBlank).length, 365);
  assert.equal(heatmap.days.find((day) => day.date === "2026-01-01")?.count, 7);
  assert.equal(heatmap.days.some((day) => day.date === "2025-01-01" && !day.isBlank), false);
  assert.equal(heatmap.total, 7);
  assert.ok(heatmap.months.some((month) => month.label === "Jan"));
});

test("GitHub contribution skeletons keep a stable seven-row calendar", () => {
  const heatmap = createGitHubContributionHeatmapSkeleton(new Date("2026-07-25T00:00:00Z"));

  assert.ok(heatmap.weekCount === 52 || heatmap.weekCount === 53);
  assert.equal(heatmap.days.length, heatmap.weekCount * 7);
  assert.equal(heatmap.total, 0);
  assert.ok(heatmap.days.every((day) => day.count === 0));
});

test("GitHub contribution fetching rejects invalid usernames without a request", async () => {
  const heatmap = await getGitHubContributionHeatmap("bad/name", {
    fetchImpl: async () => assert.fail("invalid usernames must not be requested"),
  });

  assert.equal(heatmap, undefined);
});

test("GitHub contribution fetching combines the required years and tolerates one failed year", async () => {
  const calls = [];
  const heatmap = await getGitHubContributionHeatmap("Edmounds", {
    now: new Date("2026-01-02T12:00:00Z"),
    token: "github-secret",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), authorization: init.headers.authorization });
      if (String(url).includes("from=2025-01-01")) return new Response("no", { status: 502 });
      return new Response(`
        <td class="ContributionCalendar-day" data-date="2026-01-01" data-level="4"></td>
        <tool-tip>7 contributions on January 1, 2026.</tool-tip>
      `);
    },
  });

  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.authorization === "Bearer github-secret"));
  assert.equal(heatmap?.total, 7);
});

test("GitHub contribution fetching returns no data when every upstream request fails", async () => {
  const heatmap = await getGitHubContributionHeatmap("Edmounds", {
    now: new Date("2026-07-25T00:00:00Z"),
    fetchImpl: async () => new Response("no", { status: 429 }),
  });

  assert.equal(heatmap, undefined);
});
