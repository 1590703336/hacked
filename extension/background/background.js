// ─── LuminaAI Background Service Worker ────────────────────────────────────
// Handles: API calls, context menus, tab coordination, message routing

const API_BASE = "http://localhost:5173"; // ← backend runs on 5173

// ─── Install & Context Menus ────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "lumina-summarize",
    title: "🧠 Summarize with LuminaAI",
    contexts: ["selection", "page"]
  });
  chrome.contextMenus.create({
    id: "lumina-read",
    title: "🔊 Read with LuminaAI",
    contexts: ["selection", "page"]
  });
  chrome.contextMenus.create({
    id: "lumina-ask",
    title: "🎙️ Ask LuminaAI Tutor",
    contexts: ["selection"]
  });
  console.log("LuminaAI extension installed.");
});

// ─── Context Menu Handler ───────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const text = info.selectionText || await getPageText(tab.id);
  if (!text) return;

  if (info.menuItemId === "lumina-summarize") {
    await summarizeAndShow(text, tab.id);
  } else if (info.menuItemId === "lumina-read") {
    await synthesizeAndPlay(text, tab.id);
  } else if (info.menuItemId === "lumina-ask") {
    // Open popup — user will type question
    chrome.action.openPopup?.();
  }
});

// ─── Message Router ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "SUMMARIZE":
          sendResponse(await callSummarize(msg.text));
          break;
        case "TTS":
          sendResponse(await callTTS(msg.text, msg.voice));
          break;
        case "TUTOR_ASK":
          sendResponse(await callTutor(msg.question, msg.context));
          break;
        case "OCR":
          sendResponse(await callOCR(msg.imageBase64));
          break;
        case "HEALTH":
          sendResponse(await checkHealth());
          break;
        default:
          sendResponse({ error: "Unknown message type" });
      }
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true; // keep message channel open
});

// ─── API Helpers ────────────────────────────────────────────────────────────
async function callSummarize(text) {
  const res = await fetch(`${API_BASE}/api/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, maxTakeaways: 3 })
  });
  if (!res.ok) throw new Error(`Summarize failed: ${res.status}`);
  return await res.json();
}

async function callTTS(text, voice = "nova") {
  const res = await fetch(`${API_BASE}/api/tts/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 4000), voice })
  });
  if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
  // Return as base64 so it can be passed via message
  const blob = await res.blob();
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return { success: true, audioBase64: btoa(binary), mimeType: "audio/mpeg" };
}

async function callTutor(question, context = "") {
  const res = await fetch(`${API_BASE}/api/tutor/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, context })
  });
  if (!res.ok) throw new Error(`Tutor failed: ${res.status}`);
  return await res.json();
}

async function callOCR(imageBase64) {
  const res = await fetch(`${API_BASE}/api/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64 })
  });
  if (!res.ok) throw new Error(`OCR failed: ${res.status}`);
  return await res.json();
}

async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    return { success: res.ok, status: res.status };
  } catch {
    return { success: false, error: "Backend unreachable" };
  }
}

// ─── Orchestration Helpers ──────────────────────────────────────────────────
async function getPageText(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const clone = document.body.cloneNode(true);
      ["script", "style", "nav", "footer", "header", "aside", "noscript"]
        .forEach(tag => clone.querySelectorAll(tag).forEach(el => el.remove()));
      return clone.innerText?.replace(/\s+/g, " ").trim().slice(0, 6000) || "";
    }
  });
  return results?.[0]?.result || "";
}

async function summarizeAndShow(text, tabId) {
  try {
    const data = await callSummarize(text);
    if (data.success) {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (takeaways) => {
          // Trigger content script overlay
          window.dispatchEvent(new CustomEvent("__lumina_show_summary", { detail: { takeaways } }));
        },
        args: [data.data.takeaways]
      });
      // Also send via message to content script
      chrome.tabs.sendMessage(tabId, {
        type: "SHOW_SUMMARY",
        takeaways: data.data.takeaways,
        title: "Key Takeaways"
      });
    }
  } catch (err) {
    console.error("LuminaAI summarize error:", err);
  }
}

async function synthesizeAndPlay(text, tabId) {
  try {
    const data = await callTTS(text);
    if (data.success) {
      // Inject audio playback into page
      chrome.tabs.sendMessage(tabId, {
        type: "PLAY_AUDIO_BASE64",
        audioBase64: data.audioBase64,
        mimeType: data.mimeType
      });
    }
  } catch (err) {
    console.error("LuminaAI TTS error:", err);
  }
}
