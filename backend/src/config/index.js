require('dotenv').config();

module.exports = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3001,

    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',

    // TTS
    ttsModel: process.env.TTS_MODEL || 'onnx-community/Kokoro-82M-v1.0-ONNX',
    ttsDefaultVoice: process.env.TTS_DEFAULT_VOICE || 'af_nova',
    ttsDevice: process.env.TTS_DEVICE || 'cpu',
    ttsDtype: process.env.TTS_DTYPE || 'q8',
    ttsChunkConcurrency: parseInt(process.env.TTS_CHUNK_CONCURRENCY, 10) || 3,
    ttsRetryAttempts: parseInt(process.env.TTS_RETRY_ATTEMPTS, 10) || 2,

    ocr: {
        model: process.env.OCR_MODEL || 'google/gemini-3-flash-preview',
        maxImageBytes: 10 * 1024 * 1024,   // 10 MB decoded image limit
        maxOutputTokens: 4096,
        retryMaxAttempts: 3,
        retryBaseDelayMs: 500,
        retryMaxDelayMs: 4000,               // caps backoff so tests don't hang
    },
};
