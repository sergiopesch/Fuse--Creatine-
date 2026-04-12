const registerHandler = require('../lib/vercel/biometric-register');
const authenticateHandler = require('../lib/vercel/biometric-authenticate');

module.exports = (req, res) => {
    const route = req.query?.__fuseRoute;

    if (route === 'register') return registerHandler(req, res);
    if (route === 'authenticate') return authenticateHandler(req, res);

    return res.status(404).json({ success: false, error: 'Unknown biometric endpoint' });
};
