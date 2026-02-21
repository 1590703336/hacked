# TTS Module API Documentation

This module handles Text-To-Speech (TTS) capabilities, including semantic chunking of Markdown (handling LaTeX) and local Kokoro 82M audio synthesis. It supports configurable voices/speeds and offers both standard REST endpoints and Server-Sent Events (SSE) for real-time streaming.

## 1. Chunk Markdown

Converts raw Markdown (with LaTeX formulas) into an array of speakable natural language chunks.

**Endpoint:** `POST /api/tts/chunk`

**Content-Type:** `application/json`

**Request Body:**

| Field | Type | Description |
|---|---|---|
| `markdown` | string | **Required**. The Markdown text to be chunked. |

**Response (Success - 200 OK):**

```json
{
  "success": true,
  "data": {
    "chunks": [
      "The derivative partial f with respect to x",
      "represents the rate of change."
    ],
    "chunkCount": 2
  }
}
```

---

## 2. Synthesize Text

Converts a single string of plain text into a WAV audio buffer.

**Endpoint:** `POST /api/tts/synthesize`

**Content-Type:** `application/json`

**Request Body:**

| Field | Type | Description |
|---|---|---|
| `text` | string | **Required**. The text to synthesize. |
| `voice` | string | Optional. Voice ID. Supports Kokoro voices (e.g. `af_nova`) and legacy aliases (`nova`, `alloy`, etc.). Defaults to config. |
| `speed` | number | Optional. Playback speed between `0.5` and `2.0`. Defaults to `1.0`. |
| `model` | string | Optional. Model ID. Defaults to `onnx-community/Kokoro-82M-v1.0-ONNX`. |

**Response (Success - 200 OK):**
Returns raw binary audio data with `Content-Type: audio/wav`.

---

## 3. Pipeline (Markdown to Audio)

A convenience full-pipeline endpoint that accepts Markdown, automatically chunks it internally, synthesizes each chunk (in parallel), and returns a single combined WAV buffer for the entire text.

**Endpoint:** `POST /api/tts/pipeline`

**Content-Type:** `application/json`

**Request Body:**

| Field | Type | Description |
|---|---|---|
| `markdown` | string | **Required**. The Markdown text to synthesize. |
| `voice` | string | Optional. The voice model. |
| `speed` | number | Optional. Playback speed (0.5 - 2.0). |
| `model` | string | Optional. TTS model ID (default Kokoro 82M). |

**Response (Success - 200 OK):**
Returns raw binary audio data with `Content-Type: audio/wav` representing the concatenated audio of all chunks.

---

## 4. Stream Chunks (Server-Sent Events)

Streams the synthesized audio chunk-by-chunk using Server-Sent Events (SSE). This is ideal for real-time playback where the client can start playing the first chunk while subsequent chunks are still being generated.

**Endpoint:** `GET /api/tts/stream`

**Query Parameters:**
Because SSE uses `GET` requests, parameters are passed in the query string.

| Parameter | Type | Description |
|---|---|---|
| `markdown` | string | **Required**. The Markdown text to stream. |
| `voice` | string | Optional. The voice model. |
| `speed` | number | Optional. Playback speed. |
| `model` | string | Optional. TTS model ID. |

**Response (Server-Sent Events):**
The server will stream events. The `data` property of each event will be a JSON string.

*   **Event 1: Metadata**
    Sent immediately after semantic chunking is complete.
    ```json
    { "type": "metadata", "chunkCount": 2, "mimeType": "audio/wav" }
    ```

*   **Events 2...N: Audio Chunks**
    Sent in reading order as each audio chunk is synthesized (backend runs chunk generation concurrently, then streams in-order).
    ```json
    {
      "type": "audio",
      "chunkIndex": 0,
      "audioBase64": "UklGRiQAAABXQVZFZm10IBAAAAAB...",
      "text": "The derivative...",
      "mimeType": "audio/wav"
    }
    ```

*   **Event N+1: Done**
    Sent when all chunks have been streamed successfully.
    ```json
    { "type": "done" }
    ```

*   **Error Event:**
    Sent if a specific chunk fails to synthesize (does not terminate the stream, subsequent chunks will still be attempted).
    ```json
    { "type": "error", "message": "Failed to synthesize chunk", "chunkIndex": 1 }
    ```
