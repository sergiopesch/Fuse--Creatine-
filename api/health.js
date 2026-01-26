/**
 * Health check endpoint for debugging API configuration
 * Returns diagnostic information about the chat service configuration
 */

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://fuse-creatine.vercel.app',
    'https://www.fusecreatine.com',
    'https://fusecreatine.com',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

/**
 * Get CORS origin
 */
function getCorsOrigin(requestOrigin) {
    if (!requestOrigin) return ALLOWED_ORIGINS[0];
    if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
    if (requestOrigin.endsWith('.vercel.app')) return requestOrigin;
    return ALLOWED_ORIGINS[0];
}

/**
 * Set security headers
 */
function setSecurityHeaders(res, origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
}

/**
 * Main handler
 */
module.exports = async (req, res) => {
    const origin = getCorsOrigin(req.headers.origin);
    setSecurityHeaders(res, origin);

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
        });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const trimmedKey = apiKey?.trim();

    const diagnostics = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
        service: {
            name: 'FUSE Chat Agent',
            version: '1.0.0',
            model: 'claude-3-5-haiku-latest'
        },
        apiKey: {
            exists: 'ANTHROPIC_API_KEY' in process.env,
            hasValue: !!apiKey,
            hasTrimmedValue: !!trimmedKey,
            validFormat: trimmedKey?.startsWith('sk-ant-') || false
        },
        blobStorage: {
            configured: 'BLOB_READ_WRITE_TOKEN' in process.env
        },
        encryption: {
            configured: 'ENCRYPTION_KEY' in process.env
        },
        runtime: {
            nodeVersion: process.version,
            platform: process.platform
        }
    };

    // Determine overall health status
    if (!diagnostics.apiKey.exists || !diagnostics.apiKey.hasTrimmedValue) {
        diagnostics.status = 'degraded';
        diagnostics.issues = diagnostics.issues || [];
        diagnostics.issues.push('ANTHROPIC_API_KEY is not configured - set it in Vercel Environment Variables');
    }

    if (diagnostics.apiKey.hasTrimmedValue && !diagnostics.apiKey.validFormat) {
        diagnostics.status = 'degraded';
        diagnostics.issues = diagnostics.issues || [];
        diagnostics.issues.push('ANTHROPIC_API_KEY has invalid format (expected sk-ant-* prefix)');
    }

    return res.status(200).json(diagnostics);
};
