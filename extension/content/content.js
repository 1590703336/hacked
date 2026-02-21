// ─── LuminaAI Content Script ────────────────────────────────────────────────
// Injected into every page. Handles:
//   • Text extraction
//   • Selection highlighting
//   • Overlay panel for results
//   • Listening for messages from background/popup

(function () {
  if (window.__luminaInjected) return;
  window.__luminaInjected = true;

  // ── State ──────────────────────────────────────────────────────────────────
  let overlayEl = null;
  let highlightedEls = [];

  // ── Message Listener ───────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.type) {
      case "GET_PAGE_TEXT":
        sendResponse({ text: extractPageText() });
        break;
      case "GET_SELECTION":
        sendResponse({ text: window.getSelection()?.toString()?.trim() || "" });
        break;
      case "SHOW_SUMMARY":
        showOverlay(msg.takeaways, msg.title || "Key Takeaways");
        sendResponse({ ok: true });
        break;
      case "HIGHLIGHT_SENTENCE":
        highlightSentence(msg.sentence);
        sendResponse({ ok: true });
        break;
      case "CLEAR_HIGHLIGHTS":
        clearHighlights();
        sendResponse({ ok: true });
        break;
      case "CLOSE_OVERLAY":
        closeOverlay();
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ error: "Unknown message type" });
    }
    return true; // keep channel open for async
  });

  // ── Text Extraction ────────────────────────────────────────────────────────
  function extractPageText() {
    const clone = document.body.cloneNode(true);
    // Remove noise elements
    ["script", "style", "nav", "footer", "header", "aside",
     "noscript", "svg", "img", "button", "input", "select"]
      .forEach(tag => clone.querySelectorAll(tag).forEach(el => el.remove()));

    // Prefer article/main content if available
    const main = clone.querySelector("article, main, [role='main'], .content, #content, .post");
    const source = main || clone;
    return source.innerText?.replace(/\s+/g, " ").trim().slice(0, 8000) || "";
  }

  // ── Sentence Highlighting ──────────────────────────────────────────────────
  function highlightSentence(sentence) {
    clearHighlights();
    if (!sentence) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: node => {
        const parent = node.parentElement;
        if (!parent || ["SCRIPT","STYLE","NOSCRIPT"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const snippet = sentence.slice(0, 60).toLowerCase();
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.toLowerCase().includes(snippet)) {
        const span = document.createElement("mark");
        span.style.cssText = `
          background: rgba(62,207,207,0.25) !important;
          color: inherit !important;
          border-radius: 3px !important;
          padding: 0 2px !important;
          outline: 2px solid rgba(62,207,207,0.5) !important;
          transition: all 0.3s !important;
        `;
        const range = document.createRange();
        range.selectNode(node);
        range.surroundContents(span);
        highlightedEls.push(span);
        span.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
  }

  function clearHighlights() {
    highlightedEls.forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
    });
    highlightedEls = [];
  }

  // ── Overlay Panel ──────────────────────────────────────────────────────────
  function showOverlay(takeaways, title) {
    closeOverlay();

    const overlay = document.createElement("div");
    overlay.id = "__lumina-overlay";
    overlay.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      width: 340px !important;
      max-height: 80vh !important;
      background: #0d1117 !important;
      border: 1px solid #263545 !important;
      border-radius: 16px !important;
      padding: 20px !important;
      z-index: 2147483647 !important;
      font-family: 'Syne', system-ui, sans-serif !important;
      color: #e8f0f8 !important;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(62,207,207,0.1) !important;
      overflow-y: auto !important;
      animation: lumina-slide-in 0.3s ease !important;
    `;

    // Inject keyframes if not already there
    if (!document.getElementById("__lumina-styles")) {
      const style = document.createElement("style");
      style.id = "__lumina-styles";
      style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&display=swap');
        @keyframes lumina-slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: none; }
        }
      `;
      document.head.appendChild(style);
    }

    const colors = ["#3ecfcf", "#3e9fff", "#ff7c3e"];
    const takeawayHTML = Array.isArray(takeaways)
      ? takeaways.map((t, i) => `
          <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;animation:lumina-slide-in ${0.2 + i * 0.1}s ease both;">
            <div style="width:22px;height:22px;border-radius:6px;background:${colors[i]}22;color:${colors[i]};display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0;">${i + 1}</div>
            <p style="font-size:0.83rem;line-height:1.55;color:#8fa4bc;margin:0;">${t}</p>
          </div>
        `).join("")
      : `<p style="color:#8fa4bc;font-size:0.83rem;">${takeaways}</p>`;

    overlay.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:8px;height:8px;border-radius:50%;background:#3ecfcf;box-shadow:0 0 6px #3ecfcf;"></div>
          <span style="font-size:0.78rem;font-weight:700;letter-spacing:0.06em;color:#3ecfcf;text-transform:uppercase;">LuminaAI · ${title}</span>
        </div>
        <button id="__lumina-close" style="width:26px;height:26px;border-radius:7px;background:#161d27;border:1px solid #1f2d3d;color:#8fa4bc;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.9rem;line-height:1;">✕</button>
      </div>
      <div>${takeawayHTML}</div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid #1f2d3d;display:flex;justify-content:flex-end;">
        <span style="font-size:0.68rem;color:#4a6070;font-family:monospace;">Powered by LuminaAI</span>
      </div>
    `;

    document.body.appendChild(overlay);
    overlayEl = overlay;

    overlay.querySelector("#__lumina-close").addEventListener("click", closeOverlay);

    // Click outside to close
    setTimeout(() => {
      document.addEventListener("click", outsideClickHandler);
    }, 100);
  }

  function outsideClickHandler(e) {
    if (overlayEl && !overlayEl.contains(e.target)) {
      closeOverlay();
      document.removeEventListener("click", outsideClickHandler);
    }
  }

  function closeOverlay() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
    document.removeEventListener("click", outsideClickHandler);
  }

})();
