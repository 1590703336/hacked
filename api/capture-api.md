# Capture Module API Documentation

This module handles the ingestion of files (PDFs/Images) and screen captures, converting them into base64 image strings suitable for processing by OCR/Vision models.

## 1. Upload File

Converts an uploaded PDF document or Image into an array of base64 encoded images. For PDFs, each page is converted into a separate base64 image string.

**Endpoint:** `POST /api/capture/upload`

**Content-Type:** `multipart/form-data`

**Request Body:**

| Field | Type | Description |
|---|---|---|
| `file` | File | The PDF or Image file to upload. |

**Response (Success - 200 OK):**

```json
{
  "success": true,
  "data": {
    "filename": "document.pdf",
    "mimetype": "application/pdf", // or image/png, etc.
    "size": 1048576, // file size in bytes
    "images": [
      "iVBORw0KGgoAAAANSUhEUgAA...", // base64 string for page 1/image
      "iVBORw0KGgoAAAANSUhEUgAA..."  // base64 string for page 2, etc.
    ]
  }
}
```

**Response (Error - 400 Bad Request):**

```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Unsupported file type. Please upload a PDF or an image."
}
```

---

## 2. Capture Screen

Receives a base64 encoded screen capture from the client (e.g. from a system-level shortcut) and returns it in a standardized format.

**Endpoint:** `POST /api/capture/screen`

**Content-Type:** `application/json`

**Request Body:**

```json
{
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAA..." // Base64 encoded string of the screen capture
}
```

**Response (Success - 200 OK):**

```json
{
  "success": true,
  "data": {
    "capturedAt": "2026-02-20T20:25:11.123Z", // ISO 8601 Timestamp
    "imageSize": 51200, // Processed image size in bytes
    "images": [
      "iVBORw0KGgoAAAANSUhEUgAA..." // The same base64 string returned as an array element
    ]
  }
}
```

**Response (Error - 400 Bad Request):**

```json
{
  "success": false,
  "error": "ValidationError",
  "message": "imageBase64 is required and must be a string"
}
```
