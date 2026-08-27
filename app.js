/**
 * KaamBatao — Frontend logic
 * -----------------------------------------------------------
 * This file ONLY handles UI + calls a backend API for analysis.
 * It never fabricates AI results — if the backend/API is not
 * configured, the user sees a clear error, not fake data.
 * -----------------------------------------------------------
 */

// ============================================================
// CONFIG — change this when you deploy your backend somewhere
// ============================================================
const CONFIG = {
  // During local development this can stay relative ("/api/analyze")
  // if you're using a proxy. Once your backend is deployed
  // (e.g. on Render/Railway), put its full URL here, e.g.:
  // "https://kaambatao-backend.onrender.com/api/analyze"
  API_URL: "/api/analyze",
};

// ============================================================
// State
// ============================================================
const state = {
  selectedFile: null,
  previewDataUrl: null,
  lastResult: null,
};

// ============================================================
// DOM references
// ============================================================
const el = {
  brandHome: document.getElementById("brandHome"),

  // Home
  btnUploadPhoto: document.getElementById("btnUploadPhoto"),
  btnCamera: document.getElementById("btnCamera"),

  // Upload
  backFromUpload: document.getElementById("backFromUpload"),
  uploadZone: document.getElementById("uploadZone"),
  uploadEmptyState: document.getElementById("uploadEmptyState"),
  previewImage: document.getElementById("previewImage"),
  fileInputGallery: document.getElementById("fileInputGallery"),
  fileInputCamera: document.getElementById("fileInputCamera"),
  pickFromGallery: document.getElementById("pickFromGallery"),
  pickFromCamera: document.getElementById("pickFromCamera"),
  uploadPickButtons: document.getElementById("uploadPickButtons"),
  uploadPreviewButtons: document.getElementById("uploadPreviewButtons"),
  removeImage: document.getElementById("removeImage"),
  analyzeBtn: document.getElementById("analyzeBtn"),

  // Analysis
  analysisSubtext: document.getElementById("analysisSubtext"),

  // Result
  resultThumb: document.getElementById("resultThumb"),
  resultDocType: document.getElementById("resultDocType"),
  resultWhatIsIt: document.getElementById("resultWhatIsIt"),
  resultImportantInfo: document.getElementById("resultImportantInfo"),
  resultNextSteps: document.getElementById("resultNextSteps"),
  resultChecklist: document.getElementById("resultChecklist"),
  resultError: document.getElementById("resultError"),
  shareBtn: document.getElementById("shareBtn"),
  analyzeAnotherBtn: document.getElementById("analyzeAnotherBtn"),

  toast: document.getElementById("toast"),
};

// ============================================================
// Navigation
// ============================================================
function goToScreen(screenId) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

el.brandHome.addEventListener("click", () => goToScreen("screen-home"));
el.backFromUpload.addEventListener("click", () => goToScreen("screen-home"));

// ============================================================
// Home -> Upload
// ============================================================
el.btnUploadPhoto.addEventListener("click", () => {
  goToScreen("screen-upload");
});

el.btnCamera.addEventListener("click", () => {
  goToScreen("screen-upload");
  // Small delay so the screen transition finishes before the camera opens
  setTimeout(() => el.fileInputCamera.click(), 200);
});

// ============================================================
// Upload screen — picking files
// ============================================================
el.pickFromGallery.addEventListener("click", () => el.fileInputGallery.click());
el.pickFromCamera.addEventListener("click", () => el.fileInputCamera.click());

el.fileInputGallery.addEventListener("change", (e) => handleFileSelected(e.target.files[0]));
el.fileInputCamera.addEventListener("change", (e) => handleFileSelected(e.target.files[0]));

function handleFileSelected(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Sirf image file (photo/screenshot) select karein.");
    return;
  }

  const MAX_SIZE_MB = 10;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    showToast(`Image ${MAX_SIZE_MB}MB se choti honi chahiye.`);
    return;
  }

  state.selectedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    state.previewDataUrl = e.target.result;
    el.previewImage.src = state.previewDataUrl;
    el.previewImage.classList.remove("hidden");
    el.uploadEmptyState.classList.add("hidden");
    el.uploadPickButtons.classList.add("hidden");
    el.uploadPreviewButtons.classList.remove("hidden");
    el.analyzeBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

el.removeImage.addEventListener("click", resetUpload);

function resetUpload() {
  state.selectedFile = null;
  state.previewDataUrl = null;
  el.fileInputGallery.value = "";
  el.fileInputCamera.value = "";
  el.previewImage.classList.add("hidden");
  el.previewImage.src = "";
  el.uploadEmptyState.classList.remove("hidden");
  el.uploadPickButtons.classList.remove("hidden");
  el.uploadPreviewButtons.classList.add("hidden");
  el.analyzeBtn.disabled = true;
}

