const OpenAI = require('openai');
const crypto = require('crypto');
const { LRUCache } = require('lru-cache');
const pLimit = require('p-limit');
const config = require('../../config');
const { ValidationError, AppError } = require('../../shared/errors');

const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.openRouterApiKey,
});

const OUTPUT_MIME_TYPE = 'audio/wav';
const DEFAULT_KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DEFAULT_KOKORO_VOICE = 'af_nova';

const MODEL_ALIASES = {
    'tts-1': DEFAULT_KOKORO_MODEL,
    'tts-1-hd': DEFAULT_KOKORO_MODEL,
    'kokoro-82m': DEFAULT_KOKORO_MODEL,
};

const VOICE_ALIASES = {
    alloy: 'af_alloy',
    echo: 'am_echo',
    fable: 'bm_fable',
    onyx: 'am_onyx',
    nova: 'af_nova',
    shimmer: 'af_sky',
};

const ttsCache = new LRUCache({
    max: 500,
});

const chunkCache = new LRUCache({
    max: 100,
});

const kokoroModelCache = new Map();
const ttsInferenceLimit = pLimit(Math.max(1, Number(config.ttsInferenceConcurrency) || 2));
let prewarmPromise = null;

function perfLog(message) {
    if (config.enablePerfLogs) {
        console.log(message);
    }
}

function normalizeModel(model = config.ttsModel) {
    const modelValue = typeof model === 'string' && model.trim().length > 0
        ? model.trim()
        : config.ttsModel;
    return MODEL_ALIASES[modelValue] || modelValue || DEFAULT_KOKORO_MODEL;
}

function normalizeVoice(voice) {
    if (!voice || typeof voice !== 'string') {
        return VOICE_ALIASES[config.ttsDefaultVoice] || config.ttsDefaultVoice || DEFAULT_KOKORO_VOICE;
    }
    const trimmed = voice.trim();
    return VOICE_ALIASES[trimmed] || trimmed;
}

function normalizeSpeed(speed) {
    if (speed === undefined || speed === null || speed === '') {
        return 1.0;
    }
    const parsed = Number(speed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 1.0;
    }
    return parsed;
}

function generateCacheKey(text, voice, speed, model) {
    return crypto
        .createHash('md5')
        .update(`${text}|${voice}|${speed}|${model}|kokoro`)
        .digest('hex');
}

function preprocessMarkdown(markdown) {
    return markdown
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2')
        .replace(/\\sum/g, 'sum')
        .replace(/\\int/g, 'integral')
        .replace(/\\partial/g, 'partial derivative ')
        .replace(/\\rightarrow/g, 'implies')
        .replace(/\\alpha/g, 'alpha')
        .replace(/\\beta/g, 'beta')
        .replace(/\\theta/g, 'theta')
        .replace(/=/g, ' equals ');
}

function fallbackChunk(markdown) {
    const normalized = markdown.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return [];
    }

    const sentenceLikeChunks = normalized
        .split(/(?<=[.!?。！？])\s+/u)
        .map((chunk) => chunk.trim())
        .filter(Boolean);

    if (sentenceLikeChunks.length > 0) {
        return sentenceLikeChunks;
    }

    return normalized
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
}

function encodeFloat32ToWav(audioData, samplingRate) {
    const numChannels = 1;
    const bytesPerSample = 2;
    const bitsPerSample = 16;
    const dataSize = audioData.length * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(samplingRate, 24);
    buffer.writeUInt32LE(samplingRate * numChannels * bytesPerSample, 28);
    buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < audioData.length; i++) {
        const clamped = Math.max(-1, Math.min(1, audioData[i]));
        const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
        buffer.writeInt16LE(int16, 44 + (i * bytesPerSample));
    }

    return buffer;
}

function rawAudioToWavBuffer(rawAudio) {
    if (!rawAudio) {
        throw new AppError('Kokoro generated empty audio output', 503);
    }

    if (typeof rawAudio.toWav === 'function') {
        return Buffer.from(rawAudio.toWav());
    }

    if (!rawAudio.audio || !rawAudio.sampling_rate) {
        throw new AppError('Kokoro returned invalid audio payload', 503);
    }

    return encodeFloat32ToWav(rawAudio.audio, rawAudio.sampling_rate);
}

