/**
 * Tavunera — Frontend logic
 * -----------------------------------------------------------
 * This file only handles UI + talks to backend endpoints. It
 * never invents AI results. Today, only ONE backend route is
 * real: POST /api/analyze (photo/document understanding —
 * this is the same route KaamBatao used, kept working as-is).
 *
 * Every other capability (general chat, web search, image
 * generation, PDF generation, code help, non-image file
 * analysis) is wired to call a clearly-named backend endpoint
 * that does not exist yet. When that call fails, the UI shows
 * an honest "not connected yet" message instead of faking a
 * response. Building each real backend route is future work —
 * this file is just the ready-made frontend contract for it.
 * -----------------------------------------------------------
 */

// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
  // Existing, working route (unchanged from KaamBatao).
  ANALYZE_URL: "/api/analyze",

  // Not implemented on the backend yet. Each is a separate,
  // clearly named endpoint so the real backend can be built
  // feature-by-feature later without changing this frontend.
  ENDPOINTS: {
    chat: "/api/chat",
    search: "/api/search",
    "image-gen": "/api/generate-image",
    pdf: "/api/generate-pdf",
    code: "/api/code",
    "file-analysis": "/api/analyze-file",
  },
};

const MODE_LABELS = {
  search: "🔎 Deep Search",
  "image-gen": "🖼️ Create Image",
  pdf: "📄 PDF",
  code: "💻 Code",
  "file-analysis": "📊 Analyze File",
};

const MODE_PLACEHOLDERS = {
  search: "Kya research karna hai? e.g. 'Latest UPI rules 2026'",
  "image-gen": "Kaisi image banani hai? e.g. 'Sunset over mountains, minimal style'",
  pdf: "Kaunsa document banana hai? e.g. 'Rent agreement draft'",
  code: "Coding mein kya madad chahiye? e.g. 'Is Python error ko fix karo'",
  "file-analysis": "File attach karein aur bataayein kya jaanna hai",
};

// ============================================================
// State
// ============================================================
const state = {
  messages: [], // { id, role: 'user'|'ai', ...content }
  attachedFile: null,
  attachedPreviewUrl: null,
  activeMode: null, // one of MODE_LABELS keys, or null = default chat/photo
  hasEnteredChat: false,
};

// ============================================================
// DOM references
// ============================================================
const el = {
  brandHome: document.getElementById("brandHome"),
  chatHeaderActions: document.getElementById("chatHeaderActions"),
  clearChatBtn: document.getElementById("clearChatBtn"),
  newChatBtn: document.getElementById("newChatBtn"),

  mainScroll: document.getElementById("mainScroll"),
  viewHome: document.getElementById("view-home"),
  viewChat: document.getElementById("view-chat"),
  chatList: document.getElementById("chatList"),
  quickActions: document.getElementById("quickActions"),

  attachmentChip: document.getElementById("attachmentChip"),
  attachmentThumb: document.getElementById("attachmentThumb"),
  attachmentName: document.getElementById("attachmentName"),
  attachmentRemove: document.getElementById("attachmentRemove"),

  modeChip: document.getElementById("modeChip"),
  modeChipLabel: document.getElementById("modeChipLabel"),
  modeChipRemove: document.getElementById("modeChipRemove"),

  composerInput: document.getElementById("composerInput"),
  sendBtn: document.getElementById("sendBtn"),
  attachFileBtn: document.getElementById("attachFileBtn"),
  attachPhotoBtn: document.getElementById("attachPhotoBtn"),
  attachCameraBtn: document.getElementById("attachCameraBtn"),

  fileInputGeneric: document.getElementById("fileInputGeneric"),
  fileInputPhoto: document.getElementById("fileInputPhoto"),
  fileInputCamera: document.getElementById("fileInputCamera"),

  toast: document.getElementById("toast"),
};

// ============================================================
// View switching (Home <-> Chat)
// ============================================================
function showView(name) {
  el.viewHome.classList.toggle("active", name === "home");
  el.viewChat.classList.toggle("active", name === "chat");
  el.chatHeaderActions.classList.toggle("hidden", name !== "chat");
}

function enterChatIfNeeded() {
  if (!state.hasEnteredChat) {
    state.hasEnteredChat = true;
    showView("chat");
  }
}

el.brandHome.addEventListener("click", goHome);
el.newChatBtn.addEventListener("click", goHome);

function goHome() {
  state.messages = [];
  state.hasEnteredChat = false;
  clearAttachment();
  clearMode();
  el.composerInput.value = "";
  autoResizeComposer();
  updateSendButtonState();
  el.chatList.innerHTML = "";
  showView("home");
}

el.clearChatBtn.addEventListener("click", () => {
  state.messages = [];
  el.chatList.innerHTML = "";
});

