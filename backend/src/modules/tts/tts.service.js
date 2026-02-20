const OpenAI = require('openai');
const config = require('../../config');
const { ValidationError } = require('../../shared/errors');

const openai = new OpenAI({ apiKey: config.openaiApiKey });

/**
 * Convert text to speech using OpenAI TTS API.
 * @param {string} text - Text to speak
 * @param {string} voice - Voice model (alloy, echo, fable, onyx, nova, shimmer)
 * @returns {Buffer} audio buffer (mp3)
 */
async function synthesize(text, voice = 'nova') {
    if (!text) {
        throw new ValidationError('text is required');
    }

    const response = await openai.audio.speech.create({
        model: 'tts-1',
        voice,
        input: text,
        response_format: 'mp3',
    });

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Split structured Markdown into semantic chunks for natural TTS playback.
 * Converts LaTeX formulas to natural language pronunciation.
 * @param {string} markdown - Structured markdown with possible LaTeX
 * @returns {string[]} array of speakable text chunks
 */
async function semanticChunk(markdown) {
    if (!markdown) {
        throw new ValidationError('markdown is required');
    }

    // Use GPT to convert LaTeX and structure into natural speech chunks
    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'system',
                content:
                    'You are a preprocessor for a text-to-speech engine. Convert the given Markdown text into an array of speakable chunks. Convert any LaTeX formulas into natural language pronunciation (e.g., "partial derivative of f with respect to x"). Each chunk should be a natural sentence or phrase. Output as a JSON array of strings.',
            },
            { role: 'user', content: markdown },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{"chunks":[]}';
    const parsed = JSON.parse(content);
    return parsed.chunks || [];
}

module.exports = { synthesize, semanticChunk };
