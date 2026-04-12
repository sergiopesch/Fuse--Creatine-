const streamHandler = require('../lib/vercel/orchestrate-stream');
const chatHandler = require('../lib/vercel/orchestrator-chat');

module.exports = (req, res) => {
    const route = req.query?.__fuseRoute;

    if (route === 'stream') return streamHandler(req, res);
    if (route === 'chat') return chatHandler(req, res);

    return res.status(404).json({ success: false, error: 'Unknown orchestrator endpoint' });
};
