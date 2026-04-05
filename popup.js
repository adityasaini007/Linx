const PROFILE_VERSION = 2;
const PROVIDER_VERSION = 1;
const DEFAULT_MODEL = "";
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

const DEFAULT_OPENROUTER_MODELS_CACHE = {
  models: [],
  fetchedAt: 0
};

const DEFAULTS = {
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
  profileAnswers: DEFAULT_PROFILE_ANSWERS,
  systemPrompts: DEFAULT_SYSTEM_PROMPTS,
  apiKey: "",
  geminiApiKey: "",
  glmApiKey: ""
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

  openrouterApiKeyInput: document.getElementById("openrouterApiKey"),
  replyModelInput: document.getElementById("replyModel"),
  draftModelInput: document.getElementById("draftModel"),
  showPaidModelsInput: document.getElementById("showPaidModels"),
  refreshModelsBtn: document.getElementById("refreshModelsBtn"),
  modelsStateEl: document.getElementById("modelsState"),
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
  systemPrompts: sanitizeSystemPrompts(DEFAULT_SYSTEM_PROMPTS),
  openrouterModelsCache: sanitizeOpenRouterModelsCache(DEFAULT_OPENROUTER_MODELS_CACHE),
  openrouterApiKey: "",
  replyModel: DEFAULT_MODEL,
  draftModel: DEFAULT_MODEL,
  showPaidModels: false
};

init();

async function init() {
  const [storedSync, storedLocal] = await Promise.all([
    chrome.storage.sync.get(DEFAULTS),
    chrome.storage.local.get({
      systemPrompts: DEFAULT_SYSTEM_PROMPTS,
      openrouterModelsCache: DEFAULT_OPENROUTER_MODELS_CACHE
    })
  ]);

  const normalized = await migrateAndNormalize(storedSync, storedLocal);
  state = {
    onboardingCompleted: normalized.onboardingCompleted,
    onboardingStep: normalized.onboardingStep,
    profileAnswers: normalized.profileAnswers,
    systemPrompts: normalized.systemPrompts,
    openrouterModelsCache: normalized.openrouterModelsCache,
    openrouterApiKey: normalized.openrouterApiKey,
    replyModel: normalized.replyModel,
    draftModel: normalized.draftModel,
    showPaidModels: normalized.showPaidModels
  };

  hydrateSettings(normalized);
  hydrateProfileAnswers(normalized.profileAnswers);
  hydratePrompts(normalized.systemPrompts);
  renderModelOptions();
  renderOnboarding(false);
  bindEvents();

  if (state.openrouterApiKey) {
    await fetchModels({ forceRefresh: false, setStatusMessage: false });
  } else {
    setModelsState("Add an OpenRouter API key to load available models.");
  }
}

function bindEvents() {
  refs.temperatureInput.addEventListener("input", () => {
    refs.temperatureValue.textContent = Number(refs.temperatureInput.value).toFixed(1);
  });

  refs.saveSettingsBtn.addEventListener("click", onSaveSettings);
  refs.refreshModelsBtn.addEventListener("click", onRefreshModels);
  refs.showPaidModelsInput.addEventListener("change", onTogglePaidModels);
  refs.replyModelInput.addEventListener("change", onModelSelectionChange);
  refs.draftModelInput.addEventListener("change", onModelSelectionChange);

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
    providerVersion: PROVIDER_VERSION,
    onboardingCompleted: Boolean(stored.onboardingCompleted),
    onboardingStep: Number.isFinite(Number(stored.onboardingStep)) ? Number(stored.onboardingStep) : 0,
    profileAnswers: sanitizeProfileAnswers(stored.profileAnswers),
    systemPrompts: sanitizeSystemPrompts(localStored?.systemPrompts || stored.systemPrompts),
    openrouterModelsCache: sanitizeOpenRouterModelsCache(localStored?.openrouterModelsCache),
    openrouterApiKey: String(stored.openrouterApiKey || "").trim(),
    replyModel: parseModelChoice(stored.replyModel, DEFAULT_MODEL),
    draftModel: parseModelChoice(stored.draftModel, DEFAULT_MODEL),
    showPaidModels: Boolean(stored.showPaidModels)
  };

  const syncPatch = {};
  const localPatch = {};

  if (Number(stored.profileVersion || 0) !== PROFILE_VERSION) {
    syncPatch.profileVersion = PROFILE_VERSION;
  }

  if (Number(stored.providerVersion || 0) !== PROVIDER_VERSION) {
    Object.assign(syncPatch, {
      providerVersion: PROVIDER_VERSION,
      openrouterApiKey: "",
      replyModel: DEFAULT_MODEL,
      draftModel: DEFAULT_MODEL,
      showPaidModels: false
    });

    normalized.openrouterApiKey = "";
    normalized.replyModel = DEFAULT_MODEL;
    normalized.draftModel = DEFAULT_MODEL;
    normalized.showPaidModels = false;

    await chrome.storage.sync.remove(["apiKey", "geminiApiKey", "glmApiKey"]);

    localPatch.openrouterModelsCache = DEFAULT_OPENROUTER_MODELS_CACHE;
    normalized.openrouterModelsCache = sanitizeOpenRouterModelsCache(DEFAULT_OPENROUTER_MODELS_CACHE);
  }

  if (!localStored?.systemPrompts) {
    localPatch.systemPrompts = normalized.systemPrompts;
  }

  if (!localStored?.openrouterModelsCache) {
    localPatch.openrouterModelsCache = DEFAULT_OPENROUTER_MODELS_CACHE;
  }

  if (Object.keys(syncPatch).length) {
    await chrome.storage.sync.set(syncPatch);
  }

  if (Object.keys(localPatch).length) {
    await chrome.storage.local.set(localPatch);
  }

  return normalized;
}

