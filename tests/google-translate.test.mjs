import assert from "node:assert/strict";
import test from "node:test";

import { createGoogleTranslateClient } from "../scripts/lib/google-translate.mjs";

test("Google fallback sends form data and joins translated response parts", async () => {
  let request;
  const translate = createGoogleTranslateClient({
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify([[ ["Hello ", "你好"], ["world", "世界"] ]]), { status: 200 });
    },
  });

  assert.equal(await translate({ text: "你好世界", sourceLang: "ZH", targetLang: "EN" }), "Hello world");
  assert.equal(request.url, "https://translate.googleapis.com/translate_a/single");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.body.get("sl"), "zh");
  assert.equal(request.init.body.get("tl"), "en");
  assert.equal(request.init.body.get("q"), "你好世界");
});

test("Google fallback rejects malformed responses", async () => {
  const translate = createGoogleTranslateClient({
    retries: 1,
    fetchImpl: async () => new Response(JSON.stringify({ data: "wrong shape" }), { status: 200 }),
  });
  await assert.rejects(() => translate({ text: "你好", sourceLang: "ZH", targetLang: "JA" }), /invalid response/);
});

