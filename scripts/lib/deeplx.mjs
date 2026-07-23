const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const createDeepLxClient = ({ baseUrl, apiKey, fetchImpl = fetch, retries = 3, timeoutMs = 30_000 }) => {
  const normalizedBaseUrl = baseUrl?.replace(/\/+$/, "");
  const endpoint = normalizedBaseUrl?.endsWith("/translate") ? normalizedBaseUrl : `${normalizedBaseUrl}/translate`;

  return async ({ text, sourceLang, targetLang }) => {
    if (!normalizedBaseUrl || !apiKey) {
      throw new Error("DEEPLX_BASE_URL and DEEPLX_API_KEY are required when translations are missing or stale.");
    }

    let lastError;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ text, source_lang: sourceLang, target_lang: targetLang }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const payload = await response.json().catch(() => undefined);
        if (!response.ok) {
          const error = new Error(`DeepLX returned HTTP ${response.status}.`);
          error.status = response.status;
          throw error;
        }
        if (!payload || typeof payload.data !== "string" || !payload.data.trim()) {
          throw new Error("DeepLX returned an invalid or empty translation.");
        }
        return payload.data;
      } catch (error) {
        lastError = error;
        if (error?.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) break;
        if (attempt < retries) await sleep(250 * 2 ** (attempt - 1));
      }
    }

    throw lastError;
  };
};
