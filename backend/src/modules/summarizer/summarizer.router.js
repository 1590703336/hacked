const express = require('express');
const summarizerController = require('./summarizer.controller');
const { validateSummarize } = require('./summarizer.validator');

const router = express.Router();

// POST /api/summarize — summarize text into key takeaways
router.post('/', validateSummarize, summarizerController.summarize);

module.exports = router;
