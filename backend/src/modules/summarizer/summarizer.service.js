const OpenAI = require('openai');
const config = require('../../config');
const { ValidationError } = require('../../shared/errors');

const openai = new OpenAI({ apiKey: config.openaiApiKey });

/**
 * Summarize text into plain-English key takeaways.
 * @param {string} text - The text to summarize
 * @param {number} maxTakeaways - Max number of takeaways (default 3)
 * @returns {object} summary result
 */
async function summarize(text, maxTakeaways = 3) {
    if (!text || typeof text !== 'string') {
        throw new ValidationError('text is required');
    }

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'system',
                content: `You are a TL;DR summarizer for students with cognitive accessibility needs. Output at most ${maxTakeaways} key takeaways using strictly plain English. Be concise and clear.`,
            },
            { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 500,
    });

    const raw = response.choices[0]?.message?.content || '';

    // Strip common GPT list formatting (e.g. "1.", "1)", "-", "•", "–") and enforce cap
    const takeaways = raw
        .split('\n')
        .map((line) => line.replace(/^[\s\d]+[.)]\s*|^[-–•]\s*/u, '').trim())
        .filter((line) => line.length > 0)
        .slice(0, maxTakeaways);

    return {
        takeaways,
        model: 'gpt-4o',
        tokensUsed: response.usage?.total_tokens || 0,
    };
}

module.exports = { summarize };
