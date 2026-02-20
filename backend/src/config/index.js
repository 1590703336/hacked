require('dotenv').config();

module.exports = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3001,

    // OpenAI
    openaiApiKey: process.env.OPENAI_API_KEY || '',

    // Google Gemini
    geminiApiKey: process.env.GEMINI_API_KEY || '',

    // OCR provider: 'gemini' | 'openai'
    ocrProvider: process.env.OCR_PROVIDER || 'gemini',
};
