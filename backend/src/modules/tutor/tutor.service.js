const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const config = require('../../config');
const { ValidationError } = require('../../shared/errors');

const openai = new OpenAI({ apiKey: config.openaiApiKey });

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

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'system',
                content: `You are a friendly, patient AI tutor designed for students with cognitive accessibility needs. The student is currently reading a passage and has paused to ask a question. Use the reading context to answer with a relatable, real-world analogy. Keep your answer concise (2-3 sentences max) and avoid jargon.`,
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

    // Write buffer to a temp file for the Whisper API
    const tempPath = path.join('/tmp', `whisper-${Date.now()}.webm`);
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
