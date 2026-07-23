import assert from "node:assert/strict";
import test from "node:test";

import { createDeepLxClient } from "../scripts/lib/deeplx.mjs";

test("DeepLX client appends /translate and uses bearer authentication", async () => {
  let request;
  const client = createDeepLxClient({
    baseUrl: "https://deeplx.example/",
    apiKey: "secret",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ data: "Hello" }), { status: 200 });
    },
  });

  assert.equal(await client({ text: "你好", sourceLang: "ZH", targetLang: "EN" }), "Hello");
  assert.equal(request.url, "https://deeplx.example/translate");
  assert.equal(request.init.headers.authorization, "Bearer secret");
  assert.deepEqual(JSON.parse(request.init.body), { text: "你好", source_lang: "ZH", target_lang: "EN" });
});

test("DeepLX client accepts a complete translate endpoint", async () => {
  let requestedUrl;
  const client = createDeepLxClient({
    baseUrl: "https://deeplx.example/api/translate",
    apiKey: "secret",
    fetchImpl: async (url) => {
      requestedUrl = url;
      return new Response(JSON.stringify({ data: "Bonjour" }), { status: 200 });
    },
  });
  await client({ text: "你好", sourceLang: "ZH", targetLang: "FR" });
  assert.equal(requestedUrl, "https://deeplx.example/api/translate");
});

test("DeepLX client does not retry permanent 4xx responses", async () => {
  let requests = 0;
  const client = createDeepLxClient({
    baseUrl: "https://deeplx.example/translate",
    apiKey: "secret",
    fetchImpl: async () => {
      requests += 1;
      return new Response(JSON.stringify({ message: "teapot" }), { status: 418 });
    },
  });
  await assert.rejects(() => client({ text: "你好", sourceLang: "ZH", targetLang: "EN" }), /HTTP 418/);
  assert.equal(requests, 1);
});
