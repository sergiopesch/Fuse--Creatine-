const loginHandler = require('../lib/vercel/admin-login');
const passkeyHandler = require('../lib/vercel/admin-passkey');
const signupsHandler = require('../lib/vercel/admin-signups');
const labAdminHandler = require('../lib/vercel/research-lab-admin');
const labDailyHandler = require('../lib/vercel/research-lab-daily');
const labWeeklyHandler = require('../lib/vercel/research-lab-weekly');

module.exports = (req, res) => {
    const route = req.query?.__fuseRoute;

    if (route === 'login') return loginHandler(req, res);
    if (route === 'passkey') return passkeyHandler(req, res);
    if (route === 'signups') return signupsHandler(req, res);
    if (route === 'lab-admin') return labAdminHandler(req, res);
    if (route === 'lab-daily') return labDailyHandler(req, res);
    if (route === 'lab-weekly') return labWeeklyHandler(req, res);

    return res.status(404).json({ success: false, error: 'Unknown admin endpoint' });
};
