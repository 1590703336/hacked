const tutorService = require('./tutor.service');

async function ask(req, res, next) {
    try {
        const { question, context } = req.body;
        const result = await tutorService.answerQuestion(question, context);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

async function transcribe(req, res, next) {
    try {
        const result = await tutorService.transcribeAudio(req.file);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

module.exports = { ask, transcribe };
