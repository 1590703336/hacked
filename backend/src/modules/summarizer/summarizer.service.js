const OpenAI = require('openai');
const config = require('../../config');
const { ValidationError } = require('../../shared/errors');

const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.openRouterApiKey,
});

/**
 * Summarize text into plain-English key takeaways.
 * @param {string} text - The text to summarize
 * @param {number} maxTakeaways3 - Max number of takeaways (default 3)
 * @returns {object} summary result
 */
async function summarize(text, maxTakeaways = 3) {
    if (!text || typeof text !== 'string') {
        throw new ValidationError('text is required');
    }

    const response = await openrouter.chat.completions.create({
        model: 'openai/gpt-4o',
        messages: [
            {
                role: 'system',
                content: `You are a TL;DR summarizer for students with cognitive accessibility needs. Output at most ${maxTakeaways} key takeaways using strictly plain English (Flesch-Kincaid Grade Level 6-8). Avoid all academic jargon, nested clauses, and complex vocabulary. Output ONLY a valid JSON array of strings: ["Takeaway 1", "Takeaway 2"]. Do not use markdown formatting like \`\`\`json.`,
            },
            { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 500,
    });

    let raw = response.choices[0]?.message?.content || '[]';

    // Strip markdown code block if present
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let takeaways = [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            takeaways = parsed.slice(0, maxTakeaways);
        }
    } catch (e) {
        // Fallback gracefully if model fails JSON
        console.error("Failed to parse JSON:", raw, e);
        takeaways = raw
            .split('\n')
            .map((line) => line.replace(/^([`\[\]",]|\s)*([\s\d]+[.)]\s*|[-–•]\s*)?/ug, '').trim())
            .filter((line) => line.length > 5)
            .slice(0, maxTakeaways);
    }

    return {
        takeaways,
        model: 'openai/gpt-4o',
        tokensUsed: response.usage?.total_tokens || 0,
    };
}

module.exports = { summarize };
