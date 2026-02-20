// ─── REAL API SERVICE LAYER ────────────────────────────────────────────────
// These match the exact API contract defined in TEAM_PLAN.md
// Activated when USE_MOCK = false in services/index.js

const BASE_URL = "http://localhost:3001/api";

async function post(endpoint, body) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function postForm(endpoint, formData) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── OCR ──────────────────────────────────────────────────────────────────
// POST /api/ocr
// Body: { imageBase64: string }
// Response: { success: true, data: { markdown: string, noTextDetected: boolean, model: string } }
export const ocr = {
  process: async (imageBase64) => {
    return post("/ocr", { imageBase64 });
  },
};

// ─── SUMMARIZER ───────────────────────────────────────────────────────────
// POST /api/summarize
// Body: { text: string, maxTakeaways?: number }
// Response: { success: true, data: { takeaways: string[], tokensUsed: number } }
export const summarizer = {
  summarize: async (text, maxTakeaways = 3) => {
    return post("/summarize", { text, maxTakeaways });
  },
};

// ─── TTS ──────────────────────────────────────────────────────────────────
// POST /api/tts/synthesize → returns audio/mpeg binary
// POST /api/tts/chunk      → { success: true, data: { chunks: string[] } }
export const tts = {
  synthesize: async (text, voice = "nova") => {
    const res = await fetch(`${BASE_URL}/tts/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) throw new Error(`TTS error: ${res.status}`);
    const blob = await res.blob();
    const audioUrl = URL.createObjectURL(blob);
    return { success: true, data: { audioUrl } };
  },
  chunk: async (markdown) => {
    return post("/tts/chunk", { markdown });
  },
};

// ─── TUTOR ────────────────────────────────────────────────────────────────
// POST /api/tutor/ask
// Body: { question: string, context?: string }
// Response: { success: true, data: { question, answer, tokensUsed } }
//
// POST /api/tutor/transcribe
// Body: FormData with audio file
// Response: { success: true, data: { text: string } }
export const tutor = {
  ask: async (question, context = "") => {
    return post("/tutor/ask", { question, context });
  },
  transcribe: async (audioBlob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    return postForm("/tutor/transcribe", formData);
  },
};

// ─── CAPTURE ──────────────────────────────────────────────────────────────
// POST /api/capture/upload
// Body: FormData with file
// Response: { success: true, data: { filename, mimetype, size, text } }
//
// POST /api/capture/screen
// Body: { imageBase64: string }
// Response: { success: true, data: { capturedAt, imageSize } }
export const capture = {
  upload: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return postForm("/capture/upload", formData);
  },
  screen: async (imageBase64) => {
    return post("/capture/screen", { imageBase64 });
  },
};
