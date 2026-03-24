const PROFILE_VERSION = 2;
const DEFAULT_MODEL = "gemini:gemini-3-flash-preview";
const DEFAULT_TEMPERATURE = 0.7;
const MAX_SYSTEM_PROMPT_CHARS = 9000;

const DEFAULT_PROFILE_ANSWERS = {
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

const DEFAULT_SYSTEM_PROMPTS = {
  reply: {
    linkedin: { text: "", isUserEdited: false, lastGeneratedAt: 0 },
    x: { text: "", isUserEdited: false, lastGeneratedAt: 0 }
  },
  draft: {
    linkedin: { text: "", isUserEdited: false, lastGeneratedAt: 0 },
    x: { text: "", isUserEdited: false, lastGeneratedAt: 0 }
  }
};

const DEFAULTS = {
  apiKey: "",
  geminiApiKey: "",
  glmApiKey: "",
  replyModel: DEFAULT_MODEL,
  draftModel: DEFAULT_MODEL,
  customInstructions: "",
  temperature: DEFAULT_TEMPERATURE,
  profileVersion: 0,
  onboardingCompleted: false,
  onboardingStep: 0,
  profileAnswers: DEFAULT_PROFILE_ANSWERS,
  systemPrompts: DEFAULT_SYSTEM_PROMPTS
};

const refs = {
  onboardingBanner: document.getElementById("onboardingBanner"),
  onboardingSection: document.getElementById("onboardingSection"),
  openOnboardingBtn: document.getElementById("openOnboardingBtn"),
  editOnboardingBtn: document.getElementById("editOnboardingBtn"),
  stepBadge: document.getElementById("stepBadge"),
  coreStep: document.getElementById("coreStep"),
  advancedStep: document.getElementById("advancedStep"),
  saveCoreBtn: document.getElementById("saveCoreBtn"),
  completeOnboardingBtn: document.getElementById("completeOnboardingBtn"),
  skipAdvancedBtn: document.getElementById("skipAdvancedBtn"),

  displayName: document.getElementById("displayName"),
  role: document.getElementById("role"),
  expertise: document.getElementById("expertise"),
  audience: document.getElementById("audience"),
  tone: document.getElementById("tone"),
  goals: document.getElementById("goals"),
  forbiddenStyles: document.getElementById("forbiddenStyles"),
  ctaPreference: document.getElementById("ctaPreference"),
  pointOfView: document.getElementById("pointOfView"),
  topics: document.getElementById("topics"),
  proofPoints: document.getElementById("proofPoints"),
  signaturePhrases: document.getElementById("signaturePhrases"),

  geminiApiKeyInput: document.getElementById("geminiApiKey"),
  glmApiKeyInput: document.getElementById("glmApiKey"),
  replyModelInput: document.getElementById("replyModel"),
  draftModelInput: document.getElementById("draftModel"),
  temperatureInput: document.getElementById("temperature"),
  temperatureValue: document.getElementById("tempValue"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),

  replyLinkedinPrompt: document.getElementById("replyLinkedinPrompt"),
  replyXPrompt: document.getElementById("replyXPrompt"),
  draftLinkedinPrompt: document.getElementById("draftLinkedinPrompt"),
  draftXPrompt: document.getElementById("draftXPrompt"),
  regenLinkedInBtn: document.getElementById("regenLinkedInBtn"),
  regenXBtn: document.getElementById("regenXBtn"),
  regenAllBtn: document.getElementById("regenAllBtn"),
  savePromptsBtn: document.getElementById("savePromptsBtn"),

  statusEl: document.getElementById("status")
};

let state = {
  onboardingCompleted: false,
  onboardingStep: 0,
  profileAnswers: sanitizeProfileAnswers(DEFAULT_PROFILE_ANSWERS),
  systemPrompts: sanitizeSystemPrompts(DEFAULT_SYSTEM_PROMPTS)
};

init();

async function init() {
  const [storedSync, storedLocal] = await Promise.all([
    chrome.storage.sync.get(DEFAULTS),
    chrome.storage.local.get({ systemPrompts: DEFAULT_SYSTEM_PROMPTS })
  ]);
  const normalized = await migrateAndNormalize(storedSync, storedLocal);
  state = {
    onboardingCompleted: normalized.onboardingCompleted,
    onboardingStep: normalized.onboardingStep,
    profileAnswers: normalized.profileAnswers,
    systemPrompts: normalized.systemPrompts
  };

  hydrateSettings(normalized);
  hydrateProfileAnswers(normalized.profileAnswers);
  hydratePrompts(normalized.systemPrompts);
  renderOnboarding(false);
  bindEvents();
}

function bindEvents() {
  refs.temperatureInput.addEventListener("input", () => {
    refs.temperatureValue.textContent = Number(refs.temperatureInput.value).toFixed(1);
  });

  refs.saveSettingsBtn.addEventListener("click", onSaveSettings);
  refs.saveCoreBtn.addEventListener("click", onSaveCoreAnswers);
  refs.completeOnboardingBtn.addEventListener("click", () => onCompleteOnboarding(false));
  refs.skipAdvancedBtn.addEventListener("click", () => onCompleteOnboarding(true));
  refs.openOnboardingBtn.addEventListener("click", () => renderOnboarding(true));
  refs.editOnboardingBtn.addEventListener("click", () => renderOnboarding(true, true));

  refs.regenLinkedInBtn.addEventListener("click", () => regeneratePrompts("linkedin"));
  refs.regenXBtn.addEventListener("click", () => regeneratePrompts("x"));
  refs.regenAllBtn.addEventListener("click", () => regeneratePrompts(null));
  refs.savePromptsBtn.addEventListener("click", onSavePromptEdits);
}

async function migrateAndNormalize(stored, localStored) {
  const normalized = {
    ...stored,
    profileVersion: PROFILE_VERSION,
    onboardingCompleted: Boolean(stored.onboardingCompleted),
    onboardingStep: Number.isFinite(Number(stored.onboardingStep)) ? Number(stored.onboardingStep) : 0,
    profileAnswers: sanitizeProfileAnswers(stored.profileAnswers),
    systemPrompts: sanitizeSystemPrompts(localStored?.systemPrompts || stored.systemPrompts)
  };

  if (!normalized.geminiApiKey && normalized.apiKey) {
    normalized.geminiApiKey = normalized.apiKey;
  }

  const needsMigration = Number(stored.profileVersion || 0) !== PROFILE_VERSION;
  if (needsMigration) {
    normalized.onboardingCompleted = false;
    normalized.onboardingStep = 0;
    await Promise.all([
      chrome.storage.sync.set({
        profileVersion: PROFILE_VERSION,
        onboardingCompleted: false,
        onboardingStep: 0,
        profileAnswers: normalized.profileAnswers
      }),
      chrome.storage.local.set({
        systemPrompts: DEFAULT_SYSTEM_PROMPTS
      })
    ]);
    normalized.systemPrompts = sanitizeSystemPrompts(DEFAULT_SYSTEM_PROMPTS);
  }

  return normalized;
}

function hydrateSettings(stored) {
  refs.geminiApiKeyInput.value = stored.geminiApiKey || stored.apiKey || "";
  refs.glmApiKeyInput.value = stored.glmApiKey || "";
  refs.replyModelInput.value = normalizeModelChoice(stored.replyModel, DEFAULT_MODEL);
  refs.draftModelInput.value = normalizeModelChoice(stored.draftModel, DEFAULT_MODEL);
  refs.temperatureInput.value = String(stored.temperature ?? DEFAULT_TEMPERATURE);
  refs.temperatureValue.textContent = Number(refs.temperatureInput.value).toFixed(1);
}

function hydrateProfileAnswers(answers) {
  refs.displayName.value = answers.displayName;
  refs.role.value = answers.role;
  refs.expertise.value = answers.expertise;
  refs.audience.value = answers.audience;
  refs.tone.value = answers.tone;
  refs.goals.value = answers.goals;
  refs.forbiddenStyles.value = answers.forbiddenStyles;
  refs.ctaPreference.value = answers.ctaPreference;
  refs.pointOfView.value = answers.pointOfView;
  refs.topics.value = answers.topics;
  refs.proofPoints.value = answers.proofPoints;
  refs.signaturePhrases.value = answers.signaturePhrases;
}

function hydratePrompts(prompts) {
  refs.replyLinkedinPrompt.value = prompts.reply.linkedin.text || "";
  refs.replyXPrompt.value = prompts.reply.x.text || "";
  refs.draftLinkedinPrompt.value = prompts.draft.linkedin.text || "";
  refs.draftXPrompt.value = prompts.draft.x.text || "";
}

function renderOnboarding(show, editMode = false) {
  const shouldShowBanner = !state.onboardingCompleted;
  refs.onboardingBanner.classList.toggle("hidden", !shouldShowBanner);

  if (!show && state.onboardingCompleted) {
    refs.onboardingSection.classList.add("hidden");
    return;
  }

  refs.onboardingSection.classList.remove("hidden");

  if (editMode || state.onboardingCompleted) {
    refs.stepBadge.textContent = "Edit profile";
    refs.coreStep.classList.remove("hidden");
    refs.advancedStep.classList.remove("hidden");
    return;
  }

  const onAdvanced = state.onboardingStep >= 1;
  refs.stepBadge.textContent = onAdvanced ? "Step 2/2" : "Step 1/2";
  refs.coreStep.classList.toggle("hidden", onAdvanced);
  refs.advancedStep.classList.toggle("hidden", !onAdvanced);
}

async function onSaveSettings() {
  const payload = {
    apiKey: refs.geminiApiKeyInput.value.trim(),
    geminiApiKey: refs.geminiApiKeyInput.value.trim(),
    glmApiKey: refs.glmApiKeyInput.value.trim(),
    replyModel: refs.replyModelInput.value || DEFAULT_MODEL,
    draftModel: refs.draftModelInput.value || DEFAULT_MODEL,
    temperature: clampTemperature(refs.temperatureInput.value)
  };

  try {
    await chrome.storage.sync.set(payload);
    setStatus("Model settings saved.");
  } catch (_error) {
    setStatus("Could not save model settings.");
  }
}

async function onSaveCoreAnswers() {
  const answers = collectProfileAnswers();
  state.profileAnswers = answers;
  const wasCompleted = state.onboardingCompleted;
  state.onboardingStep = wasCompleted ? 2 : 1;

  try {
    await chrome.storage.sync.set({
      profileAnswers: answers,
      onboardingStep: state.onboardingStep,
      onboardingCompleted: wasCompleted,
      profileVersion: PROFILE_VERSION
    });
    if (!wasCompleted) {
      renderOnboarding(true);
      setStatus("Core answers saved. Add advanced details or finish.");
      return;
    }
    setStatus("Core profile answers saved.");
  } catch (_error) {
    setStatus("Could not save onboarding answers.");
  }
}

async function onCompleteOnboarding(skipAdvanced) {
  const answers = collectProfileAnswers();
  state.profileAnswers = answers;
  setStatus("Generating prompts...");

  try {
    const built = await buildSystemPrompts(answers, null);
    state.systemPrompts = built;
    state.onboardingCompleted = true;
    state.onboardingStep = skipAdvanced ? 1 : 2;

    await Promise.all([
      chrome.storage.sync.set({
        profileVersion: PROFILE_VERSION,
        profileAnswers: answers,
        onboardingCompleted: true,
        onboardingStep: state.onboardingStep
      }),
      chrome.storage.local.set({
        systemPrompts: built
      })
    ]);

    hydratePrompts(built);
    renderOnboarding(false);
    setStatus("Onboarding complete. Prompts generated for LinkedIn and X.");
  } catch (error) {
    const message = String(error?.message || "");
    setStatus(message ? `Could not complete onboarding: ${message}` : "Could not complete onboarding.");
  }
}

async function regeneratePrompts(targetPlatform) {
  const answers = collectProfileAnswers();
  setStatus("Regenerating prompts...");
  try {
    const updated = await buildSystemPrompts(answers, targetPlatform);
    state.systemPrompts = updated;
    state.profileAnswers = answers;

    await Promise.all([
      chrome.storage.sync.set({
        profileAnswers: answers
      }),
      chrome.storage.local.set({
        systemPrompts: updated
      })
    ]);

    hydratePrompts(updated);
    setStatus(targetPlatform ? `Regenerated ${targetPlatform === "linkedin" ? "LinkedIn" : "X"} prompts.` : "Regenerated all prompts.");
  } catch (_error) {
    setStatus("Prompt regeneration failed.");
  }
}

async function onSavePromptEdits() {
  const prompts = sanitizeSystemPrompts(state.systemPrompts);
  const now = Date.now();

  prompts.reply.linkedin = {
    text: sanitizePromptText(refs.replyLinkedinPrompt.value),
    isUserEdited: true,
    lastGeneratedAt: prompts.reply.linkedin.lastGeneratedAt || now
  };
  prompts.reply.x = {
    text: sanitizePromptText(refs.replyXPrompt.value),
    isUserEdited: true,
    lastGeneratedAt: prompts.reply.x.lastGeneratedAt || now
  };
  prompts.draft.linkedin = {
    text: sanitizePromptText(refs.draftLinkedinPrompt.value),
    isUserEdited: true,
    lastGeneratedAt: prompts.draft.linkedin.lastGeneratedAt || now
  };
  prompts.draft.x = {
    text: sanitizePromptText(refs.draftXPrompt.value),
    isUserEdited: true,
    lastGeneratedAt: prompts.draft.x.lastGeneratedAt || now
  };

  try {
    await chrome.storage.local.set({ systemPrompts: prompts });
    state.systemPrompts = prompts;
    setStatus("Prompt edits saved.");
  } catch (_error) {
    setStatus("Could not save prompt edits.");
  }
}

async function buildSystemPrompts(answers, targetPlatform) {
  const response = await chrome.runtime.sendMessage({
    type: "BUILD_SYSTEM_PROMPTS",
    answers,
    targetPlatform
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Could not build prompts.");
  }

  return sanitizeSystemPrompts(response.data?.systemPrompts);
}

function collectProfileAnswers() {
  return sanitizeProfileAnswers({
    displayName: refs.displayName.value,
    role: refs.role.value,
    expertise: refs.expertise.value,
    audience: refs.audience.value,
    tone: refs.tone.value,
    goals: refs.goals.value,
    forbiddenStyles: refs.forbiddenStyles.value,
    ctaPreference: refs.ctaPreference.value,
    pointOfView: refs.pointOfView.value,
    topics: refs.topics.value,
    proofPoints: refs.proofPoints.value,
    signaturePhrases: refs.signaturePhrases.value
  });
}

function sanitizeProfileAnswers(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const normalized = {};
  for (const [key, fallback] of Object.entries(DEFAULT_PROFILE_ANSWERS)) {
    const value = typeof source[key] === "string" ? source[key].trim() : "";
    normalized[key] = value || fallback;
  }
  return normalized;
}

function sanitizePromptEntry(raw) {
  const text = sanitizePromptText(raw?.text);
  const lastGeneratedAt = Number(raw?.lastGeneratedAt);
  return {
    text,
    isUserEdited: Boolean(raw?.isUserEdited),
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

function sanitizePromptText(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length <= MAX_SYSTEM_PROMPT_CHARS ? text : text.slice(0, MAX_SYSTEM_PROMPT_CHARS);
}

function clampTemperature(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return DEFAULT_TEMPERATURE;
  }
  return Math.max(0, Math.min(1.5, numeric));
}

function setStatus(message) {
  refs.statusEl.textContent = message;
  window.setTimeout(() => {
    if (refs.statusEl.textContent === message) {
      refs.statusEl.textContent = "";
    }
  }, 5000);
}

function normalizeModelChoice(rawValue, fallback) {
  const choice = String(rawValue || fallback);
  const normalized = choice.includes(":") ? choice : `gemini:${choice}`;
  return Array.from(refs.replyModelInput.options).some((option) => option.value === normalized) ? normalized : fallback;
}
