const BUTTON_CLASS = "lucian-ai-reply-btn";
const COMPOSE_BUTTON_CLASS = "lucian-ai-draft-btn";
const PROCESSED_ATTR = "data-lucian-processed";
const COMPOSE_PROCESSED_ATTR = "data-lucian-compose-processed";
const MODAL_HOST_ID = "lucian-reply-modal-host";
const TAILWIND_CDN = "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css";

const state = {
  mode: "reply",
  currentTweet: null,
  replies: [],
  drafts: [],
  lastBrainDump: "",
  activeComposer: null,
  composeSurface: "unknown"
};

init();

function init() {
  injectButtonsInScope(document);
  injectComposerButtonsInScope(document);
  observeDom();
}

function observeDom() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }
        injectButtonsInScope(node);
        injectComposerButtonsInScope(node);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function injectButtonsInScope(root) {
  const tweets = root.matches?.('article[data-testid="tweet"]')
    ? [root]
    : Array.from(root.querySelectorAll?.('article[data-testid="tweet"]') || []);

  for (const article of tweets) {
    if (article.getAttribute(PROCESSED_ATTR) === "true") {
      continue;
    }

    const actionBar = findActionBar(article);
    if (!actionBar) {
      continue;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = BUTTON_CLASS;
    btn.textContent = "✦ AI Reply";
    btn.title = "Generate AI replies";
    btn.addEventListener("click", () => onAiReplyClick(article, btn));
    actionBar.appendChild(btn);

    article.setAttribute(PROCESSED_ATTR, "true");
  }
}

function injectComposerButtonsInScope(root) {
  const postButtons = root.matches?.(composerPostButtonSelector())
    ? [root]
    : Array.from(root.querySelectorAll?.(composerPostButtonSelector()) || []);

  for (const postButton of postButtons) {
    if (!(postButton instanceof HTMLElement) || !isComposerPostButton(postButton)) {
      continue;
    }

    if (postButton.getAttribute(COMPOSE_PROCESSED_ATTR) === "true") {
      continue;
    }

    const buttonSlot = findComposerButtonSlot(postButton);
    if (!buttonSlot || buttonSlot.querySelector(`.${COMPOSE_BUTTON_CLASS}`)) {
      postButton.setAttribute(COMPOSE_PROCESSED_ATTR, "true");
      continue;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = COMPOSE_BUTTON_CLASS;
    btn.textContent = "✦ AI Draft";
    btn.title = "Generate X post drafts from brain dump";
    btn.addEventListener("click", () => onAiDraftClick(postButton, btn));

    buttonSlot.insertBefore(btn, postButton);
    postButton.setAttribute(COMPOSE_PROCESSED_ATTR, "true");
  }
}

function composerPostButtonSelector() {
  return '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]';
}

function isComposerPostButton(postButton) {
  const label = [
    postButton.getAttribute("aria-label") || "",
    postButton.textContent || "",
    postButton.getAttribute("data-testid") || ""
  ]
    .join(" ")
    .toLowerCase();

  if (label.includes("reply")) {
    return false;
  }
  return label.includes("post") || label.includes("tweetbuttoninline");
}

function findComposerButtonSlot(postButton) {
  const directParent = postButton.parentElement;
  if (directParent) {
    return directParent;
  }
  return postButton.closest('div[role="group"], div') || null;
}

function findActionBar(article) {
  const selectors = [
    'div[role="group"]',
    '[data-testid="reply"]'
  ];

  for (const selector of selectors) {
    const node = article.querySelector(selector);
    if (!node) {
      continue;
    }
    if (selector === '[data-testid="reply"]') {
      return node.parentElement || null;
    }
    return node;
  }
  return null;
}

async function onAiReplyClick(article, button) {
  button.disabled = true;

  try {
    state.mode = "reply";
    const tweet = await extractTweetData(article);
    state.currentTweet = tweet;

    openModal();
    setPanelMode("reply");
    setLoading(true, "Generating replies...");
    setStatus("");

    const images = await fetchTweetImages(tweet.imageUrls || []);
    const payloadTweet = {
      ...tweet,
      images
    };

    const response = await sendRuntimeMessage({
      type: "GENERATE_REPLIES",
      tweet: payloadTweet
    });

    state.replies = response.replies || [];
    renderReplies(state.replies);
    setLoading(false);
  } catch (error) {
    setLoading(false);
    setStatus(error.message || "Could not generate replies. Try again.");
  } finally {
    button.disabled = false;
  }
}

async function onAiDraftClick(postButton, button) {
  button.disabled = true;

  try {
    state.mode = "compose";
    openModal();
    setPanelMode("compose");
    setStatus("");
    setLoading(false);

    const composer = await resolveComposerFromPostButton(postButton);
    if (composer) {
      state.activeComposer = composer;
    }

    const brainDump = extractComposerText(state.activeComposer).trim();
    state.lastBrainDump = brainDump;
    state.composeSurface = detectComposeSurface(postButton);

    const refs = getModalRefs();
    refs.composeInput.value = brainDump;

    if (!brainDump) {
      state.drafts = [];
      refs.cards.innerHTML = "";
      setStatus("Paste a rough brain dump, then click Generate drafts.");
      return;
    }

    await generateDrafts(brainDump);
  } catch (error) {
    setStatus(error.message || "Could not generate drafts. Try again.");
    setLoading(false);
  } finally {
    button.disabled = false;
  }
}

async function extractTweetData(article) {
  const stableArticle = await resolveStableArticle(article);

  const text = extractText(stableArticle);
  if (!text) {
    throw new Error("Could not read this post yet. Scroll a bit and try again.");
  }

  const { authorName, authorHandle } = extractAuthor(stableArticle);
  const imageUrls = extractImageUrls(stableArticle);

  return {
    text,
    authorName,
    authorHandle,
    imageUrls
  };
}

async function resolveStableArticle(article) {
  if (article?.isConnected) {
    return article;
  }

  for (let i = 0; i < 6; i += 1) {
    const candidate = document.querySelector('article[data-testid="tweet"]');
    if (candidate) {
      return candidate;
    }
    await sleep(150);
  }

  throw new Error("Could not locate the post container.");
}

function extractText(article) {
  const selectors = [
    '[data-testid="tweetText"]',
    'div[lang]',
    '[data-testid="tweet"] div[dir="auto"]'
  ];

  for (const selector of selectors) {
    const nodes = Array.from(article.querySelectorAll(selector));
    const text = nodes.map((node) => node.innerText?.trim() || "").filter(Boolean).join("\n").trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function extractAuthor(article) {
  const userNode = article.querySelector('[data-testid="User-Name"]');
  if (userNode) {
    const rawText = userNode.innerText || "";
    const lines = rawText.split("\n").map((item) => item.trim()).filter(Boolean);
    const handleLine = lines.find((line) => line.startsWith("@")) || "";
    const display = lines.find((line) => !line.startsWith("@")) || "Unknown";
    return {
      authorName: display,
      authorHandle: handleLine || "@unknown"
    };
  }

  const links = Array.from(article.querySelectorAll('a[role="link"]'));
  const handleLink = links.find((a) => a.getAttribute("href")?.match(/^\/[^/]+$/));
  const handle = handleLink?.getAttribute("href")?.replace("/", "@") || "@unknown";

  return {
    authorName: "Unknown",
    authorHandle: handle
  };
}

function extractImageUrls(article) {
  const urls = new Set();
  const selectors = [
    '[data-testid="tweetPhoto"] img',
    'img[src*="pbs.twimg.com/media"]'
  ];

  for (const selector of selectors) {
    const images = Array.from(article.querySelectorAll(selector));
    for (const img of images) {
      const src = img.getAttribute("src") || "";
      if (!src || src.includes("profile_images") || src.includes("emoji")) {
        continue;
      }
      urls.add(normalizeImageUrl(src));
      if (urls.size >= 2) {
        return Array.from(urls);
      }
    }
  }
  return Array.from(urls);
}

function normalizeImageUrl(src) {
  try {
    const url = new URL(src);
    if (url.hostname.includes("pbs.twimg.com")) {
      url.searchParams.set("name", "large");
      if (!url.searchParams.has("format")) {
        const ext = (url.pathname.split(".").pop() || "jpg").toLowerCase();
        url.searchParams.set("format", ext.includes("png") ? "png" : "jpg");
      }
    }
    return url.toString();
  } catch (_err) {
    return src;
  }
}

async function fetchTweetImages(imageUrls) {
  const images = [];
  for (const url of imageUrls.slice(0, 2)) {
    try {
      const result = await sendRuntimeMessage({ type: "FETCH_IMAGE", url });
      images.push(result);
    } catch (_err) {
      // Ignore individual image failures; text-only still works.
    }
  }
  return images;
}

function getModalRefs() {
  let host = document.getElementById(MODAL_HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = MODAL_HOST_ID;
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });

    const tailwindLink = document.createElement("link");
    tailwindLink.rel = "stylesheet";
    tailwindLink.href = TAILWIND_CDN;
    shadow.appendChild(tailwindLink);

    const fallbackStyle = document.createElement("style");
    fallbackStyle.textContent = `
      #lucian-shell {
        position: fixed;
        right: 14px;
        bottom: 14px;
        width: min(390px, calc(100vw - 20px));
        z-index: 999999;
        pointer-events: none;
      }
      #lucian-panel {
        pointer-events: auto;
        display: none;
        flex-direction: column;
        background: #0f172a;
        color: #e5e7eb;
        border: 1px solid #334155;
        border-radius: 14px;
        box-shadow: 0 15px 45px rgba(0, 0, 0, 0.45);
        max-height: min(88vh, 860px);
        overflow: hidden;
      }
      #lucian-panel.open {
        display: flex;
      }
      #lucian-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border-bottom: 1px solid #1f2937;
      }
      #lucian-kicker {
        margin: 0;
        font-size: 10px;
        letter-spacing: 0.09em;
        color: #34d399;
        text-transform: uppercase;
      }
      #lucian-title {
        margin: 2px 0 0;
        font-size: 15px;
        font-weight: 700;
      }
      .lucian-btn {
        border: 0;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        padding: 7px 10px;
      }
      .lucian-btn.secondary {
        background: #1f2937;
        color: #f1f5f9;
      }
      .lucian-btn.primary {
        background: #10b981;
        color: #052e2b;
      }
      #lucian-body {
        padding: 12px;
        overflow-y: auto;
        min-height: 0;
      }
      #lucian-status {
        margin: 0 0 8px;
        font-size: 12px;
        color: #cbd5e1;
      }
      #lucian-loading {
        display: none;
        margin-bottom: 10px;
        padding: 8px 10px;
        border-radius: 8px;
        background: #1e293b;
        font-size: 12px;
        color: #cbd5e1;
      }
      #lucian-loading.show {
        display: block;
      }
      #lucian-compose-wrap {
        display: none;
        margin: 0 0 10px;
        padding: 10px;
        border: 1px solid #334155;
        border-radius: 10px;
        background: rgba(15, 23, 42, 0.85);
      }
      #lucian-compose-wrap.open {
        display: block;
      }
      #lucian-compose-label {
        display: block;
        margin-bottom: 6px;
        font-size: 11px;
        color: #cbd5e1;
      }
      #lucian-compose-input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #334155;
        border-radius: 8px;
        background: #111827;
        color: #f8fafc;
        padding: 8px 9px;
        font-size: 12px;
        min-height: 92px;
        resize: vertical;
      }
      #lucian-compose-actions {
        margin-top: 8px;
        display: flex;
        justify-content: flex-end;
      }
      #lucian-cards {
        display: grid;
        gap: 8px;
        overflow: visible;
        padding-right: 2px;
      }
      .lucian-card {
        border: 1px solid #334155;
        border-radius: 10px;
        background: rgba(30, 41, 59, 0.72);
        padding: 10px;
      }
      .lucian-card-text {
        margin: 0 0 8px;
        font-size: 13px;
        line-height: 1.4;
        white-space: pre-wrap;
      }
      .lucian-card-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .lucian-card-meta {
        font-size: 11px;
        color: #94a3b8;
      }
      .lucian-action-wrap {
        display: flex;
        gap: 6px;
      }
      .lucian-chip {
        border: 0;
        border-radius: 7px;
        cursor: pointer;
        font-size: 11px;
        padding: 6px 8px;
      }
      .lucian-chip.copy {
        background: #334155;
        color: #f1f5f9;
      }
      .lucian-chip.insert {
        background: #22c55e;
        color: #052e2b;
      }
      #lucian-foot {
        display: flex;
        justify-content: flex-end;
        margin-top: 10px;
      }
    `;
    shadow.appendChild(fallbackStyle);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div id="lucian-shell">
        <div id="lucian-panel">
          <div id="lucian-head">
            <div>
              <p id="lucian-kicker">Linx</p>
              <h2 id="lucian-title">Smart replies for this post</h2>
            </div>
            <button id="lucian-close" class="lucian-btn secondary">Close</button>
          </div>
          <div id="lucian-body">
            <p id="lucian-status"></p>
            <div id="lucian-loading">Generating replies...</div>
            <div id="lucian-compose-wrap">
              <label id="lucian-compose-label" for="lucian-compose-input">Brain dump for the post</label>
              <textarea id="lucian-compose-input" placeholder="Dump raw thoughts, points, and opinions here..."></textarea>
              <div id="lucian-compose-actions">
                <button id="lucian-generate-drafts" class="lucian-btn primary">Generate drafts</button>
              </div>
            </div>
            <div id="lucian-cards"></div>
            <div id="lucian-foot">
              <button id="lucian-regenerate" class="lucian-btn primary">Regenerate</button>
            </div>
          </div>
        </div>
      </div>
    `;
    shadow.appendChild(wrapper);

    shadow.getElementById("lucian-close").addEventListener("click", closeModal);
    shadow.getElementById("lucian-regenerate").addEventListener("click", onRegenerateClick);
    shadow.getElementById("lucian-generate-drafts").addEventListener("click", onGenerateDraftsClick);
  }

  const shadow = host.shadowRoot;
  return {
    panel: shadow.getElementById("lucian-panel"),
    kicker: shadow.getElementById("lucian-kicker"),
    title: shadow.getElementById("lucian-title"),
    status: shadow.getElementById("lucian-status"),
    loading: shadow.getElementById("lucian-loading"),
    cards: shadow.getElementById("lucian-cards"),
    regenerate: shadow.getElementById("lucian-regenerate"),
    composeWrap: shadow.getElementById("lucian-compose-wrap"),
    composeInput: shadow.getElementById("lucian-compose-input")
  };
}

function openModal() {
  const refs = getModalRefs();
  refs.panel.classList.add("open");
}

function closeModal() {
  const refs = getModalRefs();
  refs.panel.classList.remove("open");
}

function setLoading(isLoading, label = "Generating replies...") {
  const refs = getModalRefs();
  refs.loading.textContent = label;
  refs.loading.classList.toggle("show", isLoading);
}

function setStatus(message) {
  const refs = getModalRefs();
  refs.status.textContent = message;
}

function setPanelMode(mode) {
  const refs = getModalRefs();
  state.mode = mode;

  if (mode === "compose") {
    refs.kicker.textContent = "Linx Draft AI";
    refs.title.textContent = "Turn brain dump into post drafts";
    refs.regenerate.textContent = "Regenerate drafts";
    refs.composeWrap.classList.add("open");
    return;
  }

  refs.kicker.textContent = "Linx";
  refs.title.textContent = "Smart replies for this post";
  refs.regenerate.textContent = "Regenerate";
  refs.composeWrap.classList.remove("open");
}

function renderReplies(replies) {
  renderCards(replies, "Reply", async (reply) => {
    const ok = await insertIntoReplyBox(reply);
    if (ok) {
      setStatus("Inserted into reply composer.");
      return true;
    }
    return false;
  });
}

function renderDrafts(drafts) {
  renderCards(drafts, "Draft", async (draft) => {
    const ok = await insertIntoComposeBox(draft);
    if (ok) {
      setStatus("Inserted into post composer.");
      return true;
    }
    return false;
  });
}

function renderCards(items, labelPrefix, onInsert) {
  const refs = getModalRefs();
  refs.cards.innerHTML = "";

  if (!items.length) {
    setStatus(state.mode === "compose" ? "No drafts generated yet." : "No replies generated yet.");
    return;
  }

  setStatus("");

  items.forEach((itemText, index) => {
    const card = document.createElement("div");
    card.className = "lucian-card";

    const text = document.createElement("p");
    text.className = "lucian-card-text";
    text.textContent = itemText;

    const actions = document.createElement("div");
    actions.className = "lucian-card-actions";
    actions.innerHTML = `
      <span class="lucian-card-meta">${labelPrefix} ${index + 1}</span>
      <div class="lucian-action-wrap">
        <button data-action="copy" class="lucian-chip copy">Copy</button>
        <button data-action="insert" class="lucian-chip insert">Insert</button>
      </div>
    `;

    actions.querySelector('[data-action="copy"]').addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(itemText);
        setStatus("Copied to clipboard.");
      } catch (_err) {
        setStatus("Copy failed. Please copy manually.");
      }
    });

    actions.querySelector('[data-action="insert"]').addEventListener("click", async () => {
      const ok = await onInsert(itemText);
      if (ok) {
        return;
      } else {
        try {
          await navigator.clipboard.writeText(itemText);
          setStatus("Could not auto-insert. Copied to clipboard instead.");
        } catch (_err) {
          setStatus("Could not auto-insert this time.");
        }
      }
    });

    card.appendChild(text);
    card.appendChild(actions);
    refs.cards.appendChild(card);
  });
}

async function onRegenerateClick() {
  if (state.mode === "compose") {
    const refs = getModalRefs();
    const latestBrainDump = refs.composeInput.value.trim() || state.lastBrainDump.trim();
    if (!latestBrainDump) {
      setStatus("Add a brain dump first, then generate drafts.");
      return;
    }
    state.lastBrainDump = latestBrainDump;
    await generateDrafts(latestBrainDump);
    return;
  }

  if (!state.currentTweet) {
    setStatus("Open a post and click AI Reply first.");
    return;
  }

  setLoading(true, "Generating replies...");
  setStatus("");

  try {
    const images = await fetchTweetImages(state.currentTweet.imageUrls || []);
    const response = await sendRuntimeMessage({
      type: "GENERATE_REPLIES",
      tweet: {
        ...state.currentTweet,
        images
      }
    });
    state.replies = response.replies || [];
    renderReplies(state.replies);
  } catch (error) {
    setStatus(error.message || "Regenerate failed. Try again.");
  } finally {
    setLoading(false);
  }
}

async function onGenerateDraftsClick() {
  const refs = getModalRefs();
  const brainDump = refs.composeInput.value.trim();
  if (!brainDump) {
    setStatus("Add a brain dump first.");
    return;
  }

  state.lastBrainDump = brainDump;
  await generateDrafts(brainDump);
}

async function generateDrafts(brainDump) {
  setLoading(true, "Drafting post options...");
  setStatus("");

  try {
    const response = await sendRuntimeMessage({
      type: "GENERATE_POST_DRAFTS",
      brainDump,
      context: {
        surface: state.composeSurface
      }
    });
    state.drafts = response.drafts || [];
    renderDrafts(state.drafts);
  } catch (error) {
    setStatus(error.message || "Could not generate drafts. Try again.");
  } finally {
    setLoading(false);
  }
}

async function insertIntoReplyBox(replyText) {
  const sourceArticle = findArticleForCurrentTweet();
  const replyButton =
    sourceArticle?.querySelector('[data-testid="reply"]') ||
    document.querySelector('[data-testid="reply"]');

  if (replyButton instanceof HTMLElement) {
    replyButton.click();
  }

  const box = await waitForReplyBox(12, 250);
  if (!box) {
    return false;
  }

  return setEditableText(box, replyText);
}

async function insertIntoComposeBox(draftText) {
  const box = await resolveActiveComposerBox();
  if (!box) {
    return false;
  }

  state.activeComposer = box;
  return setEditableText(box, draftText);
}

function findArticleForCurrentTweet() {
  if (!state.currentTweet?.text) {
    return null;
  }

  const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
  return (
    articles.find((article) => extractText(article).includes(state.currentTweet.text.slice(0, 40))) ||
    null
  );
}

async function resolveComposerFromPostButton(postButton) {
  const dialog = postButton.closest('div[role="dialog"]');
  const scopedCandidates = getComposerTextboxes(dialog || document);
  const scopedBest = pickClosestToElement(postButton, scopedCandidates);
  if (scopedBest) {
    return scopedBest;
  }

  return waitForComposeBox(8, 200);
}

async function resolveActiveComposerBox() {
  if (state.activeComposer && state.activeComposer.isConnected && isElementVisible(state.activeComposer)) {
    return state.activeComposer;
  }

  const active = document.activeElement;
  if (active instanceof HTMLElement && isComposeTextbox(active) && isElementVisible(active)) {
    return active;
  }

  return waitForComposeBox(10, 200);
}

async function waitForComposeBox(retries, delayMs) {
  for (let i = 0; i < retries; i += 1) {
    const candidates = getComposerTextboxes(document);
    const best = pickBestComposeBox(candidates);
    if (best) {
      return best;
    }
    await sleep(delayMs);
  }
  return null;
}

async function waitForReplyBox(retries, delayMs) {
  for (let i = 0; i < retries; i += 1) {
    const candidates = getComposerTextboxes(document);
    const best = pickBestReplyBox(candidates);
    if (best) {
      return best;
    }
    await sleep(delayMs);
  }
  return null;
}

function pickBestReplyBox(candidates) {
  if (!candidates.length) {
    return null;
  }

  const visible = candidates.filter(isElementVisible);
  if (!visible.length) {
    return null;
  }

  const inDialog = visible.find((el) => el.closest('div[role="dialog"]'));
  if (inDialog) {
    return inDialog;
  }

  const withReplyContext = visible.find((el) => {
    const container = el.closest("article, div[role='group'], div");
    const text = container?.innerText?.toLowerCase() || "";
    return text.includes("post your reply") || text.includes("replying to");
  });

  if (withReplyContext) {
    return withReplyContext;
  }

  return visible[0];
}

function pickBestComposeBox(candidates) {
  if (!candidates.length) {
    return null;
  }

  const visible = candidates.filter(isElementVisible);
  if (!visible.length) {
    return null;
  }

  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    const activeMatch = visible.find((el) => el === active || el.contains(active));
    if (activeMatch) {
      return activeMatch;
    }
  }

  const nonReply = visible.find((el) => !isLikelyReplyTextbox(el));
  if (nonReply) {
    return nonReply;
  }

  return visible[0];
}

function getComposerTextboxes(root) {
  const selectors = [
    '[data-testid="tweetTextarea_0"]',
    'div[role="textbox"][contenteditable="true"]',
    '.public-DraftEditor-content[contenteditable="true"]'
  ];

  const nodes = [];
  for (const selector of selectors) {
    for (const node of root.querySelectorAll(selector)) {
      if (node instanceof HTMLElement) {
        nodes.push(node);
      }
    }
  }
  return dedupeElements(nodes);
}

function isComposeTextbox(element) {
  return (
    element.matches?.('[data-testid="tweetTextarea_0"]') ||
    element.matches?.('div[role="textbox"][contenteditable="true"]') ||
    element.matches?.('.public-DraftEditor-content[contenteditable="true"]')
  );
}

function dedupeElements(items) {
  return Array.from(new Set(items));
}

function pickClosestToElement(reference, candidates) {
  const visible = candidates.filter(isElementVisible);
  if (!visible.length) {
    return null;
  }

  return visible
    .map((candidate) => ({ candidate, distance: distanceBetween(reference, candidate) }))
    .sort((a, b) => a.distance - b.distance)[0]?.candidate || null;
}

function distanceBetween(a, b) {
  const ra = a.getBoundingClientRect();
  const rb = b.getBoundingClientRect();
  const ax = ra.left + ra.width / 2;
  const ay = ra.top + ra.height / 2;
  const bx = rb.left + rb.width / 2;
  const by = rb.top + rb.height / 2;
  return Math.hypot(ax - bx, ay - by);
}

function extractComposerText(composer) {
  if (!(composer instanceof HTMLElement)) {
    return "";
  }
  return composer.innerText?.trim() || composer.textContent?.trim() || "";
}

function isLikelyReplyTextbox(element) {
  const container = element.closest("article, div[role='dialog'], div[role='group'], div");
  const text = container?.innerText?.toLowerCase() || "";
  return text.includes("post your reply") || text.includes("replying to");
}

function detectComposeSurface(postButton) {
  if (postButton.closest('div[role="dialog"]')) {
    return "modal-composer";
  }
  return "home-composer";
}

function setEditableText(box, value) {
  box.focus();
  try {
    document.execCommand("selectAll", false);
  } catch (_err) {
    // Ignore; insertion fallback below will still run.
  }

  const inserted = document.execCommand("insertText", false, value);
  if (!inserted) {
    box.textContent = value;
  }

  box.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, data: value, inputType: "insertText" }));
  box.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
  box.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function isElementVisible(element) {
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function sendRuntimeMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Unknown extension error."));
        return;
      }
      resolve(response.data);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
