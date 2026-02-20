const { ValidationError } = require('../../shared/errors');

function validateSummarize(req, _res, next) {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return next(new ValidationError('text is required and must be a non-empty string'));
    }

    next();
}

module.exports = { validateSummarize };
