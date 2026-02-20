require('dotenv').config();

module.exports = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3001,

    geminiApiKey: process.env.GEMINI_API_KEY || '',

    ocr: {
        model: process.env.OCR_MODEL || 'gemini-3-flash-preview',
        maxImageBytes: 10 * 1024 * 1024,   // 10 MB decoded image limit
        maxOutputTokens: 4096,
        retryMaxAttempts: 3,
        retryBaseDelayMs: 500,
        retryMaxDelayMs: 4000,               // caps backoff so tests don't hang
    },
};
