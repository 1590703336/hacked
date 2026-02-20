const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const config = require('../../config');
const { ValidationError } = require('../../shared/errors');

// Standard OpenAI client strictly for Audio APIs (Whisper/TTS)
const openai = new OpenAI({ apiKey: config.openaiApiKey });

// OpenRouter client for Chat Completions
const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.openRouterApiKey,
});

/**
 * Answer a user's spoken question using the current reading context.
 * Generates a relatable real-world analogy.
 * @param {string} question - The transcribed user question
 * @param {string} context - The current text being read aloud
 * @returns {object} AI response with explanation
 */
async function answerQuestion(question, context) {
    if (!question) {
        throw new ValidationError('question is required');
    }

    const response = await openrouter.chat.completions.create({
        model: 'openai/gpt-4o',
        messages: [
            {
                role: 'system',
                content: `You are a friendly, patient AI tutor designed for students with cognitive accessibility needs. The student is currently reading a passage and has paused to ask a question. Use the reading context and answer with a relatable, everyday real-world analogy (e.g., baking, sports, driving) to explain the concept. Keep your answer concise (2-3 sentences max) and avoid jargon. Do not patronize or use overly childish language; treat the student as an adult learner needing clarity.`,
            },
            {
                role: 'user',
                content: `Reading context:\n${context || '(no context provided)'}\n\nStudent question: ${question}`,
            },
        ],
        temperature: 0.5,
        max_tokens: 300,
    });

    const answer = response.choices[0]?.message?.content || '';

    return {
        question,
        answer,
        tokensUsed: response.usage?.total_tokens || 0,
    };
}

/**
 * Transcribe an audio file using OpenAI Whisper API.
 * @param {object} file - Multer file object (audio recording)
 * @returns {object} transcription result
 */
async function transcribeAudio(file) {
    if (!file) {
        throw new ValidationError('No audio file provided');
    }

    // Write buffer to a temp file for the Whisper API, preserving the file extension so OpenAI accepts it
    const ext = file.originalname ? path.extname(file.originalname) : '.webm';
    const tempPath = path.join('/tmp', `whisper-${Date.now()}${ext}`);
    fs.writeFileSync(tempPath, file.buffer);

    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempPath),
            model: 'whisper-1',
            language: 'en',
        });

        return {
            text: transcription.text,
            model: 'whisper-1',
        };
    } finally {
        // Clean up temp file
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
    }
}

module.exports = { answerQuestion, transcribeAudio };
