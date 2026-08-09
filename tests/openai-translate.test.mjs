import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createOpenAITranslateClient } from "../scripts/lib/openai-translate.mjs";

test("OpenAI-compatible client sends a Chat Completions request", async () => {
  let request;
  const translate = createOpenAITranslateClient({
    baseUrl: "https://openai.example/v1/",
    apiKey: "secret",
    model: "translation-model",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ choices: [{ message: { content: "你好" } }] }), { status: 200 });
    },
  });

  assert.equal(await translate({ text: "你好", sourceLang: "ZH", targetLang: "ZH-TW" }), "你好");
  assert.equal(request.url, "https://openai.example/v1/chat/completions");
  assert.equal(request.init.headers.authorization, "Bearer secret");
  const body = JSON.parse(request.init.body);
  assert.equal(body.model, "translation-model");
  assert.equal(body.stream, true);
  assert.match(body.messages[0].content, /natural, idiomatic/);
  assert.match(body.messages[0].content, /Do not omit, summarize, add, or explain/);
  assert.match(body.messages[0].content, /silently check/);
  assert.match(body.messages[1].content, /Traditional Chinese/);
  assert.match(body.messages[1].content, /<source_text>\n你好\n<\/source_text>/);
  assert.match(body.messages[1].content, /你好/);
});

test("OpenAI-compatible client resets its timeout while streamed translation data keeps arriving", async () => {
  const encoder = new TextEncoder();
  const translate = createOpenAITranslateClient({
    baseUrl: "https://openai.example/v1",
    apiKey: "secret",
    model: "translation-model",
    retries: 1,
    timeoutMs: 80,
    fetchImpl: async () => new Response(new ReadableStream({
      async start(controller) {
        for (const content of ["A", "B", "C"]) {
          await new Promise((resolve) => setTimeout(resolve, 45));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }), { status: 200, headers: { "content-type": "text/event-stream" } }),
  });

  assert.equal(await translate({ text: "很长的文章", sourceLang: "ZH", targetLang: "EN" }), "ABC");
});

test("OpenAI-compatible client times out after streamed translation data stops arriving", async () => {
  const translate = createOpenAITranslateClient({
    baseUrl: "https://openai.example/v1",
    apiKey: "secret",
    model: "translation-model",
    retries: 1,
    timeoutMs: 20,
    fetchImpl: async (_url, init) => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"A"}}]}\n\n'));
        init.signal.addEventListener("abort", () => controller.error(init.signal.reason), { once: true });
      },
    }), { status: 200, headers: { "content-type": "text/event-stream" } }),
  });

  await assert.rejects(
    () => translate({ text: "暂停返回的文章", sourceLang: "ZH", targetLang: "EN" }),
    (error) => error?.name === "AbortError" || error?.name === "TimeoutError",
  );
});

test("OpenAI-compatible client requests one complete Markdown document translation", async () => {
  let request;
  const source = "---\ntitle: 你好\ncreatedAt: 2026-07-24\n---\n\n第一段。\n\n第二段。";
  const translate = createOpenAITranslateClient({
    baseUrl: "https://openai.example/v1",
    apiKey: "secret",
    model: "translation-model",
    fetchImpl: async (_url, init) => {
      request = JSON.parse(init.body);
      return new Response(JSON.stringify({ choices: [{ message: { content: source } }] }), { status: 200 });
    },
  });

  await translate({
    text: source,
    sourceLang: "ZH",
    targetLang: "EN",
    format: "markdown-document",
    preserveFrontmatterKeys: ["createdAt"],
  });

  assert.match(request.messages[0].content, /complete Markdown document/);
  assert.match(request.messages[0].content, /author's meaning, tone, voice/);
  assert.match(request.messages[0].content, /Never alter code blocks, inline code, commands, math, URLs, paths, slugs, identifiers, dates, booleans, or numbers/);
  assert.match(request.messages[0].content, /image alt text/);
  assert.match(request.messages[0].content, /placeholder alt text equal to image unchanged/);
  assert.match(request.messages[0].content, /silently check the translation for accuracy, fluency, terminology consistency, omissions, and formatting damage/);
  assert.match(request.messages[0].content, /createdAt/);
  assert.match(request.messages[1].content, /<source_text>/);
  assert.match(request.messages[1].content, /<\/source_text>/);
  assert.equal(request.messages[1].content.match(/第一段。/g)?.length, 1);
  assert.match(request.messages[1].content, /第一段。[\s\S]*第二段。/);
});

test("OpenAI-compatible client requires all configuration", async () => {
  const translate = createOpenAITranslateClient({ baseUrl: "", apiKey: "", model: "", retries: 1 });
  await assert.rejects(() => translate({ text: "你好", sourceLang: "ZH", targetLang: "EN" }), /OPENAI_BASE_URL, API_KEY, and MODEL/);
});

test("OpenAI-compatible client rejects malformed responses", async () => {
  const translate = createOpenAITranslateClient({
    baseUrl: "https://openai.example/v1",
    apiKey: "secret",
    model: "translation-model",
    retries: 1,
    fetchImpl: async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }),
  });
  await assert.rejects(() => translate({ text: "你好", sourceLang: "ZH", targetLang: "JA" }), /invalid or empty/);
});

test("OpenAI-compatible client does not retry permanent 4xx responses", async () => {
  let requests = 0;
  const translate = createOpenAITranslateClient({
    baseUrl: "https://openai.example/v1",
    apiKey: "secret",
    model: "translation-model",
    fetchImpl: async () => {
      requests += 1;
      return new Response(JSON.stringify({ error: "bad request" }), { status: 400 });
    },
  });
  await assert.rejects(() => translate({ text: "你好", sourceLang: "ZH", targetLang: "EN" }), /HTTP 400/);
  assert.equal(requests, 1);
});

test("translation script keeps an OpenAI segment fallback for complete Markdown documents", async () => {
  const source = await readFile(new URL("../scripts/translate.mjs", import.meta.url), "utf8");
  assert.match(source, /using segment fallback/);
  assert.match(source, /collectMarkdownSegments\(source\.content\)/);
  assert.match(source, /replaceMarkdownSegments\(source\.content, translatedSegments\)/);
  assert.doesNotMatch(source, /imageLabels\[imageIndex\+\+\]/);
});

test("translation script skips Markdown documents explicitly marked unpublished", async () => {
  const source = await readFile(new URL("../scripts/translate.mjs", import.meta.url), "utf8");
  assert.match(source, /matter\(raw\.replace\(\/\^\\uFEFF\/, ""\)\)\.data\.published === false/);
});

test("translation script continuously reports translation progress", async () => {
  const source = await readFile(new URL("../scripts/translate.mjs", import.meta.url), "utf8");
  assert.match(source, /\[translate\].*\$\{manifestKey\}.*started/);
  assert.match(source, /\[translate\].*\$\{manifest\.updated\}.*updated/);
  assert.match(source, /setInterval/);
  assert.match(source, /\$\{activeRequests\} active/);
  assert.doesNotMatch(source, /manifest\.updated % 25/);
});

test("deployment passes OpenAI translation secrets to the build", async () => {
  const workflow = await readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  assert.match(workflow, /OPENAI_BASE_URL:\s*\$\{\{ secrets\.OPENAI_BASE_URL \}\}/);
  assert.match(workflow, /API_KEY:\s*\$\{\{ secrets\.API_KEY \}\}/);
  assert.match(workflow, /MODEL:\s*\$\{\{ secrets\.MODEL \}\}/);
  assert.doesNotMatch(workflow, /DEEPLX|SERVICE_TYPE/);
});
