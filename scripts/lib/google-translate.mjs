const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const createGoogleTranslateClient = ({ fetchImpl = fetch, retries = 3, timeoutMs = 30_000 } = {}) =>
  async ({ text, sourceLang, targetLang }) => {
    const body = new URLSearchParams({
      client: "gtx",
      sl: sourceLang.toLowerCase(),
      tl: targetLang.toLowerCase(),
      dt: "t",
      q: text,
    });

    let lastError;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const response = await fetchImpl("https://translate.googleapis.com/translate_a/single", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
        const payload = await response.json().catch(() => undefined);
        if (!response.ok) throw new Error(`Google Translate returned HTTP ${response.status}.`);
        if (!Array.isArray(payload?.[0])) throw new Error("Google Translate returned an invalid response.");
        const translation = payload[0]
          .map((part) => Array.isArray(part) && typeof part[0] === "string" ? part[0] : "")
          .join("");
        if (!translation.trim()) throw new Error("Google Translate returned an empty translation.");
        return translation;
      } catch (error) {
        lastError = error;
        if (attempt < retries) await sleep(300 * 2 ** (attempt - 1));
      }
    }

    throw lastError;
  };

