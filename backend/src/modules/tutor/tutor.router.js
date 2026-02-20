const express = require('express');
const multer = require('multer');
const tutorController = require('./tutor.controller');
const { validateAsk } = require('./tutor.validator');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/tutor/ask — ask a contextual question (text)
router.post('/ask', validateAsk, tutorController.ask);

// POST /api/tutor/transcribe — transcribe an audio recording (Whisper)
router.post('/transcribe', upload.single('audio'), tutorController.transcribe);

module.exports = router;
