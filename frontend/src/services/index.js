// ─── SERVICE TOGGLE ────────────────────────────────────────────────────────
// Set USE_MOCK = false when backend is ready

import * as mockServices from "./mock.js";
// import * as apiServices from "./api.js"; // uncomment when backend ready

const USE_MOCK = true;

const services = USE_MOCK ? mockServices : mockServices; // swap right side to apiServices when ready

export const ocrService        = services.ocr;
export const summarizerService = services.summarizer;
export const ttsService        = services.tts;
export const tutorService      = services.tutor;
export const captureService    = services.capture;
export { MOCK_CAPTURES, MOCK_CHUNKS, MOCK_CONTENT, MOCK_CHAT_HISTORY } from "./mock.js";
