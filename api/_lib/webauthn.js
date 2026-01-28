/**
 * WebAuthn helper utilities
 * Shared origin/RP resolution and base64url helpers
 */

const { getCorsOrigin } = require('./security');

/**
 * Convert base64url string to Buffer
 */
function base64urlToBuffer(base64url) {
    if (!base64url || typeof base64url !== 'string') return null;
    const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + padding;
    return Buffer.from(base64, 'base64');
}

/**
 * Convert Buffer or ArrayBuffer to base64url string
 */
function bufferToBase64url(buffer) {
    if (!buffer) return '';
    const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Resolve request host (without protocol)
 */
function getRequestHost(req) {
    const forwardedHost = req.headers['x-forwarded-host'];
    const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
    const fallback = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;
    return host || fallback || '';
}

/**
 * Resolve request protocol
 */
function getRequestProtocol(req) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    if (forwardedProto) {
        const value = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
        return value.split(',')[0].trim();
    }

    const host = getRequestHost(req);
    if (/^localhost(:\d+)?$/i.test(host) || /^127\.0\.0\.1(:\d+)?$/.test(host)) {
        return 'http';
    }

    return 'https';
}

/**
 * Build expected origins for WebAuthn verification
 */
function getExpectedOrigins(req) {
    const origins = new Set();
    const requestOrigin = Array.isArray(req.headers.origin)
        ? req.headers.origin[0]
        : req.headers.origin;
    const corsOrigin = getCorsOrigin(requestOrigin, getRequestHost(req));

    if (corsOrigin) origins.add(corsOrigin);

    const host = getRequestHost(req);
    if (host) {
        const protocol = getRequestProtocol(req);
        origins.add(`${protocol}://${host}`);
    }

    if (process.env.WEBAUTHN_ORIGINS) {
        process.env.WEBAUTHN_ORIGINS.split(',')
            .map(origin => origin.trim())
            .filter(Boolean)
            .forEach(origin => origins.add(origin));
    }

    return Array.from(origins);
}

/**
 * Build expected RP IDs for WebAuthn verification
 */
function getExpectedRpIds(req) {
    const rpIds = new Set();
    if (process.env.WEBAUTHN_RP_ID) {
        process.env.WEBAUTHN_RP_ID.split(',')
            .map(rpId => rpId.trim())
            .filter(Boolean)
            .forEach(rpId => rpIds.add(rpId));
    }

    const host = getRequestHost(req);
    if (!host) return Array.from(rpIds);

    const hostname = host.split(':')[0];
    if (hostname) rpIds.add(hostname);

    return Array.from(rpIds);
}

module.exports = {
    base64urlToBuffer,
    bufferToBase64url,
    getExpectedOrigins,
    getExpectedRpIds,
};
