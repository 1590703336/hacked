const { ValidationError } = require('../../shared/errors');

const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

function validateSynthesize(req, _res, next) {
    const { text, voice } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return next(new ValidationError('text is required and must be a non-empty string'));
    }

    if (voice && !VALID_VOICES.includes(voice)) {
        return next(new ValidationError(`voice must be one of: ${VALID_VOICES.join(', ')}`));
    }

    next();
}

function validateChunk(req, _res, next) {
    const { markdown } = req.body;

    if (!markdown || typeof markdown !== 'string' || markdown.trim().length === 0) {
        return next(new ValidationError('markdown is required and must be a non-empty string'));
    }

    next();
}

module.exports = { validateSynthesize, validateChunk };
