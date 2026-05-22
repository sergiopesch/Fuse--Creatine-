const {
    setSecurityHeaders,
    getCorsOrigin,
    getClientIp,
    getRequestHost,
    addAuditEntry,
} = require('../../api/_lib/security');

const { runDailyDiscovery } = require('../../api/_lib/research-lab-state');

function isAuthorized(req) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        return process.env.VERCEL_ENV !== 'production';
    }
    return req.headers.authorization === `Bearer ${secret}`;
}

module.exports = async (req, res) => {
    const clientIp = getClientIp(req);
    const origin = getCorsOrigin(req.headers.origin, getRequestHost(req));
    setSecurityHeaders(res, origin, 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.headers.origin && !origin) {
        return res.status(403).json({
            success: false,
            error: 'Origin not allowed',
            code: 'CORS_ERROR',
        });
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED',
        });
    }

    if (!isAuthorized(req)) {
        return res.status(401).json({
            success: false,
            error: 'Daily lab discovery requires cron authorization',
            code: 'UNAUTHORIZED',
        });
    }

    try {
        const state = await runDailyDiscovery('daily-cron');
        addAuditEntry({
            action: 'RESEARCH_WORLD_DAILY_DISCOVERY',
            ip: clientIp,
            success: true,
        });
        return res.status(200).json({
            success: true,
            data: {
                labClock: state.labClock,
                labDay: state.labDay,
                dailyDiscovery: state.dailyDiscovery,
            },
        });
    } catch (error) {
        console.error('[ResearchWorldDaily] API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Daily research lab discovery failed',
            code: 'INTERNAL_ERROR',
        });
    }
};
