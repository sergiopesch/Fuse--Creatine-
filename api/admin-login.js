const {
    setSecurityHeaders,
    getCorsOrigin,
    getClientIp,
    getRequestHost,
    addAuditEntry,
} = require('./_lib/security');
const { getAdminUsername } = require('./_lib/admin-auth');

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

    if (req.method === 'GET') {
        return res.status(200).json({
            success: true,
            data: {
                username: getAdminUsername(),
                passwordConfigured: Boolean(process.env.ADMIN_PASSWORD_HASH),
            },
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED',
        });
    }

    addAuditEntry({
        action: 'ADMIN_PASSWORD_LOGIN_DISABLED',
        ip: clientIp,
        success: false,
    });
    return res.status(410).json({
        success: false,
        error: 'Password login has been replaced by admin passkey login.',
        code: 'PASSKEY_REQUIRED',
    });
};
