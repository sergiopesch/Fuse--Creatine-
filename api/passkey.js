const registerHandler = require('../lib/vercel/passkey-register');
const authenticateHandler = require('../lib/vercel/passkey-authenticate');

module.exports = (req, res) => {
    const route = req.query?.__fuseRoute;

    if (route === 'register') return registerHandler(req, res);
    if (route === 'authenticate') return authenticateHandler(req, res);

    return res.status(404).json({ success: false, error: 'Unknown passkey endpoint' });
};
