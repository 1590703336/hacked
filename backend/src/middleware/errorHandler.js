const { AppError } = require('../shared/errors');

function errorHandler(err, _req, res, _next) {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.name,
            message: err.message,
        });
    }

    console.error('Unhandled error:', err);
    return res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'An unexpected error occurred',
    });
}

module.exports = { errorHandler };