// ============================================================
// Analyze
// ============================================================
el.analyzeBtn.addEventListener("click", analyzeDocument);

const LOADING_MESSAGES = [
  "AI aapka document samajh raha hai...",
  "Zaroori jaankari dhoondh rahe hain...",
  "Bas thoda intezaar aur...",
];

async function analyzeDocument() {
  if (!state.selectedFile) return;

  goToScreen("screen-analysis");
  cycleLoadingMessages();

  try {
    const formData = new FormData();
    formData.append("image", state.selectedFile);

    const response = await fetch(CONFIG.API_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errBody = await safeJson(response);
      throw new Error(errBody?.message || `Server error (${response.status})`);
    }

    const data = await response.json();
    renderResult(data);
    goToScreen("screen-result");
  } catch (err) {
    renderResultError(err);
    goToScreen("screen-result");
  }
}

function cycleLoadingMessages() {
  let i = 0;
  el.analysisSubtext.textContent = "Thoda intezaar karein, ye kuch second lega.";
  const intervalId = setInterval(() => {
    if (!document.getElementById("screen-analysis").classList.contains("active")) {
      clearInterval(intervalId);
      return;
    }
    i = (i + 1) % LOADING_MESSAGES.length;
    document.getElementById("analysis-title").textContent = LOADING_MESSAGES[i];
  }, 1800);
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ============================================================
// Render result screen
// ============================================================
function renderResult(data) {
  state.lastResult = data;

  el.resultError.classList.add("hidden");
  el.resultError.textContent = "";

  el.resultThumb.src = state.previewDataUrl || "";
  el.resultDocType.textContent = data.documentType || "Document";
  el.resultWhatIsIt.textContent = data.whatIsIt || "—";

  fillList(el.resultImportantInfo, data.importantInfo);
  fillList(el.resultNextSteps, data.nextSteps);
  fillChecklist(el.resultChecklist, data.checklist);
}

function fillList(ulEl, items) {
  ulEl.innerHTML = "";
  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Koi jaankari nahi mili.";
    ulEl.appendChild(li);
    return;
  }
  items.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    ulEl.appendChild(li);
  });
}

function fillChecklist(ulEl, items) {
  ulEl.innerHTML = "";
  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Koi checklist nahi mili.";
    ulEl.appendChild(li);
    return;
  }
  items.forEach((text, idx) => {
    const li = document.createElement("li");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `check-${idx}`;

    const label = document.createElement("label");
    label.htmlFor = `check-${idx}`;
    label.textContent = text;

    checkbox.addEventListener("change", () => {
      label.classList.toggle("checked-label", checkbox.checked);
    });

    li.appendChild(checkbox);
    li.appendChild(label);
    ulEl.appendChild(li);
  });
}

function renderResultError(err) {
  state.lastResult = null;
  el.resultThumb.src = state.previewDataUrl || "";
  el.resultDocType.textContent = "";
  el.resultWhatIsIt.textContent = "—";
  fillList(el.resultImportantInfo, []);
  fillList(el.resultNextSteps, []);
  fillChecklist(el.resultChecklist, []);

  el.resultError.classList.remove("hidden");
  el.resultError.textContent =
    "⚠️ Analysis abhi nahi ho paayi. " +
    (err?.message ? err.message + " " : "") +
    "Backend AI API connect nahi hai ya server down hai — README dekhein.";
}

// ============================================================
// Share / Analyze another
// ============================================================
el.shareBtn.addEventListener("click", async () => {
  if (!state.lastResult) {
    showToast("Pehle ek document analyze karein.");
    return;
  }

  const { documentType, whatIsIt, nextSteps } = state.lastResult;
  const shareText = [
    `KaamBatao Result: ${documentType || "Document"}`,
    ``,
    `Ye kya hai: ${whatIsIt || "-"}`,
    ``,
    `Ab kya karein: ${(nextSteps || []).join(", ")}`,
  ].join("\n");

  if (navigator.share) {
    try {
      await navigator.share({ title: "KaamBatao Result", text: shareText });
    } catch {
      /* user cancelled share — do nothing */
    }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(shareText);
    showToast("Result copy ho gaya!");
  } else {
    showToast("Sharing is device par support nahi hai.");
  }
});

el.analyzeAnotherBtn.addEventListener("click", () => {
  resetUpload();
  goToScreen("screen-upload");
});

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
