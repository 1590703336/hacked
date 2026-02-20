const { ValidationError } = require('../../shared/errors');

function validateOcrRequest(req, _res, next) {
    const { imageBase64 } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
        return next(new ValidationError('imageBase64 is required and must be a string'));
    }

    const { provider } = req.body;
    if (provider && !['gemini', 'openai'].includes(provider)) {
        return next(new ValidationError('provider must be "gemini" or "openai"'));
    }

    next();
}

module.exports = { validateOcrRequest };
