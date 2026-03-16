const DEFAULT_MODEL = "gemini:gemini-3-flash-preview";
const GEMINI_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GLM_ENDPOINT = "https://api.z.ai/api/coding/paas/v4/chat/completions";
const DEFAULT_TEMPERATURE = 0.7;
const RATE_LIMIT_WINDOW_MS = 2000;

let lastGenerateAt = 0;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) {
    sendResponse({ ok: false, error: "Unknown request type." });
    return;
  }

  if (message.type === "FETCH_IMAGE") {
    handleFetchImage(message)
      .then((payload) => sendResponse({ ok: true, data: payload }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GENERATE_REPLIES") {
    handleGenerateReplies(message)
      .then((payload) => sendResponse({ ok: true, data: payload }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GENERATE_POST_DRAFTS") {
    handleGeneratePostDrafts(message)
      .then((payload) => sendResponse({ ok: true, data: payload }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  sendResponse({ ok: false, error: "Unsupported request type." });
});

async function handleFetchImage(message) {
  const imageUrl = message?.url;
  if (!imageUrl) {
    throw new Error("Image URL is missing.");
  }

  const response = await fetch(imageUrl, { method: "GET", mode: "cors" });
  if (!response.ok) {
    throw new Error(`Image fetch failed (${response.status}).`);
  }

  const mimeType = response.headers.get("content-type") || "image/jpeg";
  const buffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  return {
    mimeType,
    data: base64
  };
}

async function handleGenerateReplies(message) {
  await enforceRateLimit();

  const settings = await getSettings();
  const replyModel = parseModelChoice(settings.replyModel, DEFAULT_MODEL);
  const apiKey = getApiKeyForProvider(settings, replyModel.provider);
  ensureApiKey(apiKey, replyModel.provider);

  const tweet = message?.tweet;
  if (!tweet?.text?.trim()) {
    throw new Error("Post text is missing.");
  }

  const rawText = await generateForReplies(tweet, settings, replyModel, apiKey);
  const replies = coerceStringArray(rawText, "replies");

  if (replies.length < 4) {
    const providerMessage = extractProviderMessage(rawText);
    if (providerMessage) {
      throw new Error(`${providerDisplayName(replyModel.provider)}: ${truncateMessage(providerMessage, 320)}`);
    }
    throw new Error(`${providerDisplayName(replyModel.provider)} returned an unexpected format. Try regenerate.`);
  }

  return {
    replies: replies.slice(0, 4)
  };
}

async function handleGeneratePostDrafts(message) {
  await enforceRateLimit();

  const settings = await getSettings();
  const draftModel = parseModelChoice(settings.draftModel, DEFAULT_MODEL);
  const apiKey = getApiKeyForProvider(settings, draftModel.provider);
  ensureApiKey(apiKey, draftModel.provider);

  const brainDump = String(message?.brainDump || "").trim();
  if (!brainDump) {
    throw new Error("Brain dump text is missing.");
  }

  const rawText = await generateForDrafts(brainDump, message?.context || {}, settings, draftModel, apiKey);
  const drafts = coerceStringArray(rawText, "drafts");

  if (drafts.length < 4) {
    const providerMessage = extractProviderMessage(rawText);
    if (providerMessage) {
      throw new Error(`${providerDisplayName(draftModel.provider)}: ${truncateMessage(providerMessage, 320)}`);
    }
    throw new Error(
      `${providerDisplayName(draftModel.provider)} returned an unexpected draft format. Try regenerate.`
    );
  }

  return {
    drafts: drafts.slice(0, 4)
  };
}

async function generateForReplies(tweet, settings, modelChoice, apiKey) {
  const prompt = buildReplyPrompt(tweet, settings);

  if (modelChoice.provider === "glm") {
    const payload = buildGlmPayload(modelChoice.model, prompt.systemInstruction, prompt.userText, settings);
    const response = await fetchWithRetry(
      GLM_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      },
      1
    );

    if (!response.ok) {
      await throwProviderError(response, modelChoice.provider);
    }

    const data = await response.json();
    return extractGlmText(data);
  }

  const payload = buildGeminiReplyPayload(modelChoice.model, tweet, prompt.systemInstruction, prompt.userText, settings);
  const url = `${GEMINI_ENDPOINT_BASE}/${modelChoice.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    1
  );

  if (!response.ok) {
    await throwProviderError(response, modelChoice.provider);
  }

  const data = await response.json();
  return extractGeminiText(data);
}

async function generateForDrafts(brainDump, context, settings, modelChoice, apiKey) {
  const prompt = buildDraftPrompt(brainDump, context, settings);

  if (modelChoice.provider === "glm") {
    const payload = buildGlmPayload(modelChoice.model, prompt.systemInstruction, prompt.userText, settings);
    const response = await fetchWithRetry(
      GLM_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      },
      1
    );

    if (!response.ok) {
      await throwProviderError(response, modelChoice.provider);
    }

    const data = await response.json();
    return extractGlmText(data);
  }

  const payload = buildGeminiDraftPayload(modelChoice.model, prompt.systemInstruction, prompt.userText, settings);
  const url = `${GEMINI_ENDPOINT_BASE}/${modelChoice.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    1
  );

  if (!response.ok) {
    await throwProviderError(response, modelChoice.provider);
  }

  const data = await response.json();
  return extractGeminiText(data);
}

function buildReplyPrompt(tweet, settings) {
  const userInstruction = settings.customInstructions?.trim()
    ? `Additional custom instructions from Aditya:\n${settings.customInstructions.trim()}`
    : "No additional custom instructions provided.";

  const systemInstruction = [
    "You are Linx, a reply strategist for Aditya (@AdityaSaini_44).",
    "Aditya is 20 years old and building AI agent swarms at getlucian.com.",
    "Topics and niche: AI agents, Tesla Optimus, SpaceX, robotics, and frontier technology.",
    "Voice and tone requirements:",
    "- insightful and concise",
    "- builder energy",
    "- slightly opinionated but genuine",
    "- value-adding and optimistic",
    "- natural, human, and specific (not polished corporate AI voice)",
    "Rules:",
    "- Never sound generic, cringy, or sycophantic",
    "- Avoid hashtags and emojis unless explicitly required by user context",
    "- Replies should feel human and specific to the post",
    "- It is good to take a clear stance or opinion when relevant",
    "- Do not end most replies with questions",
    "- At most 1 of the 4 replies can end with a question",
    "- Avoid open-ended filler like 'Thoughts?' or 'What do you think?'",
    "- Produce exactly 4 distinct reply options with varied angles and lengths",
    "- Include this mix: one direct opinion, one strategic insight, one concise punchy line, one nuanced take",
    "- Keep each reply under 280 characters",
    "Return JSON only, with no markdown and no extra commentary.",
    "Use this exact format: {\"replies\":[\"...\",\"...\",\"...\",\"...\"]}",
    userInstruction
  ].join("\n");

  const userText = [
    `Post author: ${tweet.authorName || "Unknown"} (${tweet.authorHandle || "unknown"})`,
    `Post text: ${tweet.text}`,
    "Create 4 high-quality replies tailored to Aditya's style. Keep wording sharp and grounded."
  ].join("\n");

  return {
    systemInstruction,
    userText
  };
}

function buildGeminiReplyPayload(_model, tweet, systemInstruction, userText, settings) {
  const parts = [
    {
      text: userText
    }
  ];

  for (const image of tweet.images || []) {
    if (image?.data && image?.mimeType) {
      parts.push({
        inline_data: {
          mime_type: image.mimeType,
          data: image.data
        }
      });
    }
  }

  return {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: clampTemperature(settings.temperature),
      maxOutputTokens: 700
    }
  };
}

function buildDraftPrompt(brainDump, context, settings) {
  const userInstruction = settings.customInstructions?.trim()
    ? `Additional custom instructions from Aditya:\n${settings.customInstructions.trim()}`
    : "No additional custom instructions provided.";

  const systemInstruction = [
    "You are Linx Draft AI, writing X posts for Aditya (@AdityaSaini_44).",
    "Aditya is 20 years old and building AI agent swarms at getlucian.com.",
    "Topics and niche: AI agents, Tesla Optimus, SpaceX, robotics, and frontier technology.",
    "Writing goals:",
    "- Turn rough notes into clear, human-sounding posts",
    "- Keep each draft concise, specific, and opinionated when relevant",
    "- Sound like a builder sharing real insight, not polished corporate copy",
    "Rules:",
    "- Produce exactly 4 distinct draft options",
    "- Keep each draft <= 280 characters",
    "- Provide this mix: one primary clear post + three alternate angles",
    "- Avoid hashtags and emojis unless strongly relevant",
    "- No markdown, no numbering, no extra commentary",
    "Return JSON only, with this exact format: {\"drafts\":[\"...\",\"...\",\"...\",\"...\"]}",
    userInstruction
  ].join("\n");

  const contextLine = context?.surface ? `Composer surface: ${context.surface}` : "Composer surface: unknown";
  const userText = [contextLine, `Brain dump:\n${brainDump}`, "Rewrite this into 4 high-quality X post drafts."].join(
    "\n\n"
  );

  return {
    systemInstruction,
    userText
  };
}

function buildGeminiDraftPayload(_model, systemInstruction, userText, settings) {
  return {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      temperature: clampTemperature(settings.temperature),
      maxOutputTokens: 700
    }
  };
}

function buildGlmPayload(model, systemInstruction, userText, settings) {
  return {
    model,
    response_format: { type: "json_object" },
    // Structured reply generation does not need chain-of-thought output.
    // Disabling thinking avoids cases where GLM spends the entire token budget
    // in `reasoning_content` and leaves `message.content` empty.
    thinking: { type: "disabled" },
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userText }
    ],
    temperature: clampTemperature(settings.temperature),
    max_tokens: 700
  };
}

function extractGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
}

function extractGlmText(data) {
  const message = data?.choices?.[0]?.message;
  const content = message?.content;
  if (typeof content === "string" && content.trim()) {
    return content;
  }
  if (Array.isArray(content)) {
    const joined = content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item.text === "string") {
          return item.text;
        }
        if (item && typeof item.content === "string") {
          return item.content;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
    if (joined.trim()) {
      return joined;
    }
  }
  if (content && typeof content === "object") {
    try {
      const serialized = JSON.stringify(content);
      if (serialized.trim()) {
        return serialized;
      }
    } catch (_err) {
      // Fall through to reasoning fallback below.
    }
  }

  if (typeof message?.reasoning_content === "string" && message.reasoning_content.trim()) {
    return message.reasoning_content;
  }

  return "";
}

function coerceStringArray(raw, preferredKey) {
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.filter(Boolean).map((item) => String(item).trim());
  }

  if (typeof raw === "object") {
    return pickArrayFromParsed(raw, preferredKey);
  }

  const rawText = String(raw).trim();

  try {
    const parsed = JSON.parse(rawText);
    const items = pickArrayFromParsed(parsed, preferredKey);
    if (items.length) {
      return items;
    }
  } catch (_err) {
    // Fallback below.
  }

  const cleaned = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    const items = pickArrayFromParsed(parsed, preferredKey);
    if (items.length) {
      return items;
    }
  } catch (_err) {
    // Fallback below.
  }

  const jsonCandidates = cleaned.match(/\{[\s\S]*\}/g) || [];
  for (const candidate of jsonCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      const items = pickArrayFromParsed(parsed, preferredKey);
      if (items.length) {
        return items;
      }
    } catch (_err) {
      // Continue trying next candidate.
    }
  }

  return cleaned
    .split("\n")
    .map((line) => line.replace(/^\d+[\).\s-]*/, "").trim())
    .filter(Boolean);
}

