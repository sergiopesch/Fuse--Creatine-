const {
    authenticate,
    checkRateLimit,
    setSecurityHeaders,
    getCorsOrigin,
    getClientIp,
    getRequestHost,
    addAuditEntry,
    sanitizeString,
} = require('./_lib/security');

const {
    getState,
    advanceLabState,
    refreshPapers,
    resetState,
} = require('./_lib/research-lab-state');

const CONFIG = {
    READ_LIMIT: 90,
    WRITE_LIMIT: 12,
    WINDOW_MS: 60 * 1000,
    MAX_QUERY_LENGTH: 160,
};

function isLocalRequest(req) {
    const host = getRequestHost(req).split(':')[0].toLowerCase();
    return ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host);
}

function getAction(req) {
    if (typeof req.query?.action === 'string') return req.query.action;
    return req.method === 'GET' ? 'state' : 'tick';
}

function canMutate(req, tokenName = 'ADMIN_TOKEN') {
    const expectedToken = process.env[tokenName] || process.env.ADMIN_TOKEN;
    if (!expectedToken) {
        return {
            authenticated: process.env.NODE_ENV !== 'production' && isLocalRequest(req),
            error: 'Research lab mutation token is not configured',
        };
    }
    return authenticate(req, expectedToken);
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
            error: 'Origin not allowed',
            code: 'CORS_ERROR',
        });
    }

    if (!['GET', 'POST'].includes(req.method)) {
        return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    }

    const action = getAction(req);
    const rateLimit = await checkRateLimit(
        `research-lab:${req.method}:${clientIp}`,
        req.method === 'GET' ? CONFIG.READ_LIMIT : CONFIG.WRITE_LIMIT,
        CONFIG.WINDOW_MS
    );

    res.setHeader(
        'X-RateLimit-Limit',
        req.method === 'GET' ? CONFIG.READ_LIMIT : CONFIG.WRITE_LIMIT
    );
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

    if (rateLimit.limited) {
        res.setHeader('Retry-After', Math.ceil(rateLimit.retryAfterMs / 1000));
        return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMITED',
            retryAfter: Math.ceil(rateLimit.retryAfterMs / 1000),
        });
    }

    try {
        if (req.method === 'GET') {
            if (action === 'state') {
                const state = await getState();
                return res.status(200).json({ success: true, data: state });
            }

            if (action === 'papers') {
                const query = sanitizeString(
                    req.query?.q || 'creatine monohydrate coffee solubility',
                    CONFIG.MAX_QUERY_LENGTH
                );
                try {
                    const state = await refreshPapers(query);
                    return res.status(200).json({
                        success: true,
                        data: {
                            query,
                            papers: state.papers,
                            state,
                        },
                    });
                } catch (error) {
                    const state = await getState();
                    return res.status(200).json({
                        success: false,
                        code: 'PAPER_FETCH_FAILED',
                        error: 'Research metadata fetch failed; showing current evidence queue.',
                        detail: error.message,
                        data: {
                            query,
                            papers: state.papers || [],
                            state,
                        },
                    });
                }
            }

            return res.status(400).json({
                error: 'Unknown action',
                code: 'INVALID_ACTION',
                availableActions: ['state', 'papers'],
            });
        }

        if (action === 'tick') {
            const auth = canMutate(req);
            if (!auth.authenticated) {
                addAuditEntry({
                    action: 'RESEARCH_LAB_TICK_AUTH_FAILED',
                    ip: clientIp,
                    success: false,
                    reason: auth.error,
                });
                return res.status(401).json({ error: auth.error, code: 'UNAUTHORIZED' });
            }

            const state = await advanceLabState('manual-api');
            addAuditEntry({
                action: 'RESEARCH_LAB_TICK',
                ip: clientIp,
                success: true,
            });
            return res.status(200).json({ success: true, data: state });
        }

        if (action === 'reset') {
            const auth = canMutate(req);
            if (!auth.authenticated) {
                return res.status(401).json({ error: auth.error, code: 'UNAUTHORIZED' });
            }
            const state = await resetState();
            addAuditEntry({
                action: 'RESEARCH_LAB_RESET',
                ip: clientIp,
                success: true,
            });
            return res.status(200).json({ success: true, data: state });
        }

        return res.status(400).json({
            error: 'Unknown action',
            code: 'INVALID_ACTION',
            availableActions: ['tick', 'reset'],
        });
    } catch (error) {
        console.error('[ResearchLab] API error:', error);
        return res.status(500).json({
            error: 'Research lab service failed',
            code: 'INTERNAL_ERROR',
        });
    }
};
