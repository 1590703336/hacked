const express = require('express');
const cors = require('cors');
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');

// Module routers
const captureRouter = require('./modules/capture/capture.router');
const summarizerRouter = require('./modules/summarizer/summarizer.router');
const ocrRouter = require('./modules/ocr/ocr.router');
const ttsRouter = require('./modules/tts/tts.router');
const tutorRouter = require('./modules/tutor/tutor.router');

const app = express();

// --------------- Global Middleware ---------------
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    if (!config.enablePerfLogs) {
        return next();
    }
    const startedAt = Date.now();
    res.on('finish', () => {
        const durationMs = Date.now() - startedAt;
        console.log(`[HTTP] ${req.method} ${req.originalUrl} status=${res.statusCode} durationMs=${durationMs}`);
    });
    next();
});

// --------------- Health Check ---------------
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --------------- API Routes ---------------
app.use('/api/capture', captureRouter);
app.use('/api/summarize', summarizerRouter);
app.use('/api/ocr', ocrRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/tutor', tutorRouter);

// --------------- Error Handling ---------------
app.use(errorHandler);

module.exports = app;
