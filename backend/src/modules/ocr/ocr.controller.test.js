/**
 * ocr.controller.test.js — Gate 4 (3 Supertest integration tests)
 * Tests the full Express route: POST /api/ocr
 * ocrService is mocked — no Gemini API key needed.
 */

const request = require('supertest');

// ─── Mock ocr.service BEFORE requiring anything that imports it ───────────────
jest.mock('./ocr.service');
const ocrService = require('./ocr.service');
const { ProviderError } = require('../../shared/errors');

// ─── Build a minimal Express app matching the real one ────────────────────────
const express = require('express');
const { validateOcrRequest } = require('./ocr.validator');
const { recognizeImage } = require('./ocr.controller');
const { errorHandler } = require('../../middleware/errorHandler');

function buildApp() {
    const app = express();
    app.use(express.json({ limit: '20mb' }));
    app.post('/api/ocr', validateOcrRequest, recognizeImage);
    app.use(errorHandler);
    return app;
}

let serverInstance;
afterAll((done) => {
    if (serverInstance) serverInstance.close(done);
    else done();
});


// A minimal valid PNG base64 (1×1 pixel) — passes validator
const VALID_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

beforeEach(() => {
    jest.clearAllMocks();
});

describe('POST /api/ocr — controller integration', () => {

    test('1. Valid PNG body → 200 with requestId, success, and data.markdown', async () => {
        ocrService.recognize.mockResolvedValueOnce({
            markdown: '## Notes\n\n$$F = ma$$',
            noTextDetected: false,
            model: 'google/gemini-3-flash-preview',
            mimeType: 'image/png',
            latencyMs: 850,
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        });

        const app = buildApp();
        const res = await request(app)
            .post('/api/ocr')
            .send({ imageBase64: VALID_PNG });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.requestId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
        expect(res.body.data.markdown).toBe('## Notes\n\n$$F = ma$$');
    });

    test('2. Missing imageBase64 → 400 ValidationError (validator intercepts)', async () => {
        const app = buildApp();
        const res = await request(app)
            .post('/api/ocr')
            .send({});  // no imageBase64

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('ValidationError');
        expect(ocrService.recognize).not.toHaveBeenCalled();
    });

    test('3. Service throws ProviderError → 502 with error name in body', async () => {
        ocrService.recognize.mockRejectedValueOnce(
            new ProviderError('google/gemini-3-flash-preview', 'quota exceeded')
        );

        const app = buildApp();
        const res = await request(app)
            .post('/api/ocr')
            .send({ imageBase64: VALID_PNG });

        expect(res.status).toBe(502);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('ProviderError');
        // originalError must NOT appear in response
        expect(JSON.stringify(res.body)).not.toContain('originalError');
    });

});
