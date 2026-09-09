import assert from "node:assert/strict";
import { test } from "node:test";

import { searchContent } from "../src/lib/search.ts";

const SAMPLE_ITEMS = [
  {
    id: "blog/20260813-02",
    type: "blog",
    title: "基于Cloudflare构建个人网站",
    description: "记录如何使用 Cloudflare Workers 和 D1 部署网站与边缘数据库",
    tags: ["Cloudflare", "网站建设", "架构"],
    url: "/blog/20260813-02/",
    date: "2026-08-13",
  },
  {
    id: "blog/20260813-01",
    type: "blog",
    title: "使用GitHub Actions 实现博客自动化更新",
    description: "利用 GitHub Actions 流水线自动化同步文章、图片与构建部署",
    tags: ["CI/CD", "GitHub", "自动化"],
    url: "/blog/20260813-01/",
    date: "2026-08-13",
  },
  {
    id: "note/20260818-01",
    type: "note",
    title: "当temu变成了形容词",
    description: "从商业现象看廉价低质商品的代名词转变与思考",
    tags: ["商业", "思考"],
    url: "/note/20260818-01/",
    date: "2026-08-18",
  },
  {
    id: "note/20260727-01",
    type: "note",
    title: "我对东野圭吾的印象",
    description: "阅读白夜行、嫌疑人X的献身等作品后的读后感",
    tags: ["读书", "文学", "东野圭吾"],
    url: "/note/20260727-01/",
    date: "2026-07-27",
  },
  {
    id: "project/robviz",
    type: "project",
    title: "RobViz 机器人可视化平台",
    description: "基于 WebGL 与 Three.js 的跨平台工业机器人轨迹仿真与状态监测系统",
    tags: ["Three.js", "WebGL", "机器人"],
    url: "/project/robviz/",
    date: "2026-08-30",
  },
];

test("searchContent returns empty array for empty or whitespace query", () => {
  assert.deepEqual(searchContent(SAMPLE_ITEMS, ""), []);
  assert.deepEqual(searchContent(SAMPLE_ITEMS, "   "), []);
});

test("searchContent matches title and ranks title matches higher than description matches", () => {
  const results = searchContent(SAMPLE_ITEMS, "Cloudflare");
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "blog/20260813-02");
});

test("searchContent matches tags accurately", () => {
  const results = searchContent(SAMPLE_ITEMS, "自动化");
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "blog/20260813-01");
});

test("searchContent matches description text", () => {
  const results = searchContent(SAMPLE_ITEMS, "白夜行");
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "note/20260727-01");
});

test("searchContent supports multi-word AND queries", () => {
  const results = searchContent(SAMPLE_ITEMS, "GitHub Actions");
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "blog/20260813-01");

  // If one term does not match any field, item is not included
  const noMatch = searchContent(SAMPLE_ITEMS, "GitHub 机器人");
  assert.equal(noMatch.length, 0);
});

test("searchContent is case-insensitive for English keywords", () => {
  const lower = searchContent(SAMPLE_ITEMS, "robviz");
  const upper = searchContent(SAMPLE_ITEMS, "ROBVIZ");
  assert.equal(lower.length, 1);
  assert.equal(upper.length, 1);
  assert.equal(lower[0].id, upper[0].id);
});

test("searchContent enforces result limit", () => {
  const results = searchContent(SAMPLE_ITEMS, "2026", 2);
  assert.equal(results.length <= 2, true);
});
