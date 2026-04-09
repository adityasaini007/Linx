const DEFAULT_MODEL = "";
const OPENROUTER_CHAT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
const DEFAULT_TEMPERATURE = 0.7;
const RATE_LIMIT_WINDOW_MS = 2000;
const PROFILE_VERSION = 2;
const PROVIDER_VERSION = 1;
const MAX_SYSTEM_PROMPT_CHARS = 9000;

// Anti-AI Style Guide: Rules to make output sound human, not robotic
const ANTI_AI_STYLE_GUIDE = `
CRITICAL STYLE RULES — Your replies must sound like a real person typed them quickly.

VOICE & TONE:
- Write like you're texting a friend who's also in tech, not writing an essay
- Casual, conversational, slightly messy is GOOD
- Lowercase is fine, especially for emphasis ("kinda", "tbh", "ngl")
- Contractions always (i'd, that's, don't, won't, can't)
- Start with "Yeah", "Honestly", "Man", "Ok so", "Ngl" — real conversation starters
- Short punchy thoughts > long structured sentences
- It's okay to trail off or switch thoughts mid-reply

BANNED PATTERNS (these scream AI):
- "The [X] here is unmatched/incredible/elite" — too formal
- "Best-in-class", "friction point", "sustainable for" — corporate speak
- "I've found that", "It's a necessary trade-off" — essay tone
- "Integrating [X] could be the bridge to" — way too polished
- Any sentence that sounds like a LinkedIn post
- Perfect grammar and punctuation throughout
- Structured argument format (point, evidence, conclusion)

GOOD REPLY EXAMPLES (study these closely):

Example 1 - Casual agreement + personal experience:
POST: "Claude Code is expensive but the quality is unreal"
GOOD: "Yeah i'd use it for everything if i could afford it! the reasoning is genuinely excellent. been mixing it with cheaper models for the grunt work"
BAD: "The quality is unmatched, but the token costs make it unsustainable for daily usage. Integrating cost-effective alternatives could be the bridge to making this viable."

Example 2 - Quick take with analogy:
POST: "Cursor vs Windsurf - which one?"
GOOD: "cursor for speed, windsurf if you want more control. kinda like vscode vs intellij vibes"
BAD: "Both tools have their merits. Cursor excels in rapid prototyping while Windsurf offers more granular control over the development workflow."

Example 3 - Disagreement, kept casual:
POST: "AI coding tools are overhyped"
GOOD: "idk man, shipped 3 features today that would've taken me a week. maybe depends on the use case?"
BAD: "I respectfully disagree. AI coding tools have significantly accelerated my development workflow and increased productivity."

Example 4 - Adding context without being formal:
POST: "Why is no one talking about Gemini 2.5?"
GOOD: "the context window is insane tbh. been using it for whole-codebase stuff where claude would choke"
BAD: "Gemini 2.5 offers an impressive context window that enables comprehensive codebase analysis, which represents a significant advancement."

Example 5 - Enthusiasm without cringe:
POST: "Just launched my first AI app"
GOOD: "lets go! what stack did you use? been thinking about building something similar"
BAD: "Congratulations on your launch! This is a great achievement. I'd love to hear more about your development journey."

FORMATTING RULES:
- Max 1-2 sentences usually, 3 if you're adding real context
- No periods at the end sometimes, feels more casual
- Emoji only if you'd actually use it (most tech replies = no emoji)
- Never use hashtags
- Questions are fine but make them genuine curiosity, not engagement bait

AUTHENTICITY TEST:
Read your reply out loud. If it sounds like something a LinkedIn influencer would post, rewrite it.
If it sounds like a quick message in a Discord server or group chat, you're on track.
`.trim();

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

  if (message.type === "FETCH_OPENROUTER_MODELS") {
    handleFetchOpenRouterModels(message)
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

  if (message.type === "BUILD_SYSTEM_PROMPTS") {
    handleBuildSystemPrompts(message)
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

async function handleFetchOpenRouterModels(message) {
  const settings = await getSettings();
  const apiKey = String(message?.apiKey || settings.openrouterApiKey || "").trim();
  const forceRefresh = Boolean(message?.forceRefresh);
  ensureApiKey(apiKey);

  const cached = sanitizeOpenRouterModelsCache(settings.openrouterModelsCache);
  if (!forceRefresh && cached.models.length) {
    return {
      models: cached.models,
      fetchedAt: cached.fetchedAt,
      fromCache: true,
      warning: "Using cached OpenRouter model list."
    };
  }

  try {
    const models = await fetchOpenRouterModels(apiKey);
    const payload = {
      models,
      fetchedAt: Date.now()
    };
    await chrome.storage.local.set({ openrouterModelsCache: payload });
    return {
      ...payload,
      fromCache: false,
      warning: ""
    };
  } catch (error) {
    if (cached.models.length) {
      return {
        models: cached.models,
        fetchedAt: cached.fetchedAt,
        fromCache: true,
        warning: `Model refresh failed: ${error.message}. Using cached models.`
      };
    }
    throw error;
  }
}

async function handleGenerateReplies(message) {
  await enforceRateLimit();

  const settings = await getSettings();
  const model = parseModelChoice(settings.replyModel, DEFAULT_MODEL);
  ensureModelSelected(model);
  ensureApiKey(settings.openrouterApiKey);

  const post = message?.post || message?.tweet;
  if (!post?.text?.trim()) {
    throw new Error("Post text is missing.");
  }

  const userOpinion = String(message?.userOpinion || "").trim();
  if (!userOpinion) {
    throw new Error("Add your take before generating replies.");
  }
  const rawText = await generateForReplies(post, settings, model, settings.openrouterApiKey, userOpinion);
  const replies = coerceStringArray(rawText, "replies");

  if (replies.length < 4) {
    const providerMessage = extractProviderMessage(rawText);
    if (providerMessage) {
      throw new Error(`OpenRouter: ${truncateMessage(providerMessage, 320)}`);
    }
    throw new Error("OpenRouter returned an unexpected format. Try regenerate.");
  }

  return {
    replies: replies.slice(0, 4)
  };
}

async function handleGeneratePostDrafts(message) {
  await enforceRateLimit();

  const settings = await getSettings();
  const model = parseModelChoice(settings.draftModel, DEFAULT_MODEL);
  ensureModelSelected(model);
  ensureApiKey(settings.openrouterApiKey);

  const brainDump = String(message?.brainDump || "").trim();
  if (!brainDump) {
    throw new Error("Brain dump text is missing.");
  }

  const rawText = await generateForDrafts(brainDump, message?.context || {}, settings, model, settings.openrouterApiKey);
  const drafts = coerceStringArray(rawText, "drafts");

  if (drafts.length < 4) {
    const providerMessage = extractProviderMessage(rawText);
    if (providerMessage) {
      throw new Error(`OpenRouter: ${truncateMessage(providerMessage, 320)}`);
    }
    throw new Error("OpenRouter returned an unexpected draft format. Try regenerate.");
  }

  return {
    drafts: drafts.slice(0, 4)
  };
}

async function handleBuildSystemPrompts(message) {
  const stored = await getSettings();
  const answers = sanitizeProfileAnswers(message?.answers || stored.profileAnswers);
  const existingPrompts = sanitizeSystemPrompts(stored.systemPrompts);
  const targetPlatform = message?.targetPlatform === "linkedin" || message?.targetPlatform === "x"
    ? message.targetPlatform
    : null;
  const now = Date.now();

  const nextPrompts = {
    ...existingPrompts,
    reply: { ...existingPrompts.reply },
    draft: { ...existingPrompts.draft }
  };

  const platforms = targetPlatform ? [targetPlatform] : ["linkedin", "x"];
  for (const platform of platforms) {
    nextPrompts.reply[platform] = {
      text: buildPersonalizedSystemPrompt({
        platform,
        mode: "reply",
        answers,
        customInstructions: stored.customInstructions
      }),
      isUserEdited: false,
      lastGeneratedAt: now
    };
    nextPrompts.draft[platform] = {
      text: buildPersonalizedSystemPrompt({
        platform,
        mode: "draft",
        answers,
        customInstructions: stored.customInstructions
      }),
      isUserEdited: false,
      lastGeneratedAt: now
    };
  }

  return {
    profileAnswers: answers,
    systemPrompts: nextPrompts
  };
}

async function generateForReplies(post, settings, model, apiKey, userOpinion = "") {
  const prompt = buildReplyPrompt(post, settings, userOpinion);
  const payload = buildOpenRouterReplyPayload(model, post, prompt.systemInstruction, prompt.userText, settings);
  const response = await fetchWithRetry(
    OPENROUTER_CHAT_ENDPOINT,
    {
      method: "POST",
      headers: buildOpenRouterHeaders(apiKey),
      body: JSON.stringify(payload)
    },
    1
  );

  if (!response.ok) {
    await throwProviderError(response);
  }

  const data = await response.json();
  return extractOpenRouterText(data);
}

async function generateForDrafts(brainDump, context, settings, model, apiKey) {
  const prompt = buildDraftPrompt(brainDump, context, settings);
  const payload = buildOpenRouterDraftPayload(model, prompt.systemInstruction, prompt.userText, settings);
  const response = await fetchWithRetry(
    OPENROUTER_CHAT_ENDPOINT,
    {
      method: "POST",
      headers: buildOpenRouterHeaders(apiKey),
      body: JSON.stringify(payload)
    },
    1
  );

  if (!response.ok) {
    await throwProviderError(response);
  }

  const data = await response.json();
  return extractOpenRouterText(data);
}

function buildReplyPrompt(post, settings, userOpinion = "") {
  const platform = normalizePlatform(post?.platform);
  const label = platformLabel(platform);
  const systemInstruction = resolveSystemInstruction({
    settings,
    platform,
    mode: "reply"
  });

  const opinionLine = `User's thoughts/opinion: ${userOpinion}`;
  const instruction = "Create 4 replies that articulate and express this viewpoint. Stay true to the user's opinion while varying the style and length.";

  const userText = [
    `Platform: ${label}`,
    `Post author: ${post.authorName || "Unknown"} (${post.authorHandle || "unknown"})`,
    `Post text: ${post.text}`,
    opinionLine,
    instruction
  ].filter(Boolean).join("\n");

  return {
    systemInstruction,
    userText
  };
}

function buildOpenRouterReplyPayload(model, post, systemInstruction, userText, settings) {
  const content = [{ type: "text", text: userText }];

  for (const image of post.images || []) {
    if (image?.data && image?.mimeType) {
      content.push({
        type: "image_url",
        image_url: {
          url: `data:${image.mimeType};base64,${image.data}`
        }
      });
    }
  }

  return {
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content }
    ],
    temperature: clampTemperature(settings.temperature),
    max_tokens: 700
  };
}

