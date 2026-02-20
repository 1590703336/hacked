const OpenAI = require('openai');
const crypto = require('crypto');
const { LRUCache } = require('lru-cache');
const pLimit = require('p-limit');
const config = require('../../config');
const { ValidationError, AppError } = require('../../shared/errors');

const openai = new OpenAI({ apiKey: config.openaiApiKey });

// Cache up to 500 TTS chunks (approx 50MB of audio in memory) to save API calls
const ttsCache = new LRUCache({
    max: 500,
});

/**
 * Generate MD5 hash for cache key
 */
function generateCacheKey(text, voice, speed, model) {
    return crypto
        .createHash('md5')
        .update(`${text}|${voice}|${speed}|${model}`)
        .digest('hex');
}

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

    const cacheKey = generateCacheKey(text, voice, speed, model);
    const cachedAudio = ttsCache.get(cacheKey);
    if (cachedAudio) {
        return cachedAudio;
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
        const buffer = Buffer.from(arrayBuffer);

        ttsCache.set(cacheKey, buffer);
        return buffer;
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

    // 1. Pre-process obvious LaTeX to ease the GPT chunking burden
    let processedText = markdown
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2') // \frac{a}{b} -> a over b
        .replace(/\\sum/g, 'sum')
        .replace(/\\int/g, 'integral')
        .replace(/\\partial/g, 'partial derivative ')
        .replace(/\\rightarrow/g, 'implies')
        .replace(/\\alpha/g, 'alpha')
        .replace(/\\beta/g, 'beta')
        .replace(/\\theta/g, 'theta')
        .replace(/=/g, ' equals ');

    try {
        // Use GPT to convert remaining LaTeX and structure into natural speech chunks
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content:
                        'You are a preprocessor for a text-to-speech engine. Convert the given Markdown text into an array of speakable chunks. Convert any remaining LaTeX formulas into natural language pronunciation. Each chunk should be a natural sentence or phrase. Output as a JSON array of strings.',
                },
                { role: 'user', content: processedText },
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

    // Limit concurrency to 5 parallel synthesis requests to prevent OpenAI rate limiting
    const limit = pLimit(5);
    const synthesisPromises = chunks.map((chunk) =>
        limit(() => synthesize(chunk, voice, speed, model))
    );

    const audioBuffers = await Promise.all(synthesisPromises);

    return Buffer.concat(audioBuffers);
}

module.exports = { synthesize, semanticChunk, synthesizeAll };
