import {
  ART_TRANSLATED_TYPES,
  error,
  json,
  normalizeArtType,
  readJson,
  requireSameOriginJson,
} from "../../../art.js";

const TARGETS = { "zh-TW": "ZH-TW", en: "EN", ja: "JA" };
const TRANSLATED_TYPES = new Set(ART_TRANSLATED_TYPES);

export async function onRequestPost({ env, request }) {
  try {
    requireSameOriginJson(request);
    const body = await readJson(request);
    const type = normalizeArtType(body?.type);
    if (!type || !TRANSLATED_TYPES.has(type))
      return error(
        400,
        "INVALID_TRANSLATION_TYPE",
        "仅书籍和电影支持自动翻译。",
      );
    const title = text(body?.title, 200);
    const creator = text(body?.creator, 200);
    const extra = text(body?.extra, 500, true);
    if (!title || !creator)
      return error(
        400,
        "INVALID_TRANSLATION_SOURCE",
        "简中标题和作者不能为空。",
      );

    const translations = {};
    const warnings = [];
    for (const [locale, targetLang] of Object.entries(TARGETS)) {
      try {
        const result = await translateFields(
          env,
          { title, creator, extra },
          targetLang,
        );
        translations[locale] = result;
      } catch (err) {
        console.error(`Art translation failed for ${locale}`, err);
        warnings.push(locale);
      }
    }
    return json({ translations, warnings });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Art translation failed", err);
    return error(500, "TRANSLATION_FAILED", "自动翻译失败，请手动填写。");
  }
}

async function translateFields(env, fields, targetLang) {
  const payload = JSON.stringify(fields);
  try {
    const translated = await primaryTranslate(env, payload, targetLang);
    return parseFields(translated);
  } catch (primaryError) {
    const translated = await googleTranslate(payload, targetLang);
    try {
      return parseFields(translated);
    } catch {
      throw primaryError;
    }
  }
}

async function primaryTranslate(env, textValue, targetLang) {
  const baseUrl = String(env.OPENAI_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  const apiKey = String(env.API_KEY ?? "").trim();
  const model = String(env.MODEL ?? "").trim();
  const reasoningEffort = String(env.REASONING_EFFORT ?? "").trim();
  if (!baseUrl || !apiKey || !model)
    throw new Error("OpenAI translation is not configured.");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Translate the JSON string values. Return only valid JSON with the same title, creator, and extra keys.",
        },
        {
          role: "user",
          content: `Target language: ${targetLang}\nJSON: ${textValue}`,
        },
      ],
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(`OpenAI translation returned ${response.status}.`);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI translation response was empty.");
  return content;
}

async function googleTranslate(value, targetLang) {
  const body = new URLSearchParams({
    client: "gtx",
    sl: "zh-CN",
    tl: targetLang.toLowerCase(),
    dt: "t",
    q: value,
  });
  const response = await fetch(
    "https://translate.googleapis.com/translate_a/single",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok)
    throw new Error(`Google Translate returned ${response.status}.`);
  const data = await response.json();
  const translated = Array.isArray(data?.[0])
    ? data[0].map((part) => part?.[0] ?? "").join("")
    : "";
  if (!translated.trim())
    throw new Error("Google Translate response was empty.");
  return translated;
}

function parseFields(value) {
  const match = String(value).match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match?.[0] ?? value);
  const title = text(parsed.title, 200);
  const creator = text(parsed.creator, 200);
  const extra = text(parsed.extra, 500, true);
  if (!title || !creator) throw new Error("Translated fields were invalid.");
  return { title, creator, extra };
}

function text(value, limit, allowEmpty = false) {
  if (typeof value !== "string") return allowEmpty ? "" : undefined;
  const result = value.trim();
  if ((!result && !allowEmpty) || Array.from(result).length > limit)
    return undefined;
  return result;
}
