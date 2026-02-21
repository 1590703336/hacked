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
    const source = req.method === 'GET' ? req.query : req.body;
    const { markdown, streamId } = source;

    if (!markdown || typeof markdown !== 'string' || markdown.trim().length === 0) {
        return next(new ValidationError('markdown is required and must be a non-empty string'));
    }

    if (streamId !== undefined && (typeof streamId !== 'string' || streamId.trim().length === 0)) {
        return next(new ValidationError('streamId must be a non-empty string when provided'));
    }

    if (validateTTSOptions(source, next) === true) {
        next();
    }
}

function validateStreamControl(req, _res, next) {
    const { streamId, action } = req.body || {};

    if (!streamId || typeof streamId !== 'string' || streamId.trim().length === 0) {
        return next(new ValidationError('streamId is required and must be a non-empty string'));
    }

    const validActions = ['pause', 'resume', 'stop'];
    if (!validActions.includes(action)) {
        return next(new ValidationError(`action must be one of: ${validActions.join(', ')}`));
    }

    next();
}

module.exports = { validateSynthesize, validateChunk, validatePipeline, validateStream, validateStreamControl };
