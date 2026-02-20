const express = require('express');
const ttsController = require('./tts.controller');
const { validateSynthesize, validateChunk } = require('./tts.validator');

const router = express.Router();

// POST /api/tts/synthesize — convert text to audio
router.post('/synthesize', validateSynthesize, ttsController.synthesize);

// POST /api/tts/chunk — split markdown into speakable chunks
router.post('/chunk', validateChunk, ttsController.chunk);

module.exports = router;
