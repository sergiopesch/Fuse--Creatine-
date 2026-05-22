const crypto = require('crypto');
const { getAuthToken, tokensMatch } = require('./security');

const SESSION_PREFIX = 'fuse_admin_session';
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SCRYPT_KEY_LENGTH = 64;

function base64UrlEncode(value) {
    return Buffer.from(value).toString('base64url');
}

function base64UrlJson(value) {
    return base64UrlEncode(JSON.stringify(value));
}

function timingSafeStringEqual(first, second) {
    if (!first || !second) return false;
    const firstBuffer = Buffer.from(first);
    const secondBuffer = Buffer.from(second);
    if (firstBuffer.length !== secondBuffer.length) return false;
    return crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function getAdminUsername() {
    return process.env.ADMIN_USERNAME?.trim() || 'sergiopesch';
}

function getSessionSecret() {
    return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_TOKEN?.trim() || '';
}

function signPayload(encodedPayload, secret) {
    return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function createAdminSession(username) {
    const secret = getSessionSecret();
    if (!secret) {
        throw new Error('Admin session secret is not configured');
    }

    const now = Date.now();
    const payload = {
        sub: username,
        iat: now,
        exp: now + DEFAULT_SESSION_TTL_MS,
        scope: 'admin',
    };
    const encodedPayload = base64UrlJson(payload);
    const signature = signPayload(encodedPayload, secret);
    return `${SESSION_PREFIX}.${encodedPayload}.${signature}`;
}

function verifyAdminSession(token) {
    if (!token || !token.startsWith(`${SESSION_PREFIX}.`)) return false;

    const secret = getSessionSecret();
    if (!secret) return false;

    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [, encodedPayload, signature] = parts;
    const expectedSignature = signPayload(encodedPayload, secret);
    if (!timingSafeStringEqual(signature, expectedSignature)) return false;

    try {
        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
        return (
            payload.scope === 'admin' &&
            payload.sub === getAdminUsername() &&
            Number(payload.exp || 0) > Date.now()
        );
    } catch (_error) {
        return false;
    }
}

function verifyPasswordHash(password, storedHash) {
    if (!password || !storedHash) return false;
    const parts = storedHash.split('$');
    if (parts.length !== 5 || parts[0] !== 'scrypt') return false;

    const [, costRaw, blockSizeRaw, salt, expectedHex] = parts;
    const cost = Number(costRaw);
    const blockSize = Number(blockSizeRaw);
    if (!Number.isFinite(cost) || !Number.isFinite(blockSize) || !salt || !expectedHex) {
        return false;
    }

    const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
        N: cost,
        r: blockSize,
        p: 1,
    });
    return timingSafeStringEqual(derived.toString('hex'), expectedHex);
}

function generatePasswordHash(password) {
    const salt = crypto.randomBytes(16).toString('base64url');
    const cost = 16384;
    const blockSize = 8;
    const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
        N: cost,
        r: blockSize,
        p: 1,
    });
    return `scrypt$${cost}$${blockSize}$${salt}$${derived.toString('hex')}`;
}

function verifyAdminCredentials(username, password) {
    const expectedUsername = getAdminUsername();
    const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim() || '';

    if (!passwordHash) {
        return { ok: false, error: 'Admin password login is not configured' };
    }

    if (!timingSafeStringEqual(String(username || '').trim(), expectedUsername)) {
        return { ok: false, error: 'Invalid username or password' };
    }

    if (!verifyPasswordHash(String(password || ''), passwordHash)) {
        return { ok: false, error: 'Invalid username or password' };
    }

    return { ok: true, username: expectedUsername };
}

function authenticateAdminRequest(req) {
    const provided = getAuthToken(req);
    if (!provided) {
        return { authenticated: false, error: 'Authorization token required' };
    }

    if (verifyAdminSession(provided)) {
        return { authenticated: true, method: 'session' };
    }

    const adminToken = process.env.ADMIN_TOKEN;
    if (adminToken && tokensMatch(provided, adminToken)) {
        return { authenticated: true, method: 'admin-token' };
    }

    return { authenticated: false, error: 'Invalid authorization token' };
}

module.exports = {
    createAdminSession,
    verifyAdminSession,
    verifyAdminCredentials,
    authenticateAdminRequest,
    generatePasswordHash,
    getAdminUsername,
};
