const express = require('express');
const multer = require('multer');
const captureController = require('./capture.controller');
const { validateScreenCapture } = require('./capture.validator');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/capture/upload — upload a PDF or image file
router.post('/upload', upload.single('file'), captureController.uploadFile);

// POST /api/capture/screen — receive a base64 screen capture
router.post('/screen', validateScreenCapture, captureController.captureScreen);

module.exports = router;
