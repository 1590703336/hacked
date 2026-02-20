const summarizerService = require('./summarizer.service');

async function summarize(req, res, next) {
    try {
        const { text, maxTakeaways } = req.body;
        const result = await summarizerService.summarize(text, maxTakeaways);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

module.exports = { summarize };
