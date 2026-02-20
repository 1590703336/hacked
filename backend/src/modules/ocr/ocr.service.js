const OpenAI = require('openai');
const config = require('../../config');
const { ProviderError } = require('../../shared/errors');
const pdf2img = require('pdf-img-convert');

const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.openRouterApiKey,
});

// ---------------------------------------------------------------------------
// System prompt — both models share the same instruction for consistency
// ---------------------------------------------------------------------------
const OCR_PROMPT = `You are an expert OCR assistant. Extract ALL text visible in this image with maximum fidelity.
Rules:
1. Maintain the reading order (top-to-bottom, left-to-right).
2. Convert ALL mathematical expressions to LaTeX: inline with $...$, block with $$...$$.
3. Wrap code blocks in fenced Markdown with the detected language tag.
4. Preserve all headings (#, ##, ###), bullet lists, numbered lists, and tables as Markdown.
5. For graphs or charts, provide a brief description of their contents and any data trends shown.
6. Do NOT add commentary, summaries, or personal interpretations — extracted content only.
7. If the image contains no readable text, respond with exactly: [NO_TEXT_DETECTED]`;

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

// HTTP status codes and Node error codes that are safe to retry
const RETRYABLE_STATUS = new Set([429, 503]);
const RETRYABLE_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']);

/**
 * Calls fn() up to retryMaxAttempts times with exponential backoff.
 * Only retries on transient errors; propagates permanent errors immediately.
 */
async function retryWithBackoff(fn) {
    const { retryMaxAttempts, retryBaseDelayMs, retryMaxDelayMs } = config.ocr;

    for (let attempt = 1; attempt <= retryMaxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const status = err.status ?? err.httpErrorCode?.status ?? err.response?.status;
            const isRetryable = RETRYABLE_STATUS.has(status) || RETRYABLE_CODES.has(err.code);
            const isLastAttempt = attempt === retryMaxAttempts;

            if (!isRetryable || isLastAttempt) throw err;

            const delay = Math.min(retryBaseDelayMs * 2 ** (attempt - 1), retryMaxDelayMs);
            console.warn(`[OCR] Gemini attempt ${attempt} failed (status: ${status}), retrying in ${delay}ms…`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

// ---------------------------------------------------------------------------
// Response sanitiser
// ---------------------------------------------------------------------------

/**
 * Strip outer triple-backtick fence if the model wraps the entire response in one.
 * e.g.  ```markdown\n...\n```  →  ...
 */
function sanitiseResponse(raw) {
    const fenceMatch = raw.match(/^```[a-z]*\n([\s\S]*)\n```$/);
    if (fenceMatch) return fenceMatch[1].trim();
    return raw.trim();
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Recognise text in an image using Gemini 3 Flash.
 *
 * @param {string} imageBase64 - Cleaned Base64-encoded image (no data-URL prefix)
 * @param {string} mimeType    - Detected MIME type (e.g. 'image/png')
 * @returns {object}           - { markdown, noTextDetected, model, mimeType, latencyMs, usage }
 */
async function recognize(imageBase64, mimeType) {
    // Fail fast if API key is missing
    if (!config.openRouterApiKey) {
        throw new ProviderError(config.ocr.model, 'OPENROUTER_API_KEY is not configured');
    }

    let finalBase64 = imageBase64;
    let finalMime = mimeType;

    // Handle PDF conversion
    if (mimeType === 'application/pdf') {
        try {
            const pdfBuffer = Buffer.from(imageBase64, 'base64');
            // convert strictly the first page to base64
            const pdfPages = await pdf2img.convert(pdfBuffer, { page_numbers: [1], base64: true });

            if (!pdfPages || pdfPages.length === 0) {
                throw new Error('No pages extracted');
            }

            finalBase64 = pdfPages[0];
            finalMime = 'image/png'; // pdf-img-convert outputs PNG

            // Clean up base64 if it has a data URL prefix
            if (typeof finalBase64 === 'string' && finalBase64.includes(';base64,')) {
                finalBase64 = finalBase64.split(';base64,')[1];
            } else if (finalBase64 instanceof Uint8Array || finalBase64 instanceof Buffer) {
                // In case base64: true is ignored
                finalBase64 = Buffer.from(finalBase64).toString('base64');
            }
        } catch (err) {
            throw new ProviderError(config.ocr.model, `PDF conversion failed: ${err.message}`, err);
        }
    }

    const start = Date.now();
    let result;

    try {
        result = await retryWithBackoff(() =>
            openrouter.chat.completions.create({
                model: config.ocr.model,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: OCR_PROMPT },
                            {
                                type: 'image_url',
                                image_url: { url: `data:${finalMime};base64,${finalBase64}` },
                            },
                        ],
                    },
                ],
                max_tokens: config.ocr.maxOutputTokens,
            })
        );
    } catch (err) {
        throw new ProviderError(config.ocr.model, err.message, err);
    }

    const latencyMs = Date.now() - start;

    const raw = result.choices[0]?.message?.content?.trim() ?? '';
    const noTextDetected = !raw || raw === '[NO_TEXT_DETECTED]';
    const markdown = noTextDetected ? '' : sanitiseResponse(raw);

    const meta = result.response?.usageMetadata ?? {};

    return {
        markdown,
        noTextDetected,
        model: config.ocr.model,
        mimeType,
        latencyMs,
        usage: {
            promptTokens: result.usage?.prompt_tokens ?? 0,
            completionTokens: result.usage?.completion_tokens ?? 0,
            totalTokens: result.usage?.total_tokens ?? 0,
        },
    };
}

module.exports = { recognize, sanitiseResponse, retryWithBackoff };
