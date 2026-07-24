import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPost } from "../functions/api/admin/art/translate.js";

test("art translation API rejects music, series, anime, and missing types", async () => {
  for (const type of ["music", "series", "anime", undefined]) {
    const response = await onRequestPost({
      env: {},
      request: jsonRequest({ type, title: "标题", creator: "作者", extra: "备注" }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: { code: "INVALID_TRANSLATION_TYPE", message: "仅书籍和电影支持自动翻译。" },
    });
  }
});

test("art translation API accepts books and movies", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    const fields = JSON.parse(request.text);
    return Response.json({ data: JSON.stringify({
      title: `${fields.title}-${request.target_lang}`,
      creator: `${fields.creator}-${request.target_lang}`,
      extra: fields.extra ? `${fields.extra}-${request.target_lang}` : "",
    }) });
  };
  try {
    for (const type of ["book", "movie"]) {
      const response = await onRequestPost({
        env: { DEEPLX_BASE_URL: "https://translate.example" },
        request: jsonRequest({ type, title: "标题", creator: "作者", extra: "备注" }),
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.deepEqual(Object.keys(body.translations), ["zh-TW", "en", "ja"]);
      assert.deepEqual(body.warnings, []);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function jsonRequest(body) {
  return new Request("https://blog.muelsyse.us/api/admin/art/translate", {
    method: "POST",
    headers: { origin: "https://blog.muelsyse.us", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