function pickArrayFromParsed(parsed, preferredKey) {
  if (Array.isArray(parsed)) {
    return parsed.filter(Boolean).map((item) => String(item).trim());
  }

  const direct = parsed?.[preferredKey];
  if (Array.isArray(direct)) {
    return direct.filter(Boolean).map((item) => String(item).trim());
  }
  if (typeof direct === "string") {
    const maybeArray = tryParseStringArray(direct);
    if (maybeArray.length) {
      return maybeArray;
    }
  }

  if (Array.isArray(parsed?.replies)) {
    return parsed.replies.filter(Boolean).map((item) => String(item).trim());
  }
  if (Array.isArray(parsed?.drafts)) {
    return parsed.drafts.filter(Boolean).map((item) => String(item).trim());
  }
  if (typeof parsed?.replies === "string") {
    const maybeArray = tryParseStringArray(parsed.replies);
    if (maybeArray.length) {
      return maybeArray;
    }
  }
  if (typeof parsed?.drafts === "string") {
    const maybeArray = tryParseStringArray(parsed.drafts);
    if (maybeArray.length) {
      return maybeArray;
    }
  }

  return [];
}

function tryParseStringArray(value) {
  const text = String(value || "").trim();
  if (!text) {
    return [];
  }
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean).map((item) => String(item).trim());
    }
  } catch (_err) {
    // Fall through.
  }
  return text
    .split("\n")
    .map((line) => line.replace(/^\d+[\).\s-]*/, "").trim())
    .filter(Boolean);
}

