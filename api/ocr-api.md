# OCR Module API Documentation

This module handles optical character recognition (OCR) of images and PDFs, extracting structured text, code blocks, and mathematical expressions (LaTeX) using Gemini 3 Flash.

## 1. Recognize Text

Converts a base64 encoded image or PDF document into formatted Markdown text.

**Endpoint:** `POST /api/ocr`

**Content-Type:** `application/json`

**Request Body:**

| Field | Type | Description |
|---|---|---|
| `imageBase64` | string | **Required**. Base64 encoded string of the image (JPEG, PNG, WebP, GIF) or PDF document. Data-URL prefixes (e.g., `data:image/png;base64,...`) are automatically handled and stripped. |

**Response (Success - 200 OK):**

```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "markdown": "## Title\n\n$$E = mc^2$$\n\n```python\nprint('Hello World')\n```",
    "noTextDetected": false,
    "model": "gemini-3-flash-preview",
    "mimeType": "image/jpeg",
    "latencyMs": 1840,
    "usage": {
      "promptTokens": 512,
      "completionTokens": 308,
      "totalTokens": 820
    }
  }
}
```

**Response (Success - No Text Detected - 200 OK):**

```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "markdown": "",
    "noTextDetected": true,
    "model": "gemini-3-flash-preview",
    "mimeType": "image/jpeg",
    "latencyMs": 850,
    "usage": {
      "promptTokens": 256,
      "completionTokens": 5,
      "totalTokens": 261
    }
  }
}
```

**Response (Error - 400 Bad Request):**

```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Unsupported image format. Accepted: JPEG, PNG, WebP, GIF, PDF"
}
```

**Response (Error - 502 Bad Gateway):**

Returned when the upstream AI provider is unavailable, quota is exceeded, or API keys are misconfigured.

```json
{
  "success": false,
  "error": "ProviderError",
  "message": "[gemini-3-flash-preview] quota exceeded"
}
```
