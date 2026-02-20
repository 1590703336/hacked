// ─── SERVICE TOGGLE ────────────────────────────────────────────────────────
// Set USE_MOCK = false when backend is ready

import * as mockServices from "./mock.js";
import * as apiServices from "./api.js";

const USE_MOCK = false;

const services = USE_MOCK ? mockServices : apiServices;

export const ocrService = services.ocr;
export const summarizerService = services.summarizer;
export const ttsService = services.tts;
export const tutorService = services.tutor;
export const captureService = services.capture;
export { MOCK_CAPTURES, MOCK_CHUNKS, MOCK_CONTENT, MOCK_CHAT_HISTORY } from "./mock.js";
