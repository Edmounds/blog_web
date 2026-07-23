import assert from "node:assert/strict";
import test from "node:test";

import { createTranslationProvider } from "../scripts/lib/translation-provider.mjs";

test("translation provider selects OpenAI", () => {
  const provider = createTranslationProvider({
    env: { SERVICE_TYPE: " OpenAI ", OPENAI_BASE_URL: "https://example.com/v1", API_KEY: "secret", MODEL: "model" },
  });
  assert.equal(provider.name, "OpenAI");
});

test("translation provider defaults to DeepLX", () => {
  const provider = createTranslationProvider({ env: { DEEPLX_BASE_URL: "https://example.com", DEEPLX_API_KEY: "secret" } });
  assert.equal(provider.name, "DeepLX");
});

test("translation provider rejects unsupported service types", () => {
  assert.throws(() => createTranslationProvider({ env: { SERVICE_TYPE: "other" } }), /Unsupported SERVICE_TYPE/);
});
