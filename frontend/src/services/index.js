// ─── SERVICE TOGGLE ────────────────────────────────────────────────────────
// Change VITE_USE_MOCK in the .env file to switch between mock and real API
// VITE_USE_MOCK=true  → uses hardcoded mock data (no backend needed)
// VITE_USE_MOCK=false → uses real backend at localhost:3001

import * as mockServices from "./mock.js";
import * as apiServices from "./api.js";

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

const services = USE_MOCK ? mockServices : apiServices;

export const ocrService        = services.ocr;
export const summarizerService = services.summarizer;
export const ttsService        = services.tts;
export const tutorService      = services.tutor;
export const captureService    = services.capture;
export { MOCK_CAPTURES, MOCK_CHUNKS, MOCK_CONTENT, MOCK_CHAT_HISTORY } from "./mock.js";
