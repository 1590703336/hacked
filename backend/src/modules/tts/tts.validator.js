const { ValidationError } = require('../../shared/errors');

function validateTTSOptions(options, next) {
    const { voice, speed, model } = options;

    if (voice !== undefined && (typeof voice !== 'string' || voice.trim().length === 0)) {
        return next(new ValidationError('voice must be a non-empty string'));
    }

    if (model !== undefined && (typeof model !== 'string' || model.trim().length === 0)) {
        return next(new ValidationError('model must be a non-empty string'));
    }

    if (speed !== undefined) {
        const speedNum = Number(speed);
        if (isNaN(speedNum) || speedNum < 0.5 || speedNum > 2.0) {
            return next(new ValidationError('speed must be a number between 0.5 and 2.0'));
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