function concatRawAudioToWav(rawAudios) {
    if (!Array.isArray(rawAudios) || rawAudios.length === 0) {
        throw new ValidationError('No speakable text found');
    }

    const samplingRate = rawAudios[0]?.sampling_rate;
    if (!samplingRate) {
        throw new AppError('Missing sampling rate in generated audio', 503);
    }

    let totalLength = 0;
    for (const rawAudio of rawAudios) {
        if (!rawAudio?.audio || !rawAudio.sampling_rate) {
            throw new AppError('Kokoro returned invalid chunk audio payload', 503);
        }
        if (rawAudio.sampling_rate !== samplingRate) {
            throw new AppError('Inconsistent sampling rate across synthesized chunks', 503);
        }
        totalLength += rawAudio.audio.length;
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const rawAudio of rawAudios) {
        merged.set(rawAudio.audio, offset);
        offset += rawAudio.audio.length;
    }

    return encodeFloat32ToWav(merged, samplingRate);
}

async function getKokoro(model) {
    const modelId = normalizeModel(model);
    const cacheKey = `${modelId}|${config.ttsDevice}|${config.ttsDtype}`;

    const existing = kokoroModelCache.get(cacheKey);
    if (existing) {
        return existing;
    }

    const loaderPromise = (async () => {
        const loadStartedAt = Date.now();
        let KokoroTTS;
        try {
            ({ KokoroTTS } = require('kokoro-js'));
        } catch (requireError) {
            throw new AppError('kokoro-js is not installed. Run npm install in backend.', 500);
        }

        const model = await KokoroTTS.from_pretrained(modelId, {
            dtype: config.ttsDtype,
            device: config.ttsDevice,
        });
        perfLog(`[TTS][kokoro] model loaded model="${modelId}" device=${config.ttsDevice} dtype=${config.ttsDtype} loadMs=${Date.now() - loadStartedAt}`);
        return model;
    })().catch((loadError) => {
        kokoroModelCache.delete(cacheKey);
        if (loadError instanceof AppError) {
            throw loadError;
        }
        throw new AppError(
            `Failed to load Kokoro model "${modelId}". Set TTS_MODEL to a local model path or configure Hugging Face access.`,
            503
        );
    });

    kokoroModelCache.set(cacheKey, loaderPromise);
    return loaderPromise;
}

function resolveVoiceForModel(kokoro, requestedVoice) {
    const preferred = normalizeVoice(requestedVoice);
    if (kokoro?.voices && Object.prototype.hasOwnProperty.call(kokoro.voices, preferred)) {
        return preferred;
    }

    const configured = normalizeVoice(config.ttsDefaultVoice);
    if (kokoro?.voices && Object.prototype.hasOwnProperty.call(kokoro.voices, configured)) {
        return configured;
    }

    const firstVoice = Object.keys(kokoro?.voices || {})[0];
    return firstVoice || DEFAULT_KOKORO_VOICE;
}

async function synthesizeRawAudio(text, voice = config.ttsDefaultVoice, speed = 1.0, model = config.ttsModel) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new ValidationError('text is required');
    }

    try {
        const modelId = normalizeModel(model);
        const kokoro = await getKokoro(modelId);
        const resolvedVoice = resolveVoiceForModel(kokoro, voice);
        const resolvedSpeed = normalizeSpeed(speed);
        const queuedAt = Date.now();
        let inferenceStartedAt = queuedAt;

        const rawAudio = await ttsInferenceLimit(async () => {
            inferenceStartedAt = Date.now();
            return kokoro.generate(text, {
                voice: resolvedVoice,
                speed: resolvedSpeed,
            });
        });

        return {
            rawAudio,
            inferenceQueueWaitMs: Math.max(0, inferenceStartedAt - queuedAt),
            voice: resolvedVoice,
            model: modelId,
            speed: resolvedSpeed,
        };
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        console.error('Kokoro synthesis error:', error);
        throw new AppError('Failed to synthesize speech', 503);
    }
}

async function synthesize(text, voice = config.ttsDefaultVoice, speed = 1.0, model = config.ttsModel) {
    const { audioBuffer } = await synthesizeWithMeta(text, voice, speed, model);
    return audioBuffer;
}

async function synthesizeWithMeta(text, voice = config.ttsDefaultVoice, speed = 1.0, model = config.ttsModel) {
    const startedAt = Date.now();
    if (!text) {
        throw new ValidationError('text is required');
    }

    const normalizedVoice = normalizeVoice(voice);
    const normalizedSpeed = normalizeSpeed(speed);
    const normalizedModel = normalizeModel(model);
    const cacheKey = generateCacheKey(text, normalizedVoice, normalizedSpeed, normalizedModel);
    const cachedAudio = ttsCache.get(cacheKey);
    if (cachedAudio) {
        return {
            audioBuffer: cachedAudio,
            meta: {
                cacheHit: true,
                totalMs: Date.now() - startedAt,
                synthMs: 0,
                encodeMs: 0,
                inferenceQueueWaitMs: 0,
                voice: normalizedVoice,
                model: normalizedModel,
                speed: normalizedSpeed,
                bytes: cachedAudio.length,
            },
        };
    }

    const synthStartedAt = Date.now();
    const synthResult = await synthesizeRawAudio(text, normalizedVoice, normalizedSpeed, normalizedModel);
    const synthMs = Date.now() - synthStartedAt;

    const encodeStartedAt = Date.now();
    const wavBuffer = rawAudioToWavBuffer(synthResult.rawAudio);
    const encodeMs = Date.now() - encodeStartedAt;

    ttsCache.set(cacheKey, wavBuffer);

    return {
        audioBuffer: wavBuffer,
        meta: {
            cacheHit: false,
            totalMs: Date.now() - startedAt,
            synthMs,
            encodeMs,
            inferenceQueueWaitMs: synthResult.inferenceQueueWaitMs,
            voice: synthResult.voice,
            model: synthResult.model,
            speed: synthResult.speed,
            bytes: wavBuffer.length,
        },
    };
}

