# Summarizer API

Generates up to 3 plain-English TL;DR takeaways from any text using GPT-4o.

---

## `POST /api/summarize`

### Request

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `text` | `string` | ✅ Yes | — | The text to summarize |
| `maxTakeaways` | `number` | No | `3` | Max takeaways to return (1–3) |

```json
{
  "text": "Photosynthesis is the process by which...",
  "maxTakeaways": 3
}
```

### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "takeaways": [
      "Plants convert sunlight, water, and CO2 into energy and oxygen.",
      "The process happens in chloroplasts using chlorophyll.",
      "It has two stages: light reactions and the Calvin cycle."
    ],
    "model": "gpt-4o",
    "tokensUsed": 134
  }
}
```

### Error Responses

| Status | Cause | Response |
|--------|-------|----------|
| `400` | `text` is missing or empty | `{ "success": false, "error": "text is required and must be a non-empty string" }` |
| `500` | OpenAI API failure | `{ "success": false, "error": "Internal server error" }` |

---

## Module Files

| File | Role |
|------|------|
| `summarizer.router.js` | Registers `POST /api/summarize`, applies validator middleware |
| `summarizer.validator.js` | Validates `text` is a non-empty string |
| `summarizer.controller.js` | Handles request/response, delegates to service |
| `summarizer.service.js` | Calls GPT-4o, parses + caps takeaways |

---

## Notes

- Model: **GPT-4o** at `temperature: 0.3` (low randomness for consistent outputs)
- GPT list formatting (`1.`, `-`, `•`, `–`) is stripped from all takeaways automatically
- `maxTakeaways` is enforced both in the system prompt and via `.slice()` in the parser
- Requires `OPENAI_API_KEY` in `.env`
