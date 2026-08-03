const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const readResponseBody = async (response, resetTimeout) => {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value.length) resetTimeout();
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
};

const readStreamedTranslation = async (response, resetTimeout) => {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let translation = "";

  const consumeEvent = (event) => {
    const data = event.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return;
    const content = JSON.parse(data)?.choices?.[0]?.delta?.content;
    if (typeof content === "string") translation += content;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value.length) resetTimeout();
    pending += decoder.decode(value, { stream: true });
    while (true) {
      const separator = pending.match(/\r?\n\r?\n/);
      if (!separator || separator.index === undefined) break;
      consumeEvent(pending.slice(0, separator.index));
      pending = pending.slice(separator.index + separator[0].length);
    }
  }
  pending += decoder.decode();
  if (pending.trim()) consumeEvent(pending);
  return translation;
};

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
      const controller = new AbortController();
      let timeout;
      const resetTimeout = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => controller.abort(), timeoutMs);
      };
      try {
        resetTimeout();
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
            stream: true,
          }),
          signal: controller.signal,
        });
        resetTimeout();
        if (!response.ok) {
          const error = new Error(`OpenAI-compatible API returned HTTP ${response.status}.`);
          error.status = response.status;
          throw error;
        }
        let translation;
        try {
          translation = (response.headers.get("content-type") ?? "").includes("text/event-stream")
            ? await readStreamedTranslation(response, resetTimeout)
            : JSON.parse(await readResponseBody(response, resetTimeout))?.choices?.[0]?.message?.content;
        } catch (error) {
          if (controller.signal.aborted) throw controller.signal.reason ?? error;
          throw new Error("OpenAI-compatible API returned an invalid translation response.");
        }
        if (typeof translation !== "string" || !translation.trim()) {
          throw new Error("OpenAI-compatible API returned an invalid or empty translation.");
        }
        return translation.trim();
      } catch (error) {
        lastError = error;
        if (error?.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) break;
        if (attempt < retries) await sleep(250 * 2 ** (attempt - 1));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError;
  };
};
