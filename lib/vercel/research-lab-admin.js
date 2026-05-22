const {
    setSecurityHeaders,
    getCorsOrigin,
    getClientIp,
    getRequestHost,
    addAuditEntry,
} = require('../../api/_lib/security');
const { authenticateAdminRequest } = require('../../api/_lib/admin-auth');

const {
    getLabAdminState,
    updateLabControls,
    runDailyDiscovery,
    runWeeklyReview,
    advanceLabState,
} = require('../../api/_lib/research-lab-state');

const ALLOWED_ACTIONS = new Set(['update_controls', 'run_tick', 'run_daily', 'run_weekly']);

function getAction(req) {
    if (req.method === 'GET') return 'state';
    return typeof req.body?.action === 'string' ? req.body.action : '';
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

    const auth = authenticateAdminRequest(req);
    if (!auth.authenticated) {
        return res.status(auth.error === 'Authentication not configured' ? 500 : 401).json({
            success: false,
            error: auth.error,
            code: 'UNAUTHORIZED',
        });
    }

    try {
        const action = getAction(req);

        if (req.method === 'GET') {
            return res.status(200).json({
                success: true,
                data: await getLabAdminState(),
            });
        }

        if (!ALLOWED_ACTIONS.has(action)) {
            return res.status(400).json({
                success: false,
                error: 'Unknown lab admin action',
                code: 'INVALID_ACTION',
                availableActions: [...ALLOWED_ACTIONS],
            });
        }

        let state;
        if (action === 'update_controls') {
            state = await updateLabControls(req.body?.controls || {});
        }

        if (action === 'run_tick') {
            state = await advanceLabState('admin-manual-tick');
        }

        if (action === 'run_daily') {
            state = await runDailyDiscovery('admin-manual-daily', { force: true });
        }

        if (action === 'run_weekly') {
            state = await runWeeklyReview('admin-manual-weekly', { force: true });
        }

        addAuditEntry({
            action: `RESEARCH_WORLD_ADMIN_${action.toUpperCase()}`,
            ip: clientIp,
            success: true,
        });

        return res.status(200).json({
            success: true,
            data: await getLabAdminState(state),
        });
    } catch (error) {
        console.error('[ResearchWorldAdmin] API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Research lab admin action failed',
            code: 'INTERNAL_ERROR',
        });
    }
};
