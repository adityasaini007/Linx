const BUTTON_CLASS = "lucian-ai-reply-btn";
const COMPOSE_BUTTON_CLASS = "lucian-ai-draft-btn";
const PROCESSED_ATTR = "data-lucian-processed";
const COMPOSE_PROCESSED_ATTR = "data-lucian-compose-processed";
const MODAL_HOST_ID = "lucian-reply-modal-host";
const PLATFORM = detectPlatform();

const state = {
  mode: "reply",
  currentPost: null,
  replies: [],
  drafts: [],
  lastBrainDump: "",
  userOpinion: "",
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
  const posts = findPostsInScope(root);

  for (const post of posts) {
    if (post.getAttribute(PROCESSED_ATTR) === "true") {
      continue;
    }

    const actionBar = findActionBar(post);
    if (!actionBar) {
      continue;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = BUTTON_CLASS;
    btn.textContent = "✦ Articulate Reply";
    btn.title = `Articulate your ${platformLabel()} reply`;
    btn.addEventListener("click", () => onAiReplyClick(post, btn));
    actionBar.appendChild(btn);

    post.setAttribute(PROCESSED_ATTR, "true");
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
    btn.textContent = "✦ Articulate Post";
    btn.title = `Turn your thoughts into ${platformLabel()} post drafts`;
    btn.addEventListener("click", () => onAiDraftClick(postButton, btn));

    buttonSlot.insertBefore(btn, postButton);
    postButton.setAttribute(COMPOSE_PROCESSED_ATTR, "true");
  }
}

function composerPostButtonSelector() {
  if (isLinkedInPlatform()) {
    return [
      "button.share-actions__primary-action",
      "button.share-box_actions__primary-action",
      'button[aria-label*="Post"]',
      'button[aria-label*="Create post"]'
    ].join(", ");
  }

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

  if (label.includes("reply") || label.includes("comment") || label.includes("send")) {
    return false;
  }

  if (isLinkedInPlatform()) {
    if (label.includes("start a post")) {
      return false;
    }
    return label.includes("post") || label.includes("create post");
  }

  return label.includes("post") || label.includes("tweetbuttoninline");
}

function findComposerButtonSlot(postButton) {
  if (isLinkedInPlatform()) {
    return postButton.parentElement || postButton.closest(".share-actions, .share-box_actions, footer, form, div") || null;
  }

  const directParent = postButton.parentElement;
  if (directParent) {
    return directParent;
  }
  return postButton.closest('div[role="group"], div') || null;
}

function findActionBar(post) {
  if (isLinkedInPlatform()) {
    const selectors = [
      ".social-details-social-actions",
      ".feed-shared-social-actions",
      ".update-v2-social-activity"
    ];

    for (const selector of selectors) {
      const node = post.querySelector(selector);
      if (node instanceof HTMLElement) {
        return node;
      }
    }

    const commentButton = findLinkedInCommentButton(post);
    if (commentButton) {
      return commentButton.closest("div") || commentButton.parentElement || null;
    }

    return null;
  }

  const selectors = ['div[role="group"]', '[data-testid="reply"]'];

  for (const selector of selectors) {
    const node = post.querySelector(selector);
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

async function onAiReplyClick(postElement, button) {
  button.disabled = true;

  try {
    state.mode = "reply";
    const post = await extractPostData(postElement);
    state.currentPost = post;
    state.userOpinion = "";

    const refs = getModalRefs();
    refs.opinionInput.value = "";
    refs.cards.innerHTML = "";

    openModal();
    setPanelMode("reply");
    showOpinionInput(true);
    setLoading(false);
    setStatus("");
  } catch (error) {
    setStatus(error.message || "Could not load post. Try again.");
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

    state.drafts = [];
    refs.cards.innerHTML = "";
    setStatus(brainDump
      ? "Review or refine your thoughts, then click Generate drafts."
      : "Add your thoughts first, then click Generate drafts.");
  } catch (error) {
    setStatus(error.message || "Could not generate drafts. Try again.");
    setLoading(false);
  } finally {
    button.disabled = false;
  }
}

async function extractPostData(postElement) {
  const stablePost = await resolveStablePost(postElement);

  const text = extractText(stablePost);
  if (!text) {
    throw new Error("Could not read this post yet. Scroll a bit and try again.");
  }

  const { authorName, authorHandle } = extractAuthor(stablePost);
  const imageUrls = extractImageUrls(stablePost);

  return {
    text,
    authorName,
    authorHandle,
    imageUrls,
    platform: PLATFORM
  };
}

async function resolveStablePost(postElement) {
  if (postElement?.isConnected) {
    return postElement;
  }

  for (let i = 0; i < 6; i += 1) {
    const candidate = findPostsInScope(document)[0];
    if (candidate) {
      return candidate;
    }
    await sleep(150);
  }

  throw new Error("Could not locate the post container.");
}

function extractText(post) {
  const selectors = isLinkedInPlatform()
    ? [
        ".update-components-text",
        ".feed-shared-update-v2__description-wrapper",
        ".feed-shared-inline-show-more-text",
        '[data-test-id="main-feed-activity-card__commentary"]'
      ]
    : ['[data-testid="tweetText"]', "div[lang]", '[data-testid="tweet"] div[dir="auto"]'];

  for (const selector of selectors) {
    const nodes = Array.from(post.querySelectorAll(selector));
    const text = nodes
      .map((node) => cleanExtractedText(node.innerText || node.textContent || ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (text) {
      return text;
    }
  }

  if (isLinkedInPlatform()) {
    const fallback = cleanExtractedText(
      Array.from(post.querySelectorAll("span, div, p"))
        .map((node) => node.textContent || "")
        .join("\n")
    );
    return fallback;
  }

  return "";
}

function extractAuthor(post) {
  if (isLinkedInPlatform()) {
    const userNode =
      post.querySelector(".update-components-actor__title") ||
      post.querySelector(".feed-shared-actor__name") ||
      post.querySelector('a[href*="/in/"]');

    const rawText = cleanExtractedText(userNode?.textContent || "");
    const authorName = rawText.split("\n")[0]?.trim() || "Unknown";
    const profileLink = userNode?.closest("a") || post.querySelector('a[href*="/in/"]');
    const href = profileLink?.getAttribute("href") || "";
    const handle = extractLinkedInHandle(href, authorName);

    return {
      authorName,
      authorHandle: handle
    };
  }

  const userNode = post.querySelector('[data-testid="User-Name"]');
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

  const links = Array.from(post.querySelectorAll('a[role="link"]'));
  const handleLink = links.find((a) => a.getAttribute("href")?.match(/^\/[^/]+$/));
  const handle = handleLink?.getAttribute("href")?.replace("/", "@") || "@unknown";

  return {
    authorName: "Unknown",
    authorHandle: handle
  };
}

function extractImageUrls(post) {
  const urls = new Set();
  const selectors = isLinkedInPlatform()
    ? [
        ".update-components-image img",
        ".update-components-article__image img",
        ".feed-shared-image__image",
        'img[src*="media.licdn.com"]'
      ]
    : ['[data-testid="tweetPhoto"] img', 'img[src*="pbs.twimg.com/media"]'];

  for (const selector of selectors) {
    const images = Array.from(post.querySelectorAll(selector));
    for (const img of images) {
      const src = img.getAttribute("src") || "";
      if (!src || shouldSkipImage(img, src)) {
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

async function fetchPostImages(imageUrls) {
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

function findPostsInScope(root) {
  const selectors = isLinkedInPlatform()
    ? [
        "div.feed-shared-update-v2",
        "div[data-urn^='urn:li:activity:']",
        "div[data-id^='urn:li:activity:']"
      ]
    : ['article[data-testid="tweet"]'];

  const posts = dedupeElements(queryMatchingElements(root, selectors)).filter((node) => node instanceof HTMLElement);
  if (!isLinkedInPlatform()) {
    return posts;
  }

  return posts.filter((candidate) => !posts.some((other) => other !== candidate && other.contains(candidate)));
}

function queryMatchingElements(root, selectors) {
  const nodes = [];
  if (!(root instanceof Element || root instanceof Document)) {
    return nodes;
  }

  for (const selector of selectors) {
    if (root instanceof Element && root.matches(selector)) {
      nodes.push(root);
    }
    for (const node of root.querySelectorAll(selector)) {
      if (node instanceof HTMLElement) {
        nodes.push(node);
      }
    }
  }

  return nodes;
}

function detectPlatform() {
  return window.location.hostname.includes("linkedin.com") ? "linkedin" : "x";
}

function isLinkedInPlatform() {
  return PLATFORM === "linkedin";
}

function platformLabel(platform = PLATFORM) {
  return platform === "linkedin" ? "LinkedIn" : "X";
}

function cleanExtractedText(text) {
  return String(text || "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractLinkedInHandle(href, authorName) {
  try {
    const url = new URL(href, window.location.origin);
    const parts = url.pathname.split("/").filter(Boolean);
    const profileSlug = parts[1] || parts[0];
    if (profileSlug) {
      return `linkedin.com/${parts.join("/")}`;
    }
  } catch (_err) {
    // Fall back below.
  }

  if (authorName && authorName !== "Unknown") {
    return authorName;
  }

  return "linkedin.com";
}

function shouldSkipImage(img, src) {
  if (src.includes("emoji") || src.includes("profile_images") || src.includes("profile-displayphoto")) {
    return true;
  }

  if (isLinkedInPlatform()) {
    const width = Number(img.getAttribute("width") || img.naturalWidth || 0);
    const height = Number(img.getAttribute("height") || img.naturalHeight || 0);
    if ((width && width < 120) || (height && height < 120)) {
      return true;
    }
  }

  return false;
}

function findLinkedInCommentButton(post) {
  const buttons = Array.from(post.querySelectorAll("button"));
  return (
    buttons.find((button) => {
      const text = [
        button.textContent || "",
        button.getAttribute("aria-label") || "",
        button.getAttribute("data-control-name") || ""
      ]
        .join(" ")
        .toLowerCase();
      return text.includes("comment");
    }) || null
  );
}

function getModalRefs() {
  let host = document.getElementById(MODAL_HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = MODAL_HOST_ID;
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });

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
        gap: 8px;
        margin-top: 10px;
      }
      #lucian-opinion-wrap {
        display: none;
        margin: 0 0 10px;
        padding: 10px;
        border: 1px solid #334155;
        border-radius: 10px;
        background: rgba(15, 23, 42, 0.85);
      }
      #lucian-opinion-wrap.open {
        display: block;
      }
      #lucian-opinion-label {
        display: block;
        margin-bottom: 6px;
        font-size: 11px;
        color: #cbd5e1;
      }
      #lucian-opinion-input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #334155;
        border-radius: 8px;
        background: #111827;
        color: #f8fafc;
        padding: 8px 9px;
        font-size: 12px;
        min-height: 72px;
        resize: vertical;
      }
      #lucian-opinion-actions {
        margin-top: 8px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      #lucian-different-angle {
        display: none;
      }
      #lucian-different-angle.show {
        display: inline-block;
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
              <h2 id="lucian-title">Articulate your take for this post</h2>
            </div>
            <button id="lucian-close" class="lucian-btn secondary">Close</button>
          </div>
          <div id="lucian-body">
            <p id="lucian-status"></p>
            <div id="lucian-loading">Generating options...</div>
            <div id="lucian-opinion-wrap">
              <label id="lucian-opinion-label" for="lucian-opinion-input">What do you want to say?</label>
              <textarea id="lucian-opinion-input" placeholder="Share your angle, opinion, or reaction before Linx articulates it..."></textarea>
              <div id="lucian-opinion-actions">
                <button id="lucian-generate-opinion-btn" class="lucian-btn primary">Articulate replies</button>
              </div>
            </div>
            <div id="lucian-compose-wrap">
              <label id="lucian-compose-label" for="lucian-compose-input">Your thoughts for the post</label>
              <textarea id="lucian-compose-input" placeholder="Dump raw thoughts, points, and opinions here before Linx shapes them..."></textarea>
              <div id="lucian-compose-actions">
                <button id="lucian-generate-drafts" class="lucian-btn primary">Generate drafts</button>
              </div>
            </div>
            <div id="lucian-cards"></div>
            <div id="lucian-foot">
              <button id="lucian-different-angle" class="lucian-btn secondary">Try different angle</button>
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
    shadow.getElementById("lucian-generate-opinion-btn").addEventListener("click", onGenerateWithOpinion);
    shadow.getElementById("lucian-different-angle").addEventListener("click", onTryDifferentAngle);
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
    composeInput: shadow.getElementById("lucian-compose-input"),
    opinionWrap: shadow.getElementById("lucian-opinion-wrap"),
    opinionInput: shadow.getElementById("lucian-opinion-input"),
    differentAngle: shadow.getElementById("lucian-different-angle")
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

function setLoading(isLoading, label = "Generating options...") {
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
    refs.kicker.textContent = "Linx Articulator";
    refs.title.textContent = `Turn your thoughts into ${platformLabel()} post drafts`;
    refs.regenerate.textContent = "Regenerate drafts";
    refs.composeWrap.classList.add("open");
    refs.opinionWrap.classList.remove("open");
    refs.differentAngle.classList.remove("show");
    return;
  }

  refs.kicker.textContent = "Linx Articulator";
  refs.title.textContent = `Turn your take into ${platformLabel()} replies`;
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

  if (!state.currentPost) {
    setStatus("Open a post and click Articulate Reply first.");
    return;
  }

  if (!state.userOpinion.trim()) {
    setStatus("Add your take first.");
    showOpinionInput(true);
    return;
  }

  await generateReplies();
}

async function onGenerateWithOpinion() {
  const refs = getModalRefs();
  state.userOpinion = refs.opinionInput.value.trim();
  if (!state.userOpinion) {
    setStatus("Add your take first.");
    refs.opinionInput.focus();
    return;
  }
  showOpinionInput(false);
  await generateReplies();
}

function onTryDifferentAngle() {
  const refs = getModalRefs();
  refs.opinionInput.value = state.userOpinion;
  refs.cards.innerHTML = "";
  showOpinionInput(true);
  showDifferentAngleButton(false);
  setStatus("");
}

function showOpinionInput(visible) {
  const refs = getModalRefs();
  refs.opinionWrap.classList.toggle("open", visible);
  if (visible) {
    refs.opinionInput.focus();
  }
}

function showDifferentAngleButton(visible) {
  const refs = getModalRefs();
  refs.differentAngle.classList.toggle("show", visible);
}

async function generateReplies() {
  if (!state.currentPost) {
    setStatus("Open a post and click Articulate Reply first.");
    return;
  }

  if (!state.userOpinion.trim()) {
    setStatus("Add your take first.");
    showOpinionInput(true);
    return;
  }

  setLoading(true, "Generating replies...");
  setStatus("");

  try {
    const images = await fetchPostImages(state.currentPost.imageUrls || []);
    const response = await sendRuntimeMessage({
      type: "GENERATE_REPLIES",
      post: {
        ...state.currentPost,
        images
      },
      userOpinion: state.userOpinion
    });
    state.replies = response.replies || [];
    renderReplies(state.replies);
    showDifferentAngleButton(true);
  } catch (error) {
    setStatus(error.message || "Could not generate replies. Try again.");
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
        surface: state.composeSurface,
        platform: PLATFORM
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
  const sourcePost = findPostForCurrentSelection();
  const replyButton = isLinkedInPlatform()
    ? findLinkedInCommentButton(sourcePost || document)
    : sourcePost?.querySelector('[data-testid="reply"]') || document.querySelector('[data-testid="reply"]');

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

function findCurrentPostElement() {
  if (!state.currentPost?.text) {
    return null;
  }

  const posts = findPostsInScope(document);
  return posts.find((post) => extractText(post).includes(state.currentPost.text.slice(0, 40))) || null;
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
    if (isLinkedInPlatform()) {
      return (
        text.includes("add a comment") ||
        text.includes("comment as") ||
        text.includes("reply to comment") ||
        text.includes("leave your thoughts")
      );
    }
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
  const selectors = isLinkedInPlatform()
    ? [
        'div[role="textbox"][contenteditable="true"]',
        'div[contenteditable="true"][data-placeholder]',
        '.ql-editor[contenteditable="true"]',
        '.mentions-texteditor__contenteditable[contenteditable="true"]'
      ]
    : [
        '[data-testid="tweetTextarea_0"]',
        'div[role="textbox"][contenteditable="true"]',
        '.public-DraftEditor-content[contenteditable="true"]'
      ];

  const nodes = [];
  for (const selector of selectors) {
    for (const node of root.querySelectorAll(selector)) {
      if (node instanceof HTMLElement && isComposeTextbox(node)) {
        nodes.push(node);
      }
    }
  }
  return dedupeElements(nodes);
}

function isComposeTextbox(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (isLinkedInPlatform()) {
    const placeholder = [
      element.getAttribute("data-placeholder") || "",
      element.getAttribute("aria-label") || "",
      element.textContent || ""
    ]
      .join(" ")
      .toLowerCase();

    return (
      element.matches?.('div[role="textbox"][contenteditable="true"]') ||
      element.matches?.('div[contenteditable="true"][data-placeholder]') ||
      element.matches?.('.ql-editor[contenteditable="true"]') ||
      element.matches?.('.mentions-texteditor__contenteditable[contenteditable="true"]') ||
      placeholder.includes("what do you want to talk about") ||
      placeholder.includes("add a comment")
    );
  }

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
  if (isLinkedInPlatform()) {
    return (
      text.includes("add a comment") ||
      text.includes("comment as") ||
      text.includes("reply to comment") ||
      text.includes("leave your thoughts")
    );
  }
  return text.includes("post your reply") || text.includes("replying to");
}

function detectComposeSurface(postButton) {
  if (postButton.closest('div[role="dialog"]')) {
    return "modal-composer";
  }
  if (isLinkedInPlatform()) {
    return "inline-composer";
  }
  return "home-composer";
}

function setEditableText(box, value) {
  box.focus();

  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(box);
    selection.addRange(range);
  }

  try {
    document.execCommand("selectAll", false);
  } catch (_err) {
    // Ignore; insertion fallback below will still run.
  }

  const inserted = document.execCommand("insertText", false, value);
  if (!inserted) {
    if (box.matches(".ql-editor, .mentions-texteditor__contenteditable")) {
      box.innerHTML = "";
      const paragraph = document.createElement("p");
      paragraph.textContent = value;
      box.appendChild(paragraph);
    } else {
      box.textContent = value;
    }
  }

  box.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, data: value, inputType: "insertText" }));
  box.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
  box.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function findPostForCurrentSelection() {
  return findCurrentPostElement();
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
