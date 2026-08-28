import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPost } from "../src/server/api/admin/art/translate.js";

test("art translation API rejects music, series, anime, and missing types", async () => {
  for (const type of ["music", "series", "anime", undefined]) {
    const response = await onRequestPost({
      env: {},
      request: jsonRequest({
        type,
        title: "标题",
        creator: "作者",
        extra: "备注",
      }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: {
        code: "INVALID_TRANSLATION_TYPE",
        message: "仅书籍和电影支持自动翻译。",
      },
    });
  }
});

test("art translation API accepts books and movies", async () => {
  const originalFetch = globalThis.fetch;
  let sentReasoningEffort;
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    sentReasoningEffort = request.reasoning_effort;
    const fields = JSON.parse(
      request.messages[1].content.match(/JSON: (.*)$/s)[1],
    );
    const targetLang = request.messages[1].content.match(
      /Target language: (.*)\n/,
    )[1];
    return Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: `${fields.title}-${targetLang}`,
              creator: `${fields.creator}-${targetLang}`,
              extra: fields.extra ? `${fields.extra}-${targetLang}` : "",
            }),
          },
        },
      ],
    });
  };
  try {
    for (const type of ["book", "movie"]) {
      sentReasoningEffort = undefined;
      const response = await onRequestPost({
        env: {
          OPENAI_BASE_URL: "https://openai.example/v1",
          API_KEY: "secret",
          MODEL: "model",
          REASONING_EFFORT: "xhigh",
        },
        request: jsonRequest({
          type,
          title: "标题",
          creator: "作者",
          extra: "备注",
        }),
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.deepEqual(Object.keys(body.translations), ["zh-TW", "en", "ja"]);
      assert.deepEqual(body.warnings, []);
      assert.equal(sentReasoningEffort, "xhigh");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function jsonRequest(body) {
  return new Request("https://blog.muelsyse.us/api/admin/art/translate", {
    method: "POST",
    headers: {
      origin: "https://blog.muelsyse.us",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