function buildDraftPrompt(brainDump, context, settings) {
  const platform = normalizePlatform(context?.platform);
  const label = platformLabel(platform);
  const systemInstruction = resolveSystemInstruction({
    settings,
    platform,
    mode: "draft"
  });

  const contextLines = [
    `Platform: ${label}`,
    context?.surface ? `Composer surface: ${context.surface}` : "Composer surface: unknown"
  ];
  const userText = [
    contextLines.join("\n"),
    `Brain dump:\n${brainDump}`,
    `Rewrite this into 4 high-quality ${label} post drafts.`
  ].join("\n\n");

  return {
    systemInstruction,
    userText
  };
}

function buildOpenRouterDraftPayload(model, systemInstruction, userText, settings) {
  return {
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userText }
    ],
    temperature: clampTemperature(settings.temperature),
    max_tokens: 700
  };
}

function buildOpenRouterHeaders(apiKey) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "X-Title": "Linx"
  };
}

async function fetchOpenRouterModels(apiKey) {
  const response = await fetchWithRetry(
    OPENROUTER_MODELS_ENDPOINT,
    {
      method: "GET",
      headers: buildOpenRouterHeaders(apiKey)
    },
    1
  );

  if (!response.ok) {
    await throwProviderError(response);
  }

  const data = await response.json();
  const list = Array.isArray(data?.data) ? data.data : [];

  const normalized = list
    .map(normalizeOpenRouterModel)
    .filter(Boolean)
    .sort((a, b) => {
      if (a.isFree !== b.isFree) {
        return a.isFree ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  if (!normalized.length) {
    throw new Error("OpenRouter returned no models for this API key.");
  }

  return normalized;
}

function normalizeOpenRouterModel(raw) {
  const id = String(raw?.id || "").trim();
  if (!id) {
    return null;
  }

  const name = String(raw?.name || id).trim() || id;
  const pricingPrompt = String(raw?.pricing?.prompt || "").trim();
  const pricingCompletion = String(raw?.pricing?.completion || "").trim();

  return {
    id,
    name,
    isFree: isFreePricing(pricingPrompt) && isFreePricing(pricingCompletion),
    pricing: {
      prompt: pricingPrompt,
      completion: pricingCompletion
    }
  };
}

function isFreePricing(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }
  return /^0+(?:\.0+)?$/.test(normalized);
}

function normalizePlatform(rawPlatform) {
  return rawPlatform === "linkedin" ? "linkedin" : "x";
}

function platformLabel(platform) {
  return normalizePlatform(platform) === "linkedin" ? "LinkedIn" : "X";
}

function replyCharacterLimit(platform) {
  return normalizePlatform(platform) === "linkedin" ? 500 : 280;
}

function draftCharacterLimit(platform) {
  return normalizePlatform(platform) === "linkedin" ? 1200 : 280;
}

function platformSpecificReplyGuidance(platform) {
  if (normalizePlatform(platform) === "linkedin") {
    return "- For LinkedIn, sound sharp and human but slightly more professional than X.";
  }
  return "- For X, optimize for punch, brevity, and crisp phrasing.";
}

function platformSpecificDraftGuidance(platform) {
  if (normalizePlatform(platform) === "linkedin") {
    return "- For LinkedIn, a slightly longer and more explanatory structure is allowed, but keep it tight.";
  }
  return "- For X, each draft should feel compact enough to post without editing.";
}

function resolveSystemInstruction({ settings, platform, mode }) {
  const normalizedPlatform = normalizePlatform(platform);
  const normalizedMode = mode === "draft" ? "draft" : "reply";
  const systemPrompts = sanitizeSystemPrompts(settings?.systemPrompts);
  const custom = systemPrompts?.[normalizedMode]?.[normalizedPlatform]?.text;
  const customText = String(custom || "").trim();
  if (isValidSystemPrompt(customText)) {
    return customText;
  }
  return buildPersonalizedSystemPrompt({
    platform: normalizedPlatform,
    mode: normalizedMode,
    answers: settings?.profileAnswers,
    customInstructions: settings?.customInstructions
  });
}

function buildPersonalizedSystemPrompt({ platform, mode, answers, customInstructions }) {
  const normalizedPlatform = normalizePlatform(platform);
  const label = platformLabel(normalizedPlatform);
  const normalizedMode = mode === "draft" ? "draft" : "reply";
  const user = sanitizeProfileAnswers(answers);
  const legacyInstructions = String(customInstructions || "").trim();

  const identityBlock = [
    `You are Linx ${normalizedMode === "reply" ? "Reply" : "Draft"} AI for ${user.displayName}.`,
    `Platform: ${label}`,
    `Creator role: ${user.role}`,
    `Domain expertise: ${user.expertise}`,
    `Audience: ${user.audience}`,
    `Primary goals: ${user.goals}`,
    `Tone profile: ${user.tone}`,
    `Preferred CTA style: ${user.ctaPreference}`,
    `Point of view: ${user.pointOfView}`,
    `Signature phrases: ${user.signaturePhrases}`,
    `Proof points to highlight: ${user.proofPoints}`,
    `Avoid this style: ${user.forbiddenStyles}`,
    `Priority topics: ${user.topics}`
  ];

  const platformBlock = normalizedPlatform === "linkedin"
    ? [
        "Platform-native style guidance (LinkedIn):",
        "- Lead with a clear insight or lesson, then support it with practical context.",
        "- Keep tone credible, direct, and useful for professionals.",
        "- Slightly explanatory structure is welcome, but remove fluff.",
        "- Prioritize clarity, specificity, and practical takeaways."
      ]
    : [
        "Platform-native style guidance (X):",
        "- Open with a sharp angle, conviction, or high-signal observation.",
        "- Keep phrasing compact, punchy, and easy to scan quickly.",
        "- Prefer short lines and strong wording over long explanation.",
        "- Avoid filler, hedging, and generic motivational language."
      ];

  const modeBlock = normalizedMode === "reply"
    ? [
        "Task:",
        "- Produce exactly 4 distinct reply options with varied angles and lengths.",
        "- Mix: one direct opinion, one strategic insight, one concise punchy line, one nuanced take.",
        "- Replies must be specific to the source post and add value.",
        "- Avoid sounding generic, cringy, sycophantic, or overly corporate.",
        "- Avoid hashtags and emojis unless strongly relevant to the source post.",
        "- Do not end most replies with questions; at most 1 of 4 may end with a question.",
        `- Keep each reply under ${replyCharacterLimit(normalizedPlatform)} characters.`,
        platformSpecificReplyGuidance(normalizedPlatform),
        "Return JSON only, with no markdown and no extra commentary.",
        "Use this exact format: {\"replies\":[\"...\",\"...\",\"...\",\"...\"]}"
      ]
    : [
        "Task:",
        "- Rewrite the brain dump into exactly 4 distinct post draft options.",
        "- Mix: one primary clear post plus three alternate angles.",
        "- Keep drafts human, specific, and opinionated when relevant.",
        "- Sound like a builder sharing real insight, not polished corporate copy.",
        "- Avoid hashtags and emojis unless strongly relevant.",
        `- Keep each draft <= ${draftCharacterLimit(normalizedPlatform)} characters.`,
        platformSpecificDraftGuidance(normalizedPlatform),
        "- No markdown, no numbering, no extra commentary.",
        "Return JSON only, with this exact format: {\"drafts\":[\"...\",\"...\",\"...\",\"...\"]}"
      ];

  const lines = [
    ...identityBlock,
    ANTI_AI_STYLE_GUIDE,
    ...platformBlock,
    ...modeBlock
  ];

  if (legacyInstructions) {
    lines.push(`Legacy custom instructions:\n${legacyInstructions}`);
  }

  return lines.join("\n");
}

function isValidSystemPrompt(text) {
  if (!text || typeof text !== "string") {
    return false;
  }
  const trimmed = text.trim();
  return Boolean(trimmed) && trimmed.length <= MAX_SYSTEM_PROMPT_CHARS;
}

function extractOpenRouterText(data) {
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
  const [storedSync, storedLocal] = await Promise.all([
    chrome.storage.sync.get({
      openrouterApiKey: "",
      replyModel: DEFAULT_MODEL,
      draftModel: DEFAULT_MODEL,
      showPaidModels: false,
      customInstructions: "",
      temperature: DEFAULT_TEMPERATURE,
      profileVersion: 0,
      providerVersion: 0,
      onboardingCompleted: false,
      onboardingStep: 0,
      profileAnswers: getDefaultProfileAnswers(),
      systemPrompts: getDefaultSystemPrompts(),
      apiKey: "",
      geminiApiKey: "",
      glmApiKey: ""
    }),
    chrome.storage.local.get({
      systemPrompts: getDefaultSystemPrompts(),
      openrouterModelsCache: { models: [], fetchedAt: 0 }
    })
  ]);

  const normalized = {
    ...storedSync,
    profileVersion: PROFILE_VERSION,
    providerVersion: PROVIDER_VERSION,
    openrouterApiKey: String(storedSync.openrouterApiKey || "").trim(),
    replyModel: parseModelChoice(storedSync.replyModel, DEFAULT_MODEL),
    draftModel: parseModelChoice(storedSync.draftModel, DEFAULT_MODEL),
    showPaidModels: Boolean(storedSync.showPaidModels),
    onboardingCompleted: Boolean(storedSync.onboardingCompleted),
    onboardingStep: Number.isFinite(Number(storedSync.onboardingStep)) ? Number(storedSync.onboardingStep) : 0,
    profileAnswers: sanitizeProfileAnswers(storedSync.profileAnswers),
    systemPrompts: sanitizeSystemPrompts(storedLocal?.systemPrompts || storedSync.systemPrompts),
    openrouterModelsCache: sanitizeOpenRouterModelsCache(storedLocal?.openrouterModelsCache)
  };

  const syncPatch = {};
  const syncRemove = [];
  const localPatch = {};

  if (Number(storedSync.profileVersion || 0) !== PROFILE_VERSION) {
    syncPatch.profileVersion = PROFILE_VERSION;
  }

  if (Number(storedSync.providerVersion || 0) !== PROVIDER_VERSION) {
    Object.assign(syncPatch, {
      providerVersion: PROVIDER_VERSION,
      openrouterApiKey: "",
      replyModel: DEFAULT_MODEL,
      draftModel: DEFAULT_MODEL,
      showPaidModels: false
    });
    syncRemove.push("apiKey", "geminiApiKey", "glmApiKey");
  }

  if (!storedLocal?.systemPrompts || Number(storedSync.profileVersion || 0) !== PROFILE_VERSION) {
    localPatch.systemPrompts = normalizeSystemPromptsForStorage(normalized.systemPrompts);
  }

  if (!storedLocal?.openrouterModelsCache || Number(storedSync.providerVersion || 0) !== PROVIDER_VERSION) {
    localPatch.openrouterModelsCache = { models: [], fetchedAt: 0 };
    normalized.openrouterModelsCache = { models: [], fetchedAt: 0 };
  }

  if (Object.keys(syncPatch).length) {
    await chrome.storage.sync.set(syncPatch);
  }
  if (syncRemove.length) {
    await chrome.storage.sync.remove(syncRemove);
  }
  if (Object.keys(localPatch).length) {
    await chrome.storage.local.set(localPatch);
  }

  if (syncPatch.openrouterApiKey === "") {
    normalized.openrouterApiKey = "";
    normalized.replyModel = DEFAULT_MODEL;
    normalized.draftModel = DEFAULT_MODEL;
    normalized.showPaidModels = false;
  }

  return normalized;
}

function getDefaultProfileAnswers() {
  return {
    displayName: "the user",
    role: "builder creating products with AI",
    expertise: "AI agents, automation, and emerging technology",
    audience: "builders, founders, and curious professionals",
    tone: "insightful, direct, practical, and human",
    goals: "share original insights, spark useful conversation, and build credibility",
    forbiddenStyles: "generic platitudes, cringe hype, and corporate jargon",
    ctaPreference: "light and optional CTA, not forced in every post",
    pointOfView: "builder-first perspective grounded in direct experience",
    topics: "AI agents, robotics, frontier tech, product building",
    proofPoints: "real examples, concrete observations, practical takeaways",
    signaturePhrases: "none"
  };
}

function getDefaultSystemPrompts() {
  return {
    reply: {
      linkedin: { text: "", isUserEdited: false, lastGeneratedAt: 0 },
      x: { text: "", isUserEdited: false, lastGeneratedAt: 0 }
    },
    draft: {
      linkedin: { text: "", isUserEdited: false, lastGeneratedAt: 0 },
      x: { text: "", isUserEdited: false, lastGeneratedAt: 0 }
    }
  };
}

function sanitizeProfileAnswers(raw) {
  const defaults = getDefaultProfileAnswers();
  const source = raw && typeof raw === "object" ? raw : {};
  const normalized = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = typeof source[key] === "string" ? source[key].trim() : "";
    normalized[key] = value || fallback;
  }
  return normalized;
}

function sanitizePromptEntry(rawEntry) {
  const text = typeof rawEntry?.text === "string" ? rawEntry.text.trim() : "";
  const isUserEdited = Boolean(rawEntry?.isUserEdited);
  const lastGeneratedAt = Number(rawEntry?.lastGeneratedAt);
  return {
    text: text.length <= MAX_SYSTEM_PROMPT_CHARS ? text : "",
    isUserEdited,
    lastGeneratedAt: Number.isFinite(lastGeneratedAt) ? lastGeneratedAt : 0
  };
}

function sanitizeSystemPrompts(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    reply: {
      linkedin: sanitizePromptEntry(source?.reply?.linkedin),
      x: sanitizePromptEntry(source?.reply?.x)
    },
    draft: {
      linkedin: sanitizePromptEntry(source?.draft?.linkedin),
      x: sanitizePromptEntry(source?.draft?.x)
    }
  };
}

