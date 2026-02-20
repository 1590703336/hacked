const OpenAI = require('openai');
const config = require('../../config');
const { ValidationError, AppError } = require('../../shared/errors');

const openai = new OpenAI({ apiKey: config.openaiApiKey });

/**
 * Convert text to speech using OpenAI TTS API.
 * @param {string} text - Text to speak
 * @param {string} voice - Voice model (alloy, echo, fable, onyx, nova, shimmer)
 * @param {number} speed - Playback speed (0.25 to 4.0)
 * @param {string} model - TTS model tier (tts-1 or tts-1-hd)
 * @returns {Buffer} audio buffer (mp3)
 */
async function synthesize(text, voice = config.ttsDefaultVoice, speed = 1.0, model = config.ttsModel) {
    if (!text) {
        throw new ValidationError('text is required');
    }

    try {
        const response = await openai.audio.speech.create({
            model: model,
            voice,
            input: text,
            response_format: 'mp3',
            speed: speed,
        });

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) {
        console.error('TTS Synthesize Error:', error);
        throw new AppError('Failed to synthesize speech', 503);
    }
}

/**
 * Split structured Markdown into semantic chunks for natural TTS playback.
 * Converts LaTeX formulas to natural language pronunciation.
 * @param {string} markdown - Structured markdown with possible LaTeX
 * @returns {string[]} array of speakable text chunks
 */
async function semanticChunk(markdown) {
    if (!markdown || typeof markdown !== 'string') {
        throw new ValidationError('markdown is required');
    }

    try {
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
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (parseError) {
            console.warn('Failed to parse GPT chunk response, falling back to naive split:', parseError);
            return markdown.split(/(?<=[.!?])\s+/).filter((c) => c.trim().length > 0);
        }

        if (!parsed.chunks || !Array.isArray(parsed.chunks)) {
            return markdown.split(/(?<=[.!?])\s+/).filter((c) => c.trim().length > 0);
        }

        return parsed.chunks;
    } catch (error) {
        console.error('Semantic Chunking Error:', error);
        throw new AppError('Failed to process text for speech', 503);
    }
}

/**
 * Full Pipeline: Convert markdown to chunks, then synthesize all into a single audio buffer.
 */
async function synthesizeAll(markdown, voice = config.ttsDefaultVoice, speed = 1.0, model = config.ttsModel) {
    const chunks = await semanticChunk(markdown);
    if (chunks.length === 0) {
        throw new ValidationError('No speakable text found');
    }

    const audioBuffers = [];
    for (const chunk of chunks) {
        const audioBuffer = await synthesize(chunk, voice, speed, model);
        audioBuffers.push(audioBuffer);
    }

    return Buffer.concat(audioBuffers);
}

module.exports = { synthesize, semanticChunk, synthesizeAll };