// ============================================================
// Quick action cards (Home)
// ============================================================
el.quickActions.addEventListener("click", (e) => {
  const card = e.target.closest(".quick-card");
  if (!card) return;
  const mode = card.dataset.mode;
  setMode(mode);
  enterChatIfNeeded();
  el.composerInput.focus();
});

function setMode(mode) {
  state.activeMode = mode;
  el.modeChipLabel.textContent = MODE_LABELS[mode] || mode;
  el.modeChip.classList.remove("hidden");
  el.composerInput.placeholder = MODE_PLACEHOLDERS[mode] || "Kuch bhi poochein...";
}

function clearMode() {
  state.activeMode = null;
  el.modeChip.classList.add("hidden");
  el.composerInput.placeholder = "Kuch bhi poochein... ya photo bhejein";
}

el.modeChipRemove.addEventListener("click", clearMode);

// ============================================================
// Composer — text input
// ============================================================
el.composerInput.addEventListener("input", () => {
  autoResizeComposer();
  updateSendButtonState();
});

function autoResizeComposer() {
  el.composerInput.style.height = "auto";
  el.composerInput.style.height = Math.min(el.composerInput.scrollHeight, 120) + "px";
}

function updateSendButtonState() {
  const hasText = el.composerInput.value.trim().length > 0;
  el.sendBtn.disabled = !hasText && !state.attachedFile;
}

el.composerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!el.sendBtn.disabled) sendMessage();
  }
});

// ============================================================
// Composer — attachments
// ============================================================
el.attachFileBtn.addEventListener("click", () => el.fileInputGeneric.click());
el.attachPhotoBtn.addEventListener("click", () => el.fileInputPhoto.click());
el.attachCameraBtn.addEventListener("click", () => el.fileInputCamera.click());

el.fileInputGeneric.addEventListener("change", (e) => handleFileSelected(e.target.files[0]));
el.fileInputPhoto.addEventListener("change", (e) => handleFileSelected(e.target.files[0]));
el.fileInputCamera.addEventListener("change", (e) => handleFileSelected(e.target.files[0]));

function handleFileSelected(file) {
  if (!file) return;

  const MAX_SIZE_MB = 10;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    showToast(`File ${MAX_SIZE_MB}MB se choti honi chahiye.`);
    return;
  }

  state.attachedFile = file;

  if (file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = (e) => {
      state.attachedPreviewUrl = e.target.result;
      el.attachmentThumb.src = state.attachedPreviewUrl;
      el.attachmentThumb.classList.remove("hidden");
      el.attachmentName.textContent = file.name;
      el.attachmentChip.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  } else {
    state.attachedPreviewUrl = null;
    el.attachmentThumb.classList.add("hidden");
    el.attachmentName.textContent = file.name;
    el.attachmentChip.classList.remove("hidden");
  }

  updateSendButtonState();
}

el.attachmentRemove.addEventListener("click", clearAttachment);

function clearAttachment() {
  state.attachedFile = null;
  state.attachedPreviewUrl = null;
  el.fileInputGeneric.value = "";
  el.fileInputPhoto.value = "";
  el.fileInputCamera.value = "";
  el.attachmentChip.classList.add("hidden");
  el.attachmentThumb.src = "";
  updateSendButtonState();
}

// ============================================================
// Sending a message
// ============================================================
el.sendBtn.addEventListener("click", sendMessage);

async function sendMessage() {
  const text = el.composerInput.value.trim();
  const file = state.attachedFile;
  const filePreviewUrl = state.attachedPreviewUrl;
  const mode = state.activeMode;

  if (!text && !file) return;

  enterChatIfNeeded();

  // Render the user's message bubble immediately
  addMessage({
    role: "user",
    text,
    fileName: file ? file.name : null,
    fileIsImage: file ? file.type.startsWith("image/") : false,
    filePreviewUrl,
  });

  // Reset composer for the next message
  el.composerInput.value = "";
  autoResizeComposer();
  clearAttachment();
  clearMode();
  updateSendButtonState();

  // Show typing indicator
  const typingId = addTypingIndicator();

  try {
    if (file && file.type.startsWith("image/") && (!mode || mode === "file-analysis")) {
      // Reuse the existing, working KaamBatao photo/document analysis route.
      const result = await callAnalyzeApi(file);
      removeTypingIndicator(typingId);
      addMessage({ role: "ai", kind: "analysis", data: result });
    } else {
      // Every other capability: call its dedicated (not-yet-built) endpoint.
      const routeMode = mode || "chat";
      const result = await callFutureApi(routeMode, { text, file });
      removeTypingIndicator(typingId);
      addMessage({ role: "ai", kind: "text", text: result });
    }
  } catch (err) {
    removeTypingIndicator(typingId);
    addMessage({ role: "ai", kind: "error", text: err.message });
  }
}

