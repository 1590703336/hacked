# 🚀 Project MVP: AI-Driven Digital Accessibility Learning Assistant

*"A frictionless, context-aware AI tutor designed for cognitive accessibility."*

## 🌟 Core Vision
Designed specifically for students facing cognitive overload, dyslexia, ADHD, or non-native language challenges. By deeply integrating a minimalist, cross-platform desktop architecture (Rust/Tauri + React) with OpenAI, it provides "one-click" simplification of complex academic content and an accessible, synchronized audio-visual experience.

## 🛠 The 5 Key Features

### 1. ⚡ Omni-Input & Global Capture
*   **Design Philosophy:** Learning shouldn't be confined to a specific browser or app. The input process must be completely "frictionless."
*   **Functionality:**
    *   **Drag & Drop Parsing:** Supports dragging PDFs or images directly into the main interface for paginated rendering and area selection.
    *   **Global Screen Capture (System-level Shortcut):** Whether the user is reading slides, watching a video, or writing code, pressing a preset shortcut (e.g., `Ctrl+Shift+A`) allows them to instantly select complex text, formulas, or code on the screen and send it directly to the AI brain.

### 2. 🧠 Shortcut A: The "TL;DR" Summarizer
*   **Design Philosophy:** Alleviates "cognitive overload" and the intimidation caused by lengthy academic papers or complex proofs.
*   **Functionality:**
    *   After selecting the content and pressing the shortcut, the system calls the Vision API to rapidly extract the core logic.
    *   Forces the AI to output a maximum of 3 key takeaways using strictly "Plain English."
*   **UI/UX:** Pops up as a minimalist Tauri overlay on the side of the screen, helping the user decide within 5 seconds if they need to read further.

### 3. 📖 Shortcut B: Smart OCR, Chunking & TTS
*   **Design Philosophy:** Traditional screen readers fail to properly handle math formulas, logical symbols, or nested code blocks.
*   **Functionality:**
    *   **Precise OCR & Reconstruction:** Once captured, the backend accurately converts the image into structured Markdown. When encountering calculus concepts like partial derivatives $\frac{\partial f}{\partial x}$ or discrete math predicate logic like $\forall x (P(x) \rightarrow Q(x))$, it converts them into standard LaTeX format.
    *   **Semantic Chunking:** The system doesn't just rigidly read symbols. Through preprocessing, it translates formulas into "natural language pronunciation," slices them by semantic chunks, and streams them to a high-quality TTS engine for a natural listening experience.

### 4. 👁️ Immersive Bionic Teleprompter
*   **Design Philosophy:** Audio or text alone isn't enough for specific learning needs; synchronized audio-visual input is the gold standard for accessible reading.
*   **Functionality:**
    *   When TTS starts playing, a high-contrast reader interface appears in the center of the screen.
    *   Supports a one-click toggle to OpenDyslexic (a font specifically designed for dyslexia).
    *   **Dynamic Highlighting:** As the audio progresses, the currently spoken sentence is automatically highlighted while non-focused areas are dimmed, guiding visual attention.

### 5. 🎙️ Voice-Interruptible AI Tutor
*   **Design Philosophy:** Learning is a dynamic process of resolving doubts. When encountering confusing jargon, users shouldn't have to look up a cold Wikipedia definition.
*   **Functionality:**
    *   **One-Click Interruption:** During the TTS reading, if the user encounters a hard-to-understand term (like ANOVA) or a complex pointer code snippet, they can press an "interaction key" to pause the reading.
    *   **Voice Q&A (STT):** The user speaks their question directly into the microphone via the Whisper API. (e.g., *"I don't understand what 'p-value' means in this ANOVA explanation."*)
    *   **Concrete Explanations (TTS Reply):** The AI uses the current context to generate a relatable, real-world analogy and speaks it back. (e.g., *"Imagine you want to know if apples from three different farms have different sweetness levels because of the soil, or if it's just random variation among individual apples..."*)
    *   **Seamless Resume:** Once the question is answered, the system automatically resumes reading the original text from where it was paused.

## 💻 Tech Stack

| Layer | Technology |
|---|---|
| **Desktop Shell** | Electron |
| **Backend** | Node.js + Express |
| **Frontend** | React + Vite |
| **Styling** | TailwindCSS v4 |
| **OCR / Vision** | OpenRouter `google/gemini-3-flash-preview` / OpenAI GPT-4o |
| **TTS** | Local `kokoro-js` (Kokoro 82M) |
| **STT** | OpenAI Whisper API |
| **Build / Package** | electron-builder |

### Project Structure
```
hacked/
├── backend/        # Node.js + Express API server (modular)
├── frontend/       # React + Vite + TailwindCSS
└── electron/       # Electron main process shell
```
