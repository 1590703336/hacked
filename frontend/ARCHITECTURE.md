# 🏗️ Frontend Architecture

## Tech Stack
| Layer | Technology |
|---|---|
| Framework | React 19 + Vite |
| Styling | Vanilla CSS (custom design system) |
| State | useState / useRef (no external store) |
| API | fetch (swap mock → real in one line) |

---

## File Structure

```
frontend/
├── index.html
├── vite.config.js
└── src/
    ├── main.jsx                        ← Vite entry point
    ├── App.jsx                         ← App shell + page router
    ├── App.css                         ← Full design system (tokens, components, pages)
    ├── index.css                       ← Global reset passthrough
    │
    ├── components/
    │   └── layout/
    │       └── Navbar.jsx              ← Top nav, font toggle, A11Y badge
    │
    ├── pages/
    │   ├── HomePage.jsx                ← Hero + drag & drop + capture cards
    │   ├── ReaderPage.jsx              ← Bionic teleprompter + TTS + summary overlay
    │   └── TutorPage.jsx               ← AI chat + voice input + context sidebar
    │
    └── services/
        ├── index.js                    ← Toggle: USE_MOCK = true/false
        ├── mock.js                     ← Hardcoded data (active now)
        └── api.js                      ← Real API calls (activate when backend ready)
```

---

## Page Breakdown

### 🏠 HomePage
- Full-screen hero with animated gradient orb + floating feature cards
- Drag & drop zone — accepts PDF / PNG / JPG
- Recent Captures grid (3 mock cards with staggered slide-in)
- Features strip scrolling row

### 📖 ReaderPage (Bionic Teleprompter)
- Split layout: content left (680px max), controls right (280px)
- Sentence-by-sentence highlight that advances with TTS playback simulation
- Speed controls: 0.5×, 0.75×, 1×, 1.25×, 1.5×, 2×
- **TL;DR Summary overlay** — slide-up modal with 3 AI takeaway cards
- Accessibility panel: High contrast / Large text / Reduce motion toggles

### 🎙️ TutorPage (AI Chat)
- Sidebar: current document context + 4 quick-question buttons
- Chat area: AI (left) + user (right) bubbles with slide-in animation
- Thinking indicator: 3-dot bounce while awaiting AI response
- Voice input button — pulses red while recording
- Sends to `tutorService.ask()` with document context attached

---

## Data Flow

```
User Action
    │
    ▼
Page Component (HomePage / ReaderPage / TutorPage)
    │
    ▼
services/index.js  ──── USE_MOCK = true ──→  services/mock.js  (hardcoded, instant)
                   ──── USE_MOCK = false ──→  services/api.js   (real HTTP to backend)
    │
    ▼
Backend (Node.js + Express @ localhost:3001)
```

---

## API Integration (Backend Contract)

All endpoints live in `services/api.js`. To go live, flip one flag:

```js
// services/index.js
const USE_MOCK = false; // ← change this when backend is ready
```

| Service | Endpoint | Method |
|---|---|---|
| OCR | `/api/ocr` | POST |
| Summarizer | `/api/summarize` | POST |
| TTS Synthesize | `/api/tts/synthesize` | POST → audio/wav |
| TTS Chunk | `/api/tts/chunk` | POST |
| Tutor Ask | `/api/tutor/ask` | POST |
| Tutor Transcribe | `/api/tutor/transcribe` | POST (FormData) |
| File Upload | `/api/capture/upload` | POST (FormData) |
| Screen Capture | `/api/capture/screen` | POST |

---

## Design System (App.css)

| Token | Value |
|---|---|
| `--bg` | `#080b0f` (darkest) |
| `--accent` | `#3ecfcf` (teal) |
| `--font-display` | Syne (Google Fonts) |
| `--font-mono` | DM Mono (Google Fonts) |
| `--radius-lg` | 20px |

**Key patterns used:**
- Glassmorphism: `backdrop-filter: blur` + semi-transparent surfaces
- Micro-animations: `slide-up`, `pulse-orb`, `float-1/2/3`, `dot-bounce`
- Accessibility: `dyslexic-mode`, `high-contrast`, `large-text`, `reduce-motion` body class toggles
