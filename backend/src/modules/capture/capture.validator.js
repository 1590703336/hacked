const { ValidationError } = require('../../shared/errors');

function validateScreenCapture(req, _res, next) {
    const { imageBase64 } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
        return next(new ValidationError('imageBase64 is required and must be a string'));
    }

    next();
}

module.exports = { validateScreenCapture };