// ============================================================
// Backend calls
// ============================================================
async function callAnalyzeApi(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(CONFIG.ANALYZE_URL, { method: "POST", body: formData });
  const body = await safeJson(response);

  if (!response.ok) {
    throw new Error(body?.message || `Analysis abhi nahi ho paayi (${response.status}).`);
  }
  return body;
}

async function callFutureApi(mode, { text, file }) {
  const url = CONFIG.ENDPOINTS[mode] || CONFIG.ENDPOINTS.chat;

  const formData = new FormData();
  if (text) formData.append("message", text);
  if (file) formData.append("file", file);

  let response;
  try {
    response = await fetch(url, { method: "POST", body: formData });
  } catch {
    throw new Error("Ye feature abhi backend se connect nahi hai. Jald hi add kiya jaayega.");
  }

  if (!response.ok) {
    throw new Error("Ye feature abhi taiyaar nahi hai — backend jald connect hoga.");
  }

  const body = await safeJson(response);
  return body?.reply || "—";
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ============================================================
// Rendering messages
// ============================================================
let msgCounter = 0;

function addMessage(msg) {
  const id = `msg-${++msgCounter}`;
  state.messages.push({ id, ...msg });

  const row = document.createElement("div");
  row.className = `msg-row ${msg.role}`;
  row.id = id;

  const bubble = document.createElement("div");
  bubble.className = `msg-bubble ${msg.role}`;

  if (msg.role === "user") {
    if (msg.fileIsImage && msg.filePreviewUrl) {
      const img = document.createElement("img");
      img.src = msg.filePreviewUrl;
      img.className = "msg-attachment-img";
      img.alt = "Attached image";
      bubble.appendChild(img);
    } else if (msg.fileName) {
      const fileChip = document.createElement("div");
      fileChip.className = "msg-attachment-file";
      fileChip.textContent = `📎 ${msg.fileName}`;
      bubble.appendChild(fileChip);
    }
    if (msg.text) {
      const p = document.createElement("p");
      p.className = "ai-block-text";
      p.textContent = msg.text;
      bubble.appendChild(p);
    }
  } else if (msg.kind === "analysis") {
    bubble.appendChild(buildAnalysisContent(msg.data));
  } else if (msg.kind === "error") {
    const p = document.createElement("p");
    p.className = "ai-error-text";
    p.textContent = `⚠️ ${msg.text}`;
    bubble.appendChild(p);
  } else {
    const p = document.createElement("p");
    p.className = "ai-block-text";
    p.textContent = msg.text;
    bubble.appendChild(p);
  }

  row.appendChild(bubble);
  el.chatList.appendChild(row);
  scrollChatToBottom();
}

function buildAnalysisContent(data) {
  const wrap = document.createElement("div");

  if (data?.documentType) {
    const tag = document.createElement("span");
    tag.className = "ai-doctype-tag";
    tag.textContent = data.documentType;
    wrap.appendChild(tag);
  }

  wrap.appendChild(
    buildBlock("📄 Ye kya hai?", "text", data?.whatIsIt || "—")
  );
  wrap.appendChild(
    buildBlock("📌 Important baatein", "list", data?.importantInfo || [])
  );
  wrap.appendChild(
    buildBlock("➡️ Ab kya karein?", "list", data?.nextSteps || [])
  );
  wrap.appendChild(
    buildBlock("✅ Checklist", "list", data?.checklist || [])
  );

  return wrap;
}

function buildBlock(heading, type, content) {
  const block = document.createElement("div");
  block.className = "ai-block";

  const h = document.createElement("h4");
  h.className = "ai-block-heading";
  h.textContent = heading;
  block.appendChild(h);

  if (type === "text") {
    const p = document.createElement("p");
    p.className = "ai-block-text";
    p.textContent = content;
    block.appendChild(p);
  } else {
    const ul = document.createElement("ul");
    if (!content || content.length === 0) {
      const li = document.createElement("li");
      li.textContent = "—";
      ul.appendChild(li);
    } else {
      content.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        ul.appendChild(li);
      });
    }
    block.appendChild(ul);
  }

  return block;
}

function addTypingIndicator() {
  const id = `typing-${++msgCounter}`;
  const row = document.createElement("div");
  row.className = "msg-row ai";
  row.id = id;

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble ai";
  bubble.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;

  row.appendChild(bubble);
  el.chatList.appendChild(row);
  scrollChatToBottom();
  return id;
}

function removeTypingIndicator(id) {
  const rowEl = document.getElementById(id);
  if (rowEl) rowEl.remove();
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    el.mainScroll.scrollTop = el.mainScroll.scrollHeight;
  });
}

// ============================================================
// Toast helper
// ============================================================
let toastTimeout;
function showToast(message) {
  clearTimeout(toastTimeout);
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  toastTimeout = setTimeout(() => el.toast.classList.add("hidden"), 2600);
}
