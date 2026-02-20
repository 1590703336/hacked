/**
 * ocr.service.test.js — Gate 3 (8 tests)
 * All calls to @google/generative-ai are mocked — no real API key needed.
 *
 * KEY PATTERN: genAI is a module-level singleton, so GoogleGenerativeAI's
 * constructor mock must be wired BEFORE the service module is required.
 * We use a shared `mockGenerateContent` jest.fn() that each test controls
 * via mockResolvedValueOnce / mockRejectedValueOnce.
 */

// ─── 1. Shared mock function — controls what Gemini "returns" per test ───────
const mockGenerateContent = jest.fn();

// ─── 2. Mock the SDK BEFORE requiring the service ────────────────────────────
jest.mock('@google/generative-ai', () => {
    const mockGetGenerativeModel = jest.fn().mockReturnValue({
        generateContent: mockGenerateContent,  // same reference, controlled below
    });
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
            getGenerativeModel: mockGetGenerativeModel,
        })),
    };
});

// ─── 3. Mock config (low retry counts so tests are instant) ──────────────────
jest.mock('../../config', () => ({
    openRouterApiKey: 'test-key',      // non-empty → guard passes
    ocr: {
        model: 'google/gemini-3-flash-preview',
        maxOutputTokens: 4096,
        retryMaxAttempts: 2,    // low so tests fail fast
        retryBaseDelayMs: 1,    // 1 ms — tests don't actually wait
        retryMaxDelayMs: 2,
    },
}));

// ─── 4. Require service AFTER mocks are wired ────────────────────────────────
const { recognize, sanitiseResponse } = require('./ocr.service');
const { ProviderError } = require('../../shared/errors');

// ─── Shared test data ─────────────────────────────────────────────────────────
const VALID_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ' +
    'AAbjjqiwAAAABJRU5ErkJggg==';
const MIME = 'image/png';

// Helper to build a successful Gemini response object
function geminiSuccess(text, usage = {}) {
    return {
        response: {
            text: () => text,
            usageMetadata: {
                promptTokenCount: usage.prompt ?? 10,
                candidatesTokenCount: usage.candidates ?? 5,
                totalTokenCount: usage.total ?? 15,
            },
        },
    };
}

// Helper to build a rejected error with a status code
function geminiError(status, code) {
    const err = new Error(`HTTP ${status}`);
    err.status = status;
    if (code) err.code = code;
    return err;
}

beforeEach(() => {
    mockGenerateContent.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('ocr.service — recognize()', () => {

    test('1. Success path — returns markdown, correct model, noTextDetected=false', async () => {
        mockGenerateContent.mockResolvedValueOnce(geminiSuccess('## Title\n\n$$E = mc^2$$'));

        const result = await recognize(VALID_PNG, MIME);

        expect(result.markdown).toBe('## Title\n\n$$E = mc^2$$');
        expect(result.noTextDetected).toBe(false);
        expect(result.model).toBe('google/gemini-3-flash-preview');
        expect(result.mimeType).toBe(MIME);
        expect(typeof result.latencyMs).toBe('number');
        expect(result.usage.totalTokens).toBe(15);
    });

    test('2. Empty string response → noTextDetected=true, markdown=""', async () => {
        mockGenerateContent.mockResolvedValueOnce(geminiSuccess(''));

        const result = await recognize(VALID_PNG, MIME);

        expect(result.noTextDetected).toBe(true);
        expect(result.markdown).toBe('');
    });

    test('3. [NO_TEXT_DETECTED] sentinel → noTextDetected=true, markdown=""', async () => {
        mockGenerateContent.mockResolvedValueOnce(geminiSuccess('[NO_TEXT_DETECTED]'));

        const result = await recognize(VALID_PNG, MIME);

        expect(result.noTextDetected).toBe(true);
        expect(result.markdown).toBe('');
    });

    test('4. Triple-backtick wrapped response → fence is stripped', async () => {
        mockGenerateContent.mockResolvedValueOnce(
            geminiSuccess('```markdown\n## Heading\n\nSome content\n```')
        );

        const result = await recognize(VALID_PNG, MIME);

        expect(result.markdown).toBe('## Heading\n\nSome content');
        expect(result.markdown).not.toContain('```');
    });

    test('5. 429 rate-limit → retried retryMaxAttempts times, then throws ProviderError', async () => {
        // Reject every call with 429
        mockGenerateContent.mockRejectedValue(geminiError(429));

        await expect(recognize(VALID_PNG, MIME)).rejects.toMatchObject({
            name: 'ProviderError',
            statusCode: 502,
        });

        // retryMaxAttempts = 2 in test config
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    test('6. 503 unavailable → retried, then throws ProviderError', async () => {
        mockGenerateContent.mockRejectedValue(geminiError(503));

        await expect(recognize(VALID_PNG, MIME)).rejects.toMatchObject({
            name: 'ProviderError',
            statusCode: 502,
        });
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    test('7. 401 auth error → NOT retried, ProviderError thrown after 1 attempt', async () => {
        mockGenerateContent.mockRejectedValue(geminiError(401));

        await expect(recognize(VALID_PNG, MIME)).rejects.toMatchObject({
            name: 'ProviderError',
            statusCode: 502,
        });

        // Non-retryable — must be called exactly once
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    test('8. Missing OPENROUTER_API_KEY → ProviderError thrown, no API call made', async () => {
        const config = require('../../config');
        const originalKey = config.openRouterApiKey;
        config.openRouterApiKey = '';  // simulate missing key

        await expect(recognize(VALID_PNG, MIME)).rejects.toMatchObject({
            name: 'ProviderError',
            statusCode: 502,
        });
        expect(mockGenerateContent).not.toHaveBeenCalled();

        config.openRouterApiKey = originalKey; // restore
    });

});

// ─── sanitiseResponse unit tests ──────────────────────────────────────────────
describe('ocr.service — sanitiseResponse()', () => {
    test('strips ```markdown fence', () => {
        expect(sanitiseResponse('```markdown\nhello\n```')).toBe('hello');
    });
    test('strips ``` fence with no language tag', () => {
        expect(sanitiseResponse('```\nhello\n```')).toBe('hello');
    });
    test('leaves plain text untouched (just trims)', () => {
        expect(sanitiseResponse('  hello world  ')).toBe('hello world');
    });
});
