const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const TARGET_LANGUAGE_NAMES = {
  EN: "English",
  JA: "Japanese",
  "ZH-TW": "Traditional Chinese (Taiwan)",
};

export const createOpenAITranslateClient = ({
  baseUrl,
  apiKey,
  model,
  fetchImpl = fetch,
  retries = 3,
  timeoutMs = 120_000,
}) => {
  const normalizedBaseUrl = baseUrl?.trim().replace(/\/+$/, "");
  const endpoint = normalizedBaseUrl ? `${normalizedBaseUrl}/chat/completions` : undefined;

  return async ({ text, sourceLang, targetLang, format = "text", preserveFrontmatterKeys = [] }) => {
    if (!normalizedBaseUrl || !apiKey?.trim() || !model?.trim()) {
      throw new Error("OPENAI_BASE_URL, API_KEY, and MODEL are required when translations are missing or stale.");
    }

    const targetLanguage = TARGET_LANGUAGE_NAMES[targetLang] ?? targetLang;
    const systemPrompt = format === "markdown-document"
      ? [
          "Translate the complete Markdown document accurately so terminology and tone remain consistent across the whole document.",
          "Preserve the YAML frontmatter delimiters and field names, Markdown structure, links, image paths, HTML, inline code, and code blocks.",
          "Do not change URLs, paths, slugs, identifiers, dates, booleans, or numbers.",
          preserveFrontmatterKeys.length
            ? `Keep the values of these YAML frontmatter fields unchanged: ${preserveFrontmatterKeys.join(", ")}.`
            : "",
          "Return only the complete translated document without explanations or code fences.",
        ].filter(Boolean).join(" ")
      : "Translate the user's text accurately. Preserve Markdown and formatting. Return only the translated text without explanations or quotation marks.";
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: `Source language: ${sourceLang}\nTarget language: ${targetLanguage}\n\n${text}`,
              },
            ],
            temperature: 0,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const payload = await response.json().catch(() => undefined);
        if (!response.ok) {
          const error = new Error(`OpenAI-compatible API returned HTTP ${response.status}.`);
          error.status = response.status;
          throw error;
        }
        const translation = payload?.choices?.[0]?.message?.content;
        if (typeof translation !== "string" || !translation.trim()) {
          throw new Error("OpenAI-compatible API returned an invalid or empty translation.");
        }
        return translation.trim();
      } catch (error) {
        lastError = error;
        if (error?.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) break;
        if (attempt < retries) await sleep(250 * 2 ** (attempt - 1));
      }
    }

    throw lastError;
  };
};