async function semanticChunk(markdown) {
    if (!markdown || typeof markdown !== 'string') {
        throw new ValidationError('markdown is required');
    }

    const cacheKey = crypto.createHash('md5').update(markdown).digest('hex');
    const cachedChunks = chunkCache.get(cacheKey);
    if (cachedChunks) {
        return cachedChunks;
    }

    const processedText = preprocessMarkdown(markdown);

    if (!config.openRouterApiKey) {
        const localChunks = fallbackChunk(processedText);
        chunkCache.set(cacheKey, localChunks);
        return localChunks;
    }

    try {
        const response = await openrouter.chat.completions.create({
            model: 'openai/gpt-4o',
            messages: [
                {
                    role: 'system',
                    content:
                        "You are a preprocessor for a text-to-speech engine. Convert the given Markdown text into an array of speakable chunks. Convert any remaining LaTeX formulas into natural language pronunciation. Each chunk should be a natural sentence or phrase.\n\nRules:\n1. Chunk strictly by natural pauses (periods, commas, question marks).\n2. Do NOT split in the middle of a mathematical formula or hyphenated word.\n3. Expand common academic acronyms if they are generally spelled out when spoken (e.g., 'e.g.' -> 'for example', 'i.e.' -> 'that is', 'vs.' -> 'versus').\n4. Output as a JSON object of shape: {\"chunks\":[\"...\"]}.",
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
            console.warn('Failed to parse chunk JSON, falling back to local split:', parseError);
            const fallbackChunks = fallbackChunk(processedText);
            chunkCache.set(cacheKey, fallbackChunks);
            return fallbackChunks;
        }

        const chunks = Array.isArray(parsed?.chunks)
            ? parsed.chunks.map((item) => `${item}`.trim()).filter(Boolean)
            : fallbackChunk(processedText);

        chunkCache.set(cacheKey, chunks);
        return chunks;
    } catch (error) {
        console.error('Semantic chunking error, falling back to local split:', error);
        const fallbackChunks = fallbackChunk(processedText);
        chunkCache.set(cacheKey, fallbackChunks);
        return fallbackChunks;
    }
}

async function synthesizeAll(markdown, voice = config.ttsDefaultVoice, speed = 1.0, model = config.ttsModel) {
    const chunks = await semanticChunk(markdown);
    if (chunks.length === 0) {
        throw new ValidationError('No speakable text found');
    }

    const concurrency = Math.max(1, Number(config.ttsChunkConcurrency) || 3);
    const limit = pLimit(concurrency);
    const synthesisPromises = chunks.map((chunk) =>
        limit(() => synthesizeRawAudio(chunk, voice, speed, model))
    );

    const rawResults = await Promise.all(synthesisPromises);
    const rawAudios = rawResults.map((item) => item.rawAudio);
    return concatRawAudioToWav(rawAudios);
}

function prewarmKokoro() {
    if (prewarmPromise) {
        return prewarmPromise;
    }

    prewarmPromise = (async () => {
        const startedAt = Date.now();
        const modelId = normalizeModel(config.ttsModel);
        const kokoro = await getKokoro(modelId);
        const voice = resolveVoiceForModel(kokoro, config.ttsDefaultVoice);
        await kokoro.generate('Warmup.', { voice, speed: 1.0 });
        perfLog(`[TTS][kokoro] prewarm complete model="${modelId}" voice=${voice} totalMs=${Date.now() - startedAt}`);
    })().catch((error) => {
        prewarmPromise = null;
        console.warn('[TTS][kokoro] prewarm failed:', error.message || error);
    });

    return prewarmPromise;
}

if (config.ttsPrewarm) {
    setTimeout(() => {
        prewarmKokoro();
    }, 0);
}

module.exports = {
    synthesize,
    synthesizeWithMeta,
    semanticChunk,
    synthesizeAll,
    outputMimeType: OUTPUT_MIME_TYPE,
};
