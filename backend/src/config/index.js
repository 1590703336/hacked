require('dotenv').config();

module.exports = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3001,

    // OpenAI
    openaiApiKey: process.env.OPENAI_API_KEY || '',

    // Google Gemini
    geminiApiKey: process.env.GEMINI_API_KEY || '',

    // TTS
    ttsModel: process.env.TTS_MODEL || 'tts-1',
    ttsDefaultVoice: process.env.TTS_DEFAULT_VOICE || 'nova',
};
