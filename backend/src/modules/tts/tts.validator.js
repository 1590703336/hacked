const { ValidationError } = require('../../shared/errors');

const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
const VALID_MODELS = ['tts-1', 'tts-1-hd'];

function validateTTSOptions(options, next) {
    const { voice, speed, model } = options;

    if (voice && !VALID_VOICES.includes(voice)) {
        return next(new ValidationError(`voice must be one of: ${VALID_VOICES.join(', ')}`));
    }

    if (model && !VALID_MODELS.includes(model)) {
        return next(new ValidationError(`model must be one of: ${VALID_MODELS.join(', ')}`));
    }

    if (speed !== undefined) {
        const speedNum = Number(speed);
        if (isNaN(speedNum) || speedNum < 0.25 || speedNum > 4.0) {
            return next(new ValidationError('speed must be a number between 0.25 and 4.0'));
        }
    }

    return true;
}

function validateSynthesize(req, _res, next) {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return next(new ValidationError('text is required and must be a non-empty string'));
    }

    if (validateTTSOptions(req.body, next) === true) {
        next();
    }
}

function validateChunk(req, _res, next) {
    const { markdown } = req.body;

    if (!markdown || typeof markdown !== 'string' || markdown.trim().length === 0) {
        return next(new ValidationError('markdown is required and must be a non-empty string'));
    }

    next();
}

function validatePipeline(req, _res, next) {
    const { markdown } = req.body;

    if (!markdown || typeof markdown !== 'string' || markdown.trim().length === 0) {
        return next(new ValidationError('markdown is required and must be a non-empty string'));
    }

    if (validateTTSOptions(req.body, next) === true) {
        next();
    }
}

function validateStream(req, _res, next) {
    const { markdown } = req.query;

    if (!markdown || typeof markdown !== 'string' || markdown.trim().length === 0) {
        return next(new ValidationError('markdown is required and must be a non-empty string'));
    }

    // Pass req.query for SSE option validation
    if (validateTTSOptions(req.query, next) === true) {
        next();
    }
}

module.exports = { validateSynthesize, validateChunk, validatePipeline, validateStream };