function hydrateSettings(stored) {
  refs.openrouterApiKeyInput.value = stored.openrouterApiKey || "";
  refs.showPaidModelsInput.checked = Boolean(stored.showPaidModels);
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
  const openrouterApiKey = refs.openrouterApiKeyInput.value.trim();
  const showPaidModels = Boolean(refs.showPaidModelsInput.checked);

  const payload = {
    openrouterApiKey,
    replyModel: state.replyModel || DEFAULT_MODEL,
    draftModel: state.draftModel || DEFAULT_MODEL,
    showPaidModels,
    temperature: clampTemperature(refs.temperatureInput.value),
    providerVersion: PROVIDER_VERSION,
    profileVersion: PROFILE_VERSION
  };

  try {
    await chrome.storage.sync.set(payload);

    state.openrouterApiKey = openrouterApiKey;
    state.showPaidModels = showPaidModels;

    if (!openrouterApiKey) {
      state.openrouterModelsCache = sanitizeOpenRouterModelsCache(DEFAULT_OPENROUTER_MODELS_CACHE);
      state.replyModel = DEFAULT_MODEL;
      state.draftModel = DEFAULT_MODEL;
      await Promise.all([
        chrome.storage.sync.set({ replyModel: DEFAULT_MODEL, draftModel: DEFAULT_MODEL }),
        chrome.storage.local.set({ openrouterModelsCache: DEFAULT_OPENROUTER_MODELS_CACHE })
      ]);
      renderModelOptions();
      setModelsState("Add an OpenRouter API key to load available models.");
      setStatus("Settings saved.");
      return;
    }

    setStatus("Settings saved. Loading models...");
    await fetchModels({ forceRefresh: true, setStatusMessage: true });
  } catch (_error) {
    setStatus("Could not save model settings.");
  }
}

async function onRefreshModels() {
  if (!state.openrouterApiKey) {
    setStatus("Add an OpenRouter API key first.");
    return;
  }

  setStatus("Refreshing models...");
  await fetchModels({ forceRefresh: true, setStatusMessage: true });
}

async function onTogglePaidModels() {
  state.showPaidModels = Boolean(refs.showPaidModelsInput.checked);
  renderModelOptions();

  try {
    await chrome.storage.sync.set({ showPaidModels: state.showPaidModels });
    setStatus(state.showPaidModels ? "Paid models enabled." : "Showing free models only.");
  } catch (_error) {
    setStatus("Could not update model filter.");
  }
}

async function onModelSelectionChange() {
  state.replyModel = refs.replyModelInput.value || DEFAULT_MODEL;
  state.draftModel = refs.draftModelInput.value || DEFAULT_MODEL;

  try {
    await chrome.storage.sync.set({
      replyModel: state.replyModel,
      draftModel: state.draftModel
    });
  } catch (_error) {
    setStatus("Could not save model selection.");
  }
}

