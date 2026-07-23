import { createDeepLxClient } from "./deeplx.mjs";
import { createOpenAITranslateClient } from "./openai-translate.mjs";

export const createTranslationProvider = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const serviceType = (env.SERVICE_TYPE ?? "deeplx").trim().toLowerCase();

  if (serviceType === "deeplx") {
    return {
      name: "DeepLX",
      translate: createDeepLxClient({
        baseUrl: env.DEEPLX_BASE_URL,
        apiKey: env.DEEPLX_API_KEY,
        fetchImpl,
      }),
    };
  }

  if (serviceType === "openai") {
    return {
      name: "OpenAI",
      translate: createOpenAITranslateClient({
        baseUrl: env.OPENAI_BASE_URL,
        apiKey: env.API_KEY,
        model: env.MODEL,
        fetchImpl,
      }),
    };
  }

  throw new Error(`Unsupported SERVICE_TYPE "${env.SERVICE_TYPE}". Expected "openai" or "deeplx".`);
};
