const express = require('express');
const ttsController = require('./tts.controller');
const { validateSynthesize, validateChunk, validatePipeline, validateStream } = require('./tts.validator');

const router = express.Router();

// POST /api/tts/synthesize — convert text to audio
router.post('/synthesize', validateSynthesize, ttsController.synthesize);

// POST /api/tts/chunk — split markdown into speakable chunks
router.post('/chunk', validateChunk, ttsController.chunk);

// POST /api/tts/pipeline — parse markdown to audio
router.post('/pipeline', validatePipeline, ttsController.pipeline);

// GET /api/tts/stream — server sent events for chunks
router.get('/stream', validateStream, ttsController.streamChunks);

module.exports = router;
