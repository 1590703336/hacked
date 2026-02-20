const config = require('../../config');
const { ValidationError } = require('../../shared/errors');

// MIME type magic-byte prefixes (first ~12 Base64 chars map to first 9 raw bytes)
const MIME_MAGIC = [
    { prefix: '/9j/', mime: 'image/jpeg' },
    { prefix: 'iVBORw0KGgo', mime: 'image/png' },
    { prefix: 'UklGR', mime: 'image/webp' },
    { prefix: 'R0lGODdh', mime: 'image/gif' }, // GIF87a
    { prefix: 'R0lGODlh', mime: 'image/gif' }, // GIF89a
];

// Unsupported formats — give a helpful message so the user knows what to do
const BLOCKED_MAGIC = [
    { prefix: 'SUkqAA', label: 'TIFF' },
    { prefix: 'TU0AKg', label: 'TIFF' },
    { prefix: 'JVBER', label: 'PDF' },
];

/**
 * Detect MIME type from the very start of a Base64 string.
 * Decodes only the first 9 bytes — enough for any magic-byte check.
 * Returns the MIME string or null if unrecognised.
 */
function detectMime(base64) {
    // Check blocked types first — surface a specific error message
    for (const { prefix, label } of BLOCKED_MAGIC) {
        if (base64.startsWith(prefix)) {
            return { mime: null, blocked: label };
        }
    }
    for (const { prefix, mime } of MIME_MAGIC) {
        if (base64.startsWith(prefix)) {
            return { mime, blocked: null };
        }
    }
    return { mime: null, blocked: null };
}

/**
 * Normalise a Base64 string:
 *  1. Strip data-URL prefix  (data:image/png;base64,...)
 *  2. Strip all whitespace/newlines  (btoa() chunks every 76 chars)
 *  3. Convert URL-safe chars  (- → +,  _ → /)
 *  4. Re-pad to a multiple of 4
 */
function normaliseBase64(raw) {
    let b64 = raw.trim();

    // Strip data-URL prefix
    const dataUrlIdx = b64.indexOf(';base64,');
    if (dataUrlIdx !== -1) {
        b64 = b64.slice(dataUrlIdx + 8); // everything after the comma
    }

    // Strip all whitespace
    b64 = b64.replace(/\s/g, '');

    // URL-safe → standard
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');

    // Re-pad
    const pad = b64.length % 4;
    if (pad === 2) b64 += '==';
    else if (pad === 3) b64 += '=';

    return b64;
}

function validateOcrRequest(req, _res, next) {
    const raw = req.body?.imageBase64;

    // 1. Presence + type
    if (!raw || typeof raw !== 'string') {
        return next(new ValidationError('imageBase64 is required and must be a string'));
    }

    // 2-4. Normalise (strip prefix, whitespace, URL-safe, re-pad)
    const b64 = normaliseBase64(raw);

    // 5. Empty after normalising
    if (!b64) {
        return next(new ValidationError('imageBase64 is required and must be a string'));
    }

    // 6. Valid Base64 characters only
    if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) {
        return next(new ValidationError('imageBase64 contains invalid characters'));
    }

    // 7. Size check — approximate decoded byte count
    const approxBytes = Math.ceil(b64.length * 0.75);
    if (approxBytes > config.ocr.maxImageBytes) {
        const limitMb = Math.round(config.ocr.maxImageBytes / (1024 * 1024));
        return next(new ValidationError(`Image exceeds ${limitMb} MB limit`));
    }

    // 8. MIME magic-byte detection
    const { mime, blocked } = detectMime(b64);

    if (blocked === 'PDF') {
        return next(new ValidationError(
            'PDF files are not supported here. Use POST /api/capture/upload instead.'
        ));
    }
    if (!mime) {
        return next(new ValidationError(
            'Unsupported image format. Accepted: JPEG, PNG, WebP, GIF'
        ));
    }

    // 9. Attach cleaned values — service uses these directly
    req.body.imageBase64 = b64;
    req.body.mimeType = mime;

    // provider field is intentionally ignored — model selection is server-side only
    next();
}

module.exports = { validateOcrRequest };
