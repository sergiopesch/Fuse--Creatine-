const {
    checkRateLimit,
    setSecurityHeaders,
    getCorsOrigin,
    getClientIp,
    getRequestHost,
    addAuditEntry,
} = require('../../api/_lib/security');

const { getState, advanceLabState, resetState } = require('../../api/_lib/research-lab-state');

const CONFIG = {
    READ_LIMIT: 120,
    WRITE_LIMIT: 40,
    WINDOW_MS: 60 * 1000,
};

function getAction(req) {
    if (typeof req.query?.action === 'string') return req.query.action;
    if (req.body && typeof req.body.action === 'string') return req.body.action;
    return req.method === 'GET' ? 'state' : 'tick';
}

module.exports = async (req, res) => {
    const clientIp = getClientIp(req);
    const origin = getCorsOrigin(req.headers.origin, getRequestHost(req));
    setSecurityHeaders(res, origin, 'GET, POST, OPTIONS');

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

    if (!['GET', 'POST'].includes(req.method)) {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED',
        });
    }

    const limit = req.method === 'GET' ? CONFIG.READ_LIMIT : CONFIG.WRITE_LIMIT;
    const rateLimit = await checkRateLimit(
        `research-world:${req.method}:${clientIp}`,
        limit,
        CONFIG.WINDOW_MS
    );

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

    if (rateLimit.limited) {
        res.setHeader('Retry-After', Math.ceil(rateLimit.retryAfterMs / 1000));
        return res.status(429).json({
            success: false,
            error: 'Too many research world requests',
            code: 'RATE_LIMITED',
            retryAfter: Math.ceil(rateLimit.retryAfterMs / 1000),
        });
    }

    try {
        const action = getAction(req);

        if (req.method === 'GET') {
            if (action !== 'state') {
                return res.status(400).json({
                    success: false,
                    error: 'Unknown action',
                    code: 'INVALID_ACTION',
                    availableActions: ['state'],
                });
            }
            const state = await getState();
            return res.status(200).json({ success: true, data: state });
        }

        if (action === 'tick') {
            const state = await advanceLabState('browser-world');
            addAuditEntry({
                action: 'RESEARCH_WORLD_TICK',
                ip: clientIp,
                success: true,
            });
            return res.status(200).json({ success: true, data: state });
        }

        if (action === 'reset') {
            const state = await resetState();
            addAuditEntry({
                action: 'RESEARCH_WORLD_RESET',
                ip: clientIp,
                success: true,
            });
            return res.status(200).json({ success: true, data: state });
        }

        return res.status(400).json({
            success: false,
            error: 'Unknown action',
            code: 'INVALID_ACTION',
            availableActions: ['tick', 'reset'],
        });
    } catch (error) {
        console.error('[ResearchWorld] API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Research lab world failed',
            code: 'INTERNAL_ERROR',
        });
    }
};
