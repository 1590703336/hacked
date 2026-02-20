/**
 * ocr.validator.test.js — Gate 1 (6 tests)
 * Tests the validateOcrRequest middleware in isolation.
 * No HTTP server needed — calls the middleware directly with mock req/res/next.
 */

const { validateOcrRequest } = require('./ocr.validator');

// A real 1x1 pixel PNG in Base64 — passes all checks
const VALID_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// A real 1x1 pixel JPEG in Base64
const VALID_JPEG_B64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH' +
    'BwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAAR' +
    'CAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA' +
    'AAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAA' +
    'AAAAAAAA/9oADAMBAAIRAxEAPwCwABmX/9k=';

// A real PDF magic bytes in Base64 (JVBER...)
const PDF_B64 = 'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgo+Pgo=';

function makeReq(body) {
    return { body: { ...body } };
}

function makeRes() {
    return {}; // validator never calls res
}

function makeNext() {
    const fn = jest.fn();
    return fn;
}

describe('ocr.validator — validateOcrRequest', () => {

    test('1. Missing imageBase64 → calls next with ValidationError', () => {
        const req = makeReq({});
        const next = makeNext();
        validateOcrRequest(req, makeRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
        const err = next.mock.calls[0][0];
        expect(err.name).toBe('ValidationError');
        expect(err.statusCode).toBe(400);
    });

    test('2. Non-string imageBase64 (number) → calls next with ValidationError', () => {
        const req = makeReq({ imageBase64: 12345 });
        const next = makeNext();
        validateOcrRequest(req, makeRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
        const err = next.mock.calls[0][0];
        expect(err.name).toBe('ValidationError');
    });

    test('3. Data-URL prefix is stripped → req.body.imageBase64 has no prefix', () => {
        const req = makeReq({ imageBase64: `data:image/png;base64,${VALID_PNG_B64}` });
        const next = makeNext();
        validateOcrRequest(req, makeRes(), next);
        expect(next).toHaveBeenCalledWith(); // called with no args = success
        expect(req.body.imageBase64).toBe(VALID_PNG_B64);
        expect(req.body.imageBase64).not.toContain('data:');
    });

    test('4. Valid PNG magic bytes → mimeType set to image/png', () => {
        const req = makeReq({ imageBase64: VALID_PNG_B64 });
        const next = makeNext();
        validateOcrRequest(req, makeRes(), next);
        expect(next).toHaveBeenCalledWith(); // no error arg
        expect(req.body.mimeType).toBe('image/png');
    });

    test('5. PDF base64 (JVBER…) → calls next with ValidationError mentioning PDF', () => {
        const req = makeReq({ imageBase64: PDF_B64 });
        const next = makeNext();
        validateOcrRequest(req, makeRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
        const err = next.mock.calls[0][0];
        expect(err.name).toBe('ValidationError');
        expect(err.message).toMatch(/PDF/i);
    });

    test('6. Decoded size > 10 MB → calls next with ValidationError mentioning limit', () => {
        // Approximate: 10 MB raw ≈ 13.65 MB Base64
        // Build a string of valid Base64 chars that pushes past the threshold.
        // We use a valid repeating Base64 block (no real image — just size matters here).
        const chunkSize = 14 * 1024 * 1024; // 14 MB of Base64 chars → decodes to ~10.5 MB
        const oversized = 'A'.repeat(chunkSize);
        const req = makeReq({ imageBase64: oversized });
        const next = makeNext();
        validateOcrRequest(req, makeRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
        const err = next.mock.calls[0][0];
        expect(err.name).toBe('ValidationError');
        expect(err.message).toMatch(/limit/i);
    });

});