function extractProviderMessage(raw) {
  if (!raw) {
    return "";
  }

  if (typeof raw === "object") {
    const direct = extractMessageFromParsed(raw);
    return direct.trim();
  }

  const text = String(raw).trim();
  if (!text) {
    return "";
  }

  try {
    const parsed = JSON.parse(text);
    const fromParsed = extractMessageFromParsed(parsed);
    if (fromParsed) {
      return fromParsed.trim();
    }
  } catch (_err) {
    // Continue below.
  }

  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const jsonCandidates = cleaned.match(/\{[\s\S]*\}/g) || [];
  for (const candidate of jsonCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      const fromParsed = extractMessageFromParsed(parsed);
      if (fromParsed) {
        return fromParsed.trim();
      }
    } catch (_err) {
      // Try next candidate.
    }
  }

  return cleaned;
}

function extractMessageFromParsed(parsed) {
  if (!parsed) {
    return "";
  }

  if (typeof parsed === "string") {
    return parsed;
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item) => extractMessageFromParsed(item)).filter(Boolean).join("\n");
  }

  if (typeof parsed.answer === "string") {
    return parsed.answer;
  }

  if (typeof parsed.message === "string") {
    return parsed.message;
  }

  if (typeof parsed.content === "string") {
    return parsed.content;
  }

  if (typeof parsed.reasoning_content === "string") {
    return parsed.reasoning_content;
  }

  if (parsed.message && typeof parsed.message === "object") {
    const nested = extractMessageFromParsed(parsed.message);
    if (nested) {
      return nested;
    }
  }

  if (Array.isArray(parsed.choices)) {
    const nested = extractMessageFromParsed(parsed.choices[0]);
    if (nested) {
      return nested;
    }
  }

  if (Array.isArray(parsed.replies)) {
    return parsed.replies.join("\n");
  }

  if (Array.isArray(parsed.drafts)) {
    return parsed.drafts.join("\n");
  }

  return "";
}

function truncateMessage(text, maxChars) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars - 1)}…`;
}

async function getSettings() {
  const stored = await chrome.storage.sync.get({
    apiKey: "",
    geminiApiKey: "",
    glmApiKey: "",
    replyModel: DEFAULT_MODEL,
    draftModel: DEFAULT_MODEL,
    customInstructions: "",
    temperature: DEFAULT_TEMPERATURE
  });
  if (!stored.geminiApiKey && stored.apiKey) {
    stored.geminiApiKey = stored.apiKey;
  }
  return stored;
}

function parseModelChoice(rawValue, fallbackValue) {
  const value = String(rawValue || fallbackValue || DEFAULT_MODEL);
  if (!value.includes(":")) {
    return { provider: "gemini", model: value.trim() || "gemini-3-flash-preview" };
  }
  const [providerRaw, ...modelParts] = value.split(":");
  const provider = providerRaw === "glm" ? "glm" : "gemini";
  const model = modelParts.join(":").trim();

  if (!model) {
    const [fallbackProvider, ...fallbackModelParts] = String(fallbackValue || DEFAULT_MODEL).split(":");
    return {
      provider: fallbackProvider === "glm" ? "glm" : "gemini",
      model: fallbackModelParts.join(":")
    };
  }

  return { provider, model };
}

function getApiKeyForProvider(settings, provider) {
  if (provider === "glm") {
    return String(settings.glmApiKey || "").trim();
  }
  return String(settings.geminiApiKey || settings.apiKey || "").trim();
}

function ensureApiKey(apiKey, provider) {
  if (apiKey) {
    return;
  }
  if (provider === "glm") {
    throw new Error("GLM API key is missing. Add it in extension settings.");
  }
  throw new Error("Gemini API key is missing. Add it in extension settings.");
}

async function fetchWithRetry(url, init, retriesOn429 = 1) {
  let response = await fetch(url, init);
  let retries = 0;
  while (response.status === 429 && retries < retriesOn429) {
    retries += 1;
    await delay(1200);
    response = await fetch(url, init);
  }
  return response;
}

async function throwProviderError(response, provider) {
  const errorBody = await safeJson(response);
  const messageText =
    errorBody?.error?.message ||
    `${providerDisplayName(provider)} request failed (${response.status}). Check your key and network.`;
  throw new Error(messageText);
}

function providerDisplayName(provider) {
  return provider === "glm" ? "GLM" : "Gemini";
}

async function enforceRateLimit() {
  const now = Date.now();
  const delta = now - lastGenerateAt;
  if (delta < RATE_LIMIT_WINDOW_MS) {
    await delay(RATE_LIMIT_WINDOW_MS - delta);
  }
  lastGenerateAt = Date.now();
}

function clampTemperature(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return DEFAULT_TEMPERATURE;
  }
  return Math.max(0, Math.min(1.5, numeric));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (_err) {
    return null;
  }
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
