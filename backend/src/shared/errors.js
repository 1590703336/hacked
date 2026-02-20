class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
        this.name = 'NotFoundError';
    }
}

class ValidationError extends AppError {
    constructor(message = 'Validation failed') {
        super(message, 400);
        this.name = 'ValidationError';
    }
}

class ProviderError extends AppError {
    /**
     * @param {string} model  - The AI model that failed (e.g. 'google/gemini-3-flash-preview')
     * @param {string} message - Human-readable reason
     * @param {Error|null} originalError - Raw upstream error (never sent to client)
     */
    constructor(model, message, originalError = null) {
        super(`[${model}] ${message}`, 502);
        this.name = 'ProviderError';
        this.model = model;
        this.originalError = originalError; // kept server-side for logging only
    }
}

module.exports = { AppError, NotFoundError, ValidationError, ProviderError };
