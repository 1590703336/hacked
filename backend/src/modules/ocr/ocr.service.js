const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config');
const { ValidationError, AppError } = require('../../shared/errors');

const openai = new OpenAI({ apiKey: config.openaiApiKey });
const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Recognize text from a base64-encoded image.
 * Supports two providers: 'gemini' (Gemini 3 Flash) and 'openai' (GPT-4o Vision).
 *
 * @param {string} imageBase64 - Base64-encoded image data
 * @param {string} provider - 'gemini' | 'openai' (defaults to config)
 * @returns {object} recognized text and metadata
 */
async function recognize(imageBase64, provider) {
    if (!imageBase64) {
        throw new ValidationError('imageBase64 is required');
    }

    const selectedProvider = provider || config.ocrProvider;

    if (selectedProvider === 'gemini') {
        return recognizeWithGemini(imageBase64);
    } else if (selectedProvider === 'openai') {
        return recognizeWithOpenAI(imageBase64);
    } else {
        throw new ValidationError(`Unknown OCR provider: ${selectedProvider}`);
    }
}

async function recognizeWithGemini(imageBase64) {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent([
        {
            inlineData: {
                mimeType: 'image/png',
                data: imageBase64,
            },
        },
        {
            text: 'Extract all text from this image. If there are math formulas, convert them to standard LaTeX format. If there is code, preserve the formatting. Output the result as clean structured Markdown.',
        },
    ]);

    const text = result.response?.text() || '';

    return {
        markdown: text,
        provider: 'gemini',
        model: 'gemini-2.0-flash',
    };
}

async function recognizeWithOpenAI(imageBase64) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: 'Extract all text from this image. If there are math formulas, convert them to standard LaTeX format. If there is code, preserve the formatting. Output the result as clean structured Markdown.',
                    },
                    {
                        type: 'image_url',
                        image_url: { url: `data:image/png;base64,${imageBase64}` },
                    },
                ],
            },
        ],
        max_tokens: 4096,
    });

    const text = response.choices[0]?.message?.content || '';

    return {
        markdown: text,
        provider: 'openai',
        model: 'gpt-4o',
        tokensUsed: response.usage?.total_tokens || 0,
    };
}

module.exports = { recognize };
