# Speech Announcements Inventory

This file lists all `speakFeedback(...)` announcements in the frontend and their trigger conditions.

## Global behavior

- `speakFeedback` implementation location: `frontend/src/App.jsx:77`
- Behavior: each new call executes `window.speechSynthesis.cancel()` before speaking, so a new announcement can interrupt the current one.

## Announcements and triggers

| Message text (exact) | Trigger condition | Entry point | Code location |
|---|---|---|---|
| `Recording started. Please speak your question.` | `startRecordingQuestion({ announce: true })` is called, and recording is not already active/transcribing/thinking | `Ctrl+R` start branch | `frontend/src/App.jsx:698`, `frontend/src/App.jsx:1059` |
| `Screenshot captured. Uploading and processing now.` | Electron IPC event `screen-captured` is received | Electron IPC handler | `frontend/src/App.jsx:799` |
| `Screenshot shortcut detected. Capturing screen.` | Electron IPC event `shortcut-capture` is received | Electron IPC handler | `frontend/src/App.jsx:803` |
| `File uploaded. Processing started.` | `handleUpload()` begins with a valid `file` | Auto-upload pipeline | `frontend/src/App.jsx:881` |
| `OCR processing finished. Document is ready.` | OCR workers complete successfully and combined OCR text is set | `handleUpload()` success path | `frontend/src/App.jsx:955` |
| `Summary processing started.` | `handleSummarize()` starts and `resultText` exists | Summary flow | `frontend/src/App.jsx:970` |
| `Summary processing finished.` | Summary request succeeds and `summaryText` is set | Summary success path | `frontend/src/App.jsx:988` |
| `Reading resumed` | `Ctrl+K/Cmd+K` pressed while reading OCR target and currently paused | Hotkey | `frontend/src/App.jsx:1021` |
| `Reading paused` | `Ctrl+K/Cmd+K` pressed while reading OCR target and currently not paused | Hotkey | `frontend/src/App.jsx:1025` |
| `OCR chunk processing started. Generating read aloud audio.` | `Ctrl+K/Cmd+K` pressed and OCR text exists, and current OCR reading is not in the pause/resume branch | Hotkey | `frontend/src/App.jsx:1028` |
| `No document is currently available to read.` | `Ctrl+K/Cmd+K` pressed and OCR text does not exist | Hotkey | `frontend/src/App.jsx:1031` |
| `Reading resumed` | `Ctrl+L/Cmd+L` pressed while reading summary target and currently paused | Hotkey | `frontend/src/App.jsx:1039` |
| `Reading paused` | `Ctrl+L/Cmd+L` pressed while reading summary target and currently not paused | Hotkey | `frontend/src/App.jsx:1043` |
| `Summary chunk processing started. Generating read aloud audio.` | `Ctrl+L/Cmd+L` pressed and summary exists, and current summary reading is not in the pause/resume branch | Hotkey | `frontend/src/App.jsx:1046` |
| `No summary has been generated yet.` | `Ctrl+L/Cmd+L` pressed and summary does not exist | Hotkey | `frontend/src/App.jsx:1049` |
| `Recording stopped. Processing.` | `Ctrl+R/Cmd+R` pressed while currently recording | Hotkey | `frontend/src/App.jsx:1057` |
| `Upload file dialog opened` | `Ctrl+U/Cmd+U` pressed and file input ref exists | Hotkey | `frontend/src/App.jsx:1067` |
| `Screenshot shortcut triggered. Preparing capture.` | `Ctrl+Shift+A/Cmd+Shift+A` pressed and `window.electronAPI.requestCapture` exists | Hotkey | `frontend/src/App.jsx:1074` |
| `Screenshot capture shortcut is available in the desktop app.` | `Ctrl+Shift+A/Cmd+Shift+A` pressed but `window.electronAPI.requestCapture` is not available | Hotkey | `frontend/src/App.jsx:1078` |
| `Already summarizing.` | `Ctrl+S/Cmd+S` pressed while summary request is already running | Hotkey | `frontend/src/App.jsx:1086` |
| `No document to summarize.` | `Ctrl+S/Cmd+S` pressed with no OCR text available | Hotkey | `frontend/src/App.jsx:1088` |
| `Shortcuts: Control K to read or pause document. Control L to read or pause summary. Control R to record a question. Control Shift A to capture a screenshot and run OCR. Control U to upload a file. Control S to summarize.` | `Ctrl+H/Cmd+H` pressed (also pauses reading first if currently reading and not paused) | Hotkey | `frontend/src/App.jsx:1113` |
| `Document processed. Control S to summarize. Control K to read document aloud. Control R to ask a question. Control Shift A to capture another screenshot.` | `resultText` becomes truthy while `summaryText` is falsy | `useEffect` announcement | `frontend/src/App.jsx:1122` |
| `Summary generated. Control L to read summary aloud.` | `summaryText` becomes truthy | `useEffect` announcement | `frontend/src/App.jsx:1128` |
| `Application loaded. Shortcuts: Control U to upload a file. Control Shift A to capture screenshot and run OCR. Control R to record a question. Control H to repeat instructions anytime.` | First user interaction on welcome overlay when `hasInteracted` is false | `handleInitialInteraction()` | `frontend/src/App.jsx:1135` |

