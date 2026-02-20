const { ValidationError } = require('../../shared/errors');

function validateAsk(req, _res, next) {
    const { question } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return next(new ValidationError('question is required and must be a non-empty string'));
    }

    next();
}

module.exports = { validateAsk };
