const express = require('express');
const ocrController = require('./ocr.controller');
const { validateOcrRequest } = require('./ocr.validator');

const router = express.Router();

// POST /api/ocr — recognize text from an image
router.post('/', validateOcrRequest, ocrController.recognizeImage);

module.exports = router;
