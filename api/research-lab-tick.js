const {
    authenticate,
    setSecurityHeaders,
    getCorsOrigin,
    getClientIp,
    getRequestHost,
    addAuditEntry,
} = require('./_lib/security');

const { advanceLabState } = require('./_lib/research-lab-state');

function isLocalRequest(req) {
    const host = getRequestHost(req).split(':')[0].toLowerCase();
    return ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host);
}

function canRunCron(req) {
    const expectedToken = process.env.CRON_SECRET || process.env.ADMIN_TOKEN;
    if (!expectedToken) {
        return {
            authenticated: process.env.NODE_ENV !== 'production' && isLocalRequest(req),
            error: 'CRON_SECRET is not configured',
        };
    }
    return authenticate(req, expectedToken);
}

module.exports = async (req, res) => {
    const origin = getCorsOrigin(req.headers.origin, getRequestHost(req));
    const clientIp = getClientIp(req);
    setSecurityHeaders(res, origin, 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.headers.origin && !origin) {
        return res.status(403).json({ error: 'Origin not allowed', code: 'CORS_ERROR' });
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    }

    const auth = canRunCron(req);
    if (!auth.authenticated) {
        addAuditEntry({
            action: 'RESEARCH_LAB_CRON_AUTH_FAILED',
            ip: clientIp,
            success: false,
            reason: auth.error,
        });
        return res.status(401).json({ error: auth.error, code: 'UNAUTHORIZED' });
    }

    try {
        const state = await advanceLabState('vercel-cron');
        addAuditEntry({
            action: 'RESEARCH_LAB_CRON_TICK',
            ip: clientIp,
            success: true,
        });
        return res.status(200).json({ success: true, data: state });
    } catch (error) {
        console.error('[ResearchLab] cron tick failed:', error);
        return res.status(500).json({ error: 'Research lab cron failed', code: 'INTERNAL_ERROR' });
    }
};