function normalizeSystemPromptsForStorage(prompts) {
  return {
    reply: {
      linkedin: { ...prompts.reply.linkedin },
      x: { ...prompts.reply.x }
    },
    draft: {
      linkedin: { ...prompts.draft.linkedin },
      x: { ...prompts.draft.x }
    }
  };
}

function sanitizeOpenRouterModelsCache(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const list = Array.isArray(source.models) ? source.models : [];
  const models = list
    .map((item) => normalizeOpenRouterModel(item))
    .filter(Boolean);
  const fetchedAt = Number(source.fetchedAt);

  return {
    models,
    fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : 0
  };
}

function parseModelChoice(rawValue, fallbackValue) {
  const value = String(rawValue || fallbackValue || DEFAULT_MODEL).trim();
  return value;
}

function ensureApiKey(apiKey) {
  if (String(apiKey || "").trim()) {
    return;
  }
  throw new Error("OpenRouter API key is missing. Add it in extension settings.");
}

function ensureModelSelected(model) {
  if (String(model || "").trim()) {
    return;
  }
  throw new Error("Select an OpenRouter model in extension settings.");
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

async function throwProviderError(response) {
  const errorBody = await safeJson(response);
  const messageText =
    errorBody?.error?.message ||
    errorBody?.message ||
    `OpenRouter request failed (${response.status}). Check your key and network.`;
  throw new Error(messageText);
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