async function fetchModels({ forceRefresh, setStatusMessage }) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "FETCH_OPENROUTER_MODELS",
      apiKey: state.openrouterApiKey,
      forceRefresh
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Could not fetch OpenRouter models.");
    }

    const payload = sanitizeOpenRouterModelsCache(response.data);
    state.openrouterModelsCache = payload;

    await chrome.storage.local.set({ openrouterModelsCache: payload });

    renderModelOptions();

    const warning = String(response.data?.warning || "").trim();
    if (warning) {
      setModelsState(warning);
      if (setStatusMessage) {
        setStatus(warning);
      }
      return;
    }

    const fetchedLabel = payload.fetchedAt
      ? `Last updated ${new Date(payload.fetchedAt).toLocaleString()}.`
      : "Model list loaded.";
    setModelsState(fetchedLabel);

    if (setStatusMessage) {
      setStatus(response.data?.fromCache ? "Using cached model list." : "Models refreshed.");
    }
  } catch (error) {
    renderModelOptions();
    setModelsState(error.message || "Could not fetch OpenRouter models.");
    if (setStatusMessage) {
      setStatus(error.message || "Could not fetch OpenRouter models.");
    }
  }
}

function renderModelOptions() {
  const visibleModels = getVisibleModels();

  if (!state.openrouterApiKey) {
    fillSelectWithPlaceholder(refs.replyModelInput, "Add OpenRouter key to load models");
    fillSelectWithPlaceholder(refs.draftModelInput, "Add OpenRouter key to load models");
    return;
  }

  if (!state.openrouterModelsCache.models.length) {
    fillSelectWithPlaceholder(refs.replyModelInput, "No models loaded yet");
    fillSelectWithPlaceholder(refs.draftModelInput, "No models loaded yet");
    setModelsState("No models loaded. Save key or click Refresh models.");
    return;
  }

  if (!visibleModels.length) {
    fillSelectWithPlaceholder(refs.replyModelInput, "No models for current filter");
    fillSelectWithPlaceholder(refs.draftModelInput, "No models for current filter");
    setModelsState(state.showPaidModels ? "No OpenRouter models available." : "No free models found. Enable paid models to continue.");
    return;
  }

  populateModelSelect(refs.replyModelInput, visibleModels, state.replyModel);
  populateModelSelect(refs.draftModelInput, visibleModels, state.draftModel);

  state.replyModel = refs.replyModelInput.value;
  state.draftModel = refs.draftModelInput.value;

  chrome.storage.sync.set({
    replyModel: state.replyModel,
    draftModel: state.draftModel
  }).catch(() => {
    setStatus("Could not persist model selection.");
  });
}

function fillSelectWithPlaceholder(select, label) {
  select.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.textContent = label;
  select.appendChild(option);
  select.value = "";
}

function populateModelSelect(select, models, selectedModelId) {
  select.innerHTML = "";

  for (const model of models) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = `${model.name} [${model.isFree ? "Free" : "Paid"}]`;
    select.appendChild(option);
  }

  const hasSelected = models.some((model) => model.id === selectedModelId);
  select.value = hasSelected ? selectedModelId : models[0].id;
}

function getVisibleModels() {
  const models = state.openrouterModelsCache.models || [];
  if (state.showPaidModels) {
    return models;
  }
  return models.filter((model) => model.isFree);
}

function setModelsState(message) {
  refs.modelsStateEl.textContent = String(message || "");
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

function sanitizeOpenRouterModelsCache(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const list = Array.isArray(source.models) ? source.models : [];
  const fetchedAt = Number(source.fetchedAt);

  const models = list
    .map((item) => sanitizeModel(item))
    .filter(Boolean)
    .sort((a, b) => {
      if (a.isFree !== b.isFree) {
        return a.isFree ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  return {
    models,
    fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : 0
  };
}

function sanitizeModel(raw) {
  const id = String(raw?.id || "").trim();
  if (!id) {
    return null;
  }

  return {
    id,
    name: String(raw?.name || id).trim() || id,
    isFree: Boolean(raw?.isFree),
    pricing: {
      prompt: String(raw?.pricing?.prompt || ""),
      completion: String(raw?.pricing?.completion || "")
    }
  };
}

function sanitizePromptText(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length <= MAX_SYSTEM_PROMPT_CHARS ? text : text.slice(0, MAX_SYSTEM_PROMPT_CHARS);
}

function parseModelChoice(rawValue, fallback) {
  return String(rawValue || fallback || DEFAULT_MODEL).trim();
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
