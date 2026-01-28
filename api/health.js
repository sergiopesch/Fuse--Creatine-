/**
 * Health check endpoint for debugging API configuration
 * Returns diagnostic information about the chat service configuration
 */

const { getCorsOrigin, setSecurityHeaders } = require('./_lib/security');

/**
 * Main handler
 */
module.exports = async (req, res) => {
    const requestHost = Array.isArray(req.headers['x-forwarded-host'])
        ? req.headers['x-forwarded-host'][0]
        : req.headers['x-forwarded-host'] || req.headers.host || '';
    const origin = getCorsOrigin(req.headers.origin, requestHost);
    setSecurityHeaders(res, origin, 'GET, OPTIONS');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED',
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
            model: 'claude-3-5-haiku-latest',
        },
        apiKey: {
            exists: 'ANTHROPIC_API_KEY' in process.env,
            hasValue: !!apiKey,
            hasTrimmedValue: !!trimmedKey,
            validFormat: trimmedKey?.startsWith('sk-ant-') || false,
        },
        blobStorage: {
            configured: 'BLOB_READ_WRITE_TOKEN' in process.env,
        },
        encryption: {
            configured: 'ENCRYPTION_KEY' in process.env,
        },
        runtime: {
            nodeVersion: process.version,
            platform: process.platform,
        },
    };

    // Determine overall health status
    if (!diagnostics.apiKey.exists || !diagnostics.apiKey.hasTrimmedValue) {
        diagnostics.status = 'degraded';
        diagnostics.issues = diagnostics.issues || [];
        diagnostics.issues.push(
            'ANTHROPIC_API_KEY is not configured - set it in Vercel Environment Variables'
        );
    }

    if (diagnostics.apiKey.hasTrimmedValue && !diagnostics.apiKey.validFormat) {
        diagnostics.status = 'degraded';
        diagnostics.issues = diagnostics.issues || [];
        diagnostics.issues.push('ANTHROPIC_API_KEY has invalid format (expected sk-ant-* prefix)');
    }

    if (!diagnostics.blobStorage.configured) {
        diagnostics.status = 'degraded';
        diagnostics.issues = diagnostics.issues || [];
        diagnostics.issues.push(
            'BLOB_READ_WRITE_TOKEN is not configured - biometric authentication will not work'
        );
    }

    if (!diagnostics.encryption.configured) {
        diagnostics.status = 'degraded';
        diagnostics.issues = diagnostics.issues || [];
        diagnostics.issues.push(
            'ENCRYPTION_KEY is not configured - biometric session tokens will not work'
        );
    }

    return res.status(200).json(diagnostics);
};
