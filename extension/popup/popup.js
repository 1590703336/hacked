// ─── Config ────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:5173"; // ← backend runs on 5173

// ─── State ─────────────────────────────────────────────────────────────────
let currentSource = "page"; // "page" | "selection"
let currentAudio = null;
let chatHistory = [];

// ─── DOM Refs ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ─── Init ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  checkBackendStatus();
  setupTabs();
  setupSourceButtons();
  setupSummarize();
  setupRead();
  setupTutor();
  await loadSelectionPreview();
});

// ─── Backend Health Check ───────────────────────────────────────────────────
async function checkBackendStatus() {
  const dot = $("statusDot");
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) { dot.classList.add("online"); dot.title = "Backend online"; }
    else throw new Error();
  } catch {
    dot.classList.add("offline"); dot.title = "Backend offline";
  }
}

// ─── Tabs ───────────────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => {
        c.classList.remove("active"); c.classList.add("hidden");
      });
      tab.classList.add("active");
      const content = $(`tab-${tab.dataset.tab}`);
      content.classList.remove("hidden"); content.classList.add("active");
    });
  });
}

// ─── Source Selection ───────────────────────────────────────────────────────
function setupSourceButtons() {
  $("srcPage").addEventListener("click", () => {
    currentSource = "page";
    $("srcPage").classList.add("active");
    $("srcSelection").classList.remove("active");
    $("selectionPreview").classList.add("hidden");
  });
  $("srcSelection").addEventListener("click", async () => {
    currentSource = "selection";
    $("srcSelection").classList.add("active");
    $("srcPage").classList.remove("active");
    await loadSelectionPreview();
    $("selectionPreview").classList.remove("hidden");
  });
}

async function loadSelectionPreview() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection()?.toString()?.trim() || ""
  });
  const selected = results?.[0]?.result || "";
  if (selected) {
    $("previewText").textContent = selected.slice(0, 300) + (selected.length > 300 ? "..." : "");
  } else {
    $("previewText").textContent = "No text selected. Highlight text on the page first.";
  }
}

// ─── Get Page / Selection Text ──────────────────────────────────────────────
async function getSourceText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (currentSource === "selection") {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString()?.trim() || ""
    });
    return results?.[0]?.result || "";
  } else {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Get readable text — strips nav/footer/script noise
        const clone = document.body.cloneNode(true);
        ["script","style","nav","footer","header","aside"].forEach(tag => {
          clone.querySelectorAll(tag).forEach(el => el.remove());
        });
        return clone.innerText?.replace(/\s+/g, " ").trim().slice(0, 6000) || "";
      }
    });
    return results?.[0]?.result || "";
  }
}

// ─── Summarize ──────────────────────────────────────────────────────────────
function setupSummarize() {
  $("btnSummarize").addEventListener("click", async () => {
    hide("summaryResult"); hide("errorSummarize");
    show("loadingSummarize");

    try {
      const text = await getSourceText();
      if (!text) throw new Error("No text found. Try selecting text or switching to a content page.");

      const res = await fetch(`${API_BASE}/api/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, maxTakeaways: 3 })
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.message || "Summarization failed");

      renderSummary(data.data.takeaways, data.data.tokensUsed);
    } catch (err) {
      showError("errorSummarize", err.message);
    } finally {
      hide("loadingSummarize");
    }
  });

  $("copySummary").addEventListener("click", () => {
    const text = Array.from(document.querySelectorAll(".takeaway-text"))
      .map((el, i) => `${i + 1}. ${el.textContent}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      $("copySummary").style.color = "var(--accent)";
      setTimeout(() => $("copySummary").style.color = "", 1500);
    });
  });
}

function renderSummary(takeaways, tokens) {
  const list = $("takeawaysList");
  list.innerHTML = "";
  takeaways.forEach((t, i) => {
    const item = document.createElement("div");
    item.className = "takeaway-item";
    item.style.animationDelay = `${i * 80}ms`;
    item.innerHTML = `
      <div class="takeaway-num">${i + 1}</div>
      <p class="takeaway-text">${t}</p>
    `;
    list.appendChild(item);
  });
  $("tokenBadge").textContent = `~${tokens} tokens used`;
  show("summaryResult");
}

// ─── Read (TTS) ─────────────────────────────────────────────────────────────
function setupRead() {
  const speedSlider = $("speedSlider");
  speedSlider.addEventListener("input", () => {
    $("speedVal").textContent = `${speedSlider.value}x`;
  });

  $("btnReadPage").addEventListener("click", () => readText("page"));
  $("btnReadSelection").addEventListener("click", () => readText("selection"));

  $("playPauseBtn").addEventListener("click", () => {
    if (!currentAudio) return;
    if (currentAudio.paused) { currentAudio.play(); $("playPauseBtn").textContent = "⏸"; }
    else { currentAudio.pause(); $("playPauseBtn").textContent = "▶"; }
  });

  $("stopBtn").addEventListener("click", () => {
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; currentAudio = null; }
    hide("audioPlayer");
  });
}

async function readText(source) {
  const prevSource = currentSource;
  currentSource = source;
  hide("audioPlayer"); hide("errorRead");
  show("loadingRead");

  try {
    const text = await getSourceText();
    currentSource = prevSource;
    if (!text) throw new Error("No text found to read.");

    const voice = $("voiceSelect").value;
    const res = await fetch(`${API_BASE}/api/tts/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 4000), voice })
    });
    if (!res.ok) throw new Error(`TTS error: ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    currentAudio.playbackRate = parseFloat($("speedSlider").value);

    currentAudio.addEventListener("timeupdate", () => {
      const pct = (currentAudio.currentTime / currentAudio.duration) * 100;
      $("audioProgress").style.width = `${pct}%`;
    });
    currentAudio.addEventListener("ended", () => {
      $("playPauseBtn").textContent = "▶";
      $("audioProgress").style.width = "100%";
    });

    $("nowReading").textContent = text.slice(0, 120) + "...";
    $("playPauseBtn").textContent = "⏸";
    show("audioPlayer");
    currentAudio.play();
  } catch (err) {
    showError("errorRead", err.message);
  } finally {
    hide("loadingRead");
  }
}

// ─── Tutor Chat ─────────────────────────────────────────────────────────────
function setupTutor() {
  $("btnSend").addEventListener("click", sendTutorMessage);
  $("tutorInput").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTutorMessage(); }
  });
}

async function sendTutorMessage() {
  const input = $("tutorInput");
  const question = input.value.trim();
  if (!question) return;

  input.value = "";
  appendBubble("user", question);
  chatHistory.push({ role: "user", content: question });
  show("loadingTutor");
  $("btnSend").disabled = true;

  try {
    const context = await getSourceText();
    const res = await fetch(`${API_BASE}/api/tutor/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, context: context.slice(0, 3000) })
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();

    if (!data.success) throw new Error(data.message || "Tutor failed");
    const answer = data.data.answer;
    chatHistory.push({ role: "assistant", content: answer });
    appendBubble("ai", answer);
  } catch (err) {
    appendBubble("ai", `⚠️ ${err.message}`);
  } finally {
    hide("loadingTutor");
    $("btnSend").disabled = false;
    input.focus();
  }
}

function appendBubble(role, text) {
  const window_ = $("chatWindow");
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  window_.appendChild(bubble);
  window_.scrollTop = window_.scrollHeight;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const show = id => $( id)?.classList.remove("hidden");
const hide = id => $(id)?.classList.add("hidden");

function showError(id, msg) {
  const el = $(id);
  el.textContent = `⚠️ ${msg}`;
  el.classList.remove("hidden");
}
