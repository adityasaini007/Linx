const DEFAULTS = {
  apiKey: "",
  geminiApiKey: "",
  glmApiKey: "",
  replyModel: "gemini:gemini-3-flash-preview",
  draftModel: "gemini:gemini-3-flash-preview",
  customInstructions: "",
  temperature: 0.7
};

const geminiApiKeyInput = document.getElementById("geminiApiKey");
const glmApiKeyInput = document.getElementById("glmApiKey");
const replyModelInput = document.getElementById("replyModel");
const draftModelInput = document.getElementById("draftModel");
const customInstructionsInput = document.getElementById("customInstructions");
const temperatureInput = document.getElementById("temperature");
const temperatureValue = document.getElementById("tempValue");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");

init();

async function init() {
  const stored = await chrome.storage.sync.get(DEFAULTS);

  geminiApiKeyInput.value = stored.geminiApiKey || stored.apiKey || "";
  glmApiKeyInput.value = stored.glmApiKey || "";
  replyModelInput.value = normalizeModelChoice(stored.replyModel, DEFAULTS.replyModel);
  draftModelInput.value = normalizeModelChoice(stored.draftModel, DEFAULTS.draftModel);
  customInstructionsInput.value = stored.customInstructions || "";
  temperatureInput.value = String(stored.temperature ?? DEFAULTS.temperature);
  temperatureValue.textContent = Number(temperatureInput.value).toFixed(1);

  temperatureInput.addEventListener("input", () => {
    temperatureValue.textContent = Number(temperatureInput.value).toFixed(1);
  });

  saveBtn.addEventListener("click", onSave);
}

async function onSave() {
  const payload = {
    apiKey: geminiApiKeyInput.value.trim(),
    geminiApiKey: geminiApiKeyInput.value.trim(),
    glmApiKey: glmApiKeyInput.value.trim(),
    replyModel: replyModelInput.value || DEFAULTS.replyModel,
    draftModel: draftModelInput.value || DEFAULTS.draftModel,
    customInstructions: customInstructionsInput.value.trim(),
    temperature: clampTemperature(temperatureInput.value)
  };

  try {
    await chrome.storage.sync.set(payload);
    setStatus("Settings saved.");
  } catch (_error) {
    setStatus("Could not save settings.");
  }
}

function clampTemperature(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return DEFAULTS.temperature;
  }
  return Math.max(0, Math.min(1.5, numeric));
}

function setStatus(message) {
  statusEl.textContent = message;
  window.setTimeout(() => {
    if (statusEl.textContent === message) {
      statusEl.textContent = "";
    }
  }, 2000);
}

function normalizeModelChoice(rawValue, fallback) {
  const choice = String(rawValue || fallback);
  const normalized = choice.includes(":") ? choice : `gemini:${choice}`;
  return Array.from(replyModelInput.options).some((option) => option.value === normalized) ? normalized : fallback;
}
