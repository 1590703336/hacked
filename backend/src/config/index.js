require('dotenv').config();

module.exports = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3001,

    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',

    // TTS
    ttsModel: process.env.TTS_MODEL || 'tts-1',
    ttsDefaultVoice: process.env.TTS_DEFAULT_VOICE || 'nova',

    ocr: {
        model: process.env.OCR_MODEL || 'google/gemini-3-flash-preview',
        maxImageBytes: 10 * 1024 * 1024,   // 10 MB decoded image limit
        maxOutputTokens: 4096,
        retryMaxAttempts: 3,
        retryBaseDelayMs: 500,
        retryMaxDelayMs: 4000,               // caps backoff so tests don't hang
    },
};
