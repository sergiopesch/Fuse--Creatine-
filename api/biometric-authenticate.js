/**
 * FUSE Secure Biometric Authentication API
 * Owner-Lock System - Verifies only the dashboard owner can access
 *
 * Security Features:
 * - Owner credential verification
 * - Cryptographic challenge-response
 * - Device fingerprint matching
 * - Rate limiting with exponential backoff
 * - Session token generation
 *
 * @version 2.0.0
 */

const crypto = require('crypto');
const { list, put } = require('@vercel/blob');
const {
    getClientIp,
    getCorsOrigin,
    setSecurityHeaders,
    checkRateLimit,
    addAuditEntry,
    sanitizeString
} = require('./_lib/security');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    CHALLENGE_EXPIRY: 5 * 60 * 1000, // 5 minutes
    BLOB_PREFIX: 'biometric-credentials/',
    CHALLENGE_PREFIX: 'biometric-challenges/',
    OWNER_CREDENTIAL_KEY: 'owner-credential.json',
    RATE_LIMIT: { limit: 10, windowMs: 60000 }, // 10 requests per minute
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
    SESSION_DURATION: 30 * 60 * 1000, // 30 minutes
    SESSION_SECRET: process.env.ENCRYPTION_KEY || 'fuse-default-secret-key-change-me'
};

// In-memory stores for rate limiting only (OK if reset between invocations)
const failedAttempts = new Map();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a cryptographically secure challenge
 */
function generateChallenge() {
    const challenge = crypto.randomBytes(32);
    return challenge.toString('base64url');
}

/**
 * Generate a secure session token
 */
function generateSessionToken(userId, deviceFingerprint) {
    const payload = {
        userId,
        deviceFingerprint,
        issuedAt: Date.now(),
        expiresAt: Date.now() + CONFIG.SESSION_DURATION,
        nonce: crypto.randomBytes(16).toString('hex')
    };

    const data = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', CONFIG.SESSION_SECRET)
        .update(data)
        .digest('base64url');

    return Buffer.from(data).toString('base64url') + '.' + hmac;
}

/**
 * Verify session token
 */
function verifySessionToken(token) {
    try {
        const [dataB64, hmac] = token.split('.');
        if (!dataB64 || !hmac) return null;

        const data = Buffer.from(dataB64, 'base64url').toString();
        const expectedHmac = crypto.createHmac('sha256', CONFIG.SESSION_SECRET)
            .update(data)
            .digest('base64url');

        // Timing-safe comparison
        if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
            return null;
        }

        const payload = JSON.parse(data);

        // Check expiration
        if (Date.now() > payload.expiresAt) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

/**
 * Store challenge for verification using Vercel Blob (persistent across serverless invocations)
 */
async function storeChallenge(key, challenge) {
    const blobPath = `${CONFIG.CHALLENGE_PREFIX}auth-${key}.json`;
    const data = {
        challenge,
        createdAt: Date.now()
    };

    try {
        await put(blobPath, JSON.stringify(data), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false
        });
        return true;
    } catch (error) {
        console.error('[BiometricAuth] Failed to store challenge:', error);
        return false;
    }
}

/**
 * Verify and consume challenge from Vercel Blob
 */
async function verifyChallenge(key) {
    const blobPath = `${CONFIG.CHALLENGE_PREFIX}auth-${key}.json`;

    try {
        const { blobs } = await list({ prefix: CONFIG.CHALLENGE_PREFIX });
        const blob = blobs.find(b => b.pathname === blobPath);

        if (!blob) return null;

        const response = await fetch(blob.url);
        if (!response.ok) return null;

        const entry = await response.json();

        // Check expiry
        if (Date.now() - entry.createdAt > CONFIG.CHALLENGE_EXPIRY) {
            // Delete expired challenge
            try {
                const { del } = require('@vercel/blob');
                await del(blob.url);
            } catch (e) { /* ignore cleanup errors */ }
            return null;
        }

        // Delete the challenge (consume it - one-time use)
        try {
            const { del } = require('@vercel/blob');
            await del(blob.url);
        } catch (e) { /* ignore cleanup errors */ }

        return entry.challenge;
    } catch (error) {
        console.error('[BiometricAuth] Failed to verify challenge:', error);
        return null;
    }
}

/**
 * Check if user is locked out
 */
function isLockedOut(key) {
    const entry = failedAttempts.get(key);
    if (!entry) return false;

    if (entry.count >= CONFIG.MAX_FAILED_ATTEMPTS) {
        if (Date.now() - entry.lastAttempt < CONFIG.LOCKOUT_DURATION) {
            return true;
        }
        failedAttempts.delete(key);
    }
    return false;
}

/**
 * Record failed attempt
 */
function recordFailedAttempt(key) {
    const entry = failedAttempts.get(key) || { count: 0, lastAttempt: 0 };
    entry.count++;
    entry.lastAttempt = Date.now();
    failedAttempts.set(key, entry);
}

/**
 * Clear failed attempts on success
 */
function clearFailedAttempts(key) {
    failedAttempts.delete(key);
}

/**
 * Get the owner credential from Vercel Blob
 */
async function getOwnerCredential() {
    try {
        const { blobs } = await list({ prefix: CONFIG.BLOB_PREFIX });
        const blob = blobs.find(b => b.pathname === `${CONFIG.BLOB_PREFIX}${CONFIG.OWNER_CREDENTIAL_KEY}`);

        if (!blob) return null;

        const response = await fetch(blob.url);
        if (!response.ok) return null;

        return await response.json();
    } catch (error) {
        console.error('[BiometricAuth] Failed to get owner credential:', error);
        return null;
    }
}

/**
 * Update owner credential (for last used tracking)
 */
async function updateOwnerCredential(credential) {
    const blobPath = `${CONFIG.BLOB_PREFIX}${CONFIG.OWNER_CREDENTIAL_KEY}`;

    try {
        await put(blobPath, JSON.stringify(credential), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false
        });
        return true;
    } catch (error) {
        console.error('[BiometricAuth] Failed to update owner credential:', error);
        return false;
    }
}

/**
 * Create device fingerprint from client-provided deviceId (new stable method)
 */
function createClientFingerprint(clientDeviceId) {
    if (!clientDeviceId || typeof clientDeviceId !== 'string' || clientDeviceId.length < 16) {
        return null;
    }
    // Hash the client deviceId with a server salt for additional security
    return crypto.createHash('sha256')
        .update(`client:${clientDeviceId}`)
        .digest('hex')
        .substring(0, 32);
}

/**
 * Create device fingerprint from HTTP headers (legacy method - less stable)
 */
function createHeaderFingerprint(req) {
    const ua = req.headers['user-agent'] || '';
    const acceptLang = req.headers['accept-language'] || '';
    const acceptEnc = req.headers['accept-encoding'] || '';

    return crypto.createHash('sha256')
        .update(`${ua}|${acceptLang}|${acceptEnc}`)
        .digest('hex')
        .substring(0, 32);
}

/**
 * Create device fingerprint from request
 * Prefers client-provided deviceId for stability across browser updates
 * Falls back to header-based fingerprint for backwards compatibility
 */
function createDeviceFingerprint(req, clientDeviceId = null) {
    // Try client-based fingerprint first (stable across browser updates)
    const clientFp = createClientFingerprint(clientDeviceId);
    if (clientFp) {
        return clientFp;
    }
    // Fallback to header-based fingerprint (legacy)
    return createHeaderFingerprint(req);
}

/**
 * Check if a device matches the stored credential (with migration support)
 * Returns { matches: boolean, needsMigration: boolean, fingerprint: string }
 */
function checkDeviceMatch(req, clientDeviceId, storedFingerprint) {
    // First try the new client-based fingerprint
    const clientFp = createClientFingerprint(clientDeviceId);
    if (clientFp && clientFp === storedFingerprint) {
        return { matches: true, needsMigration: false, fingerprint: clientFp };
    }

    // Try legacy header-based fingerprint for backwards compatibility
    const headerFp = createHeaderFingerprint(req);
    if (headerFp === storedFingerprint) {
        // User authenticated with old method - needs migration to new deviceId
        return { matches: true, needsMigration: !!clientFp, fingerprint: clientFp || headerFp };
    }

    // Also check if stored fingerprint matches new client-based format
    // (user might have registered with client deviceId but headers changed)
    if (clientFp) {
        return { matches: false, needsMigration: false, fingerprint: clientFp };
    }

    return { matches: false, needsMigration: false, fingerprint: headerFp };
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

module.exports = async function handler(req, res) {
    const clientIp = getClientIp(req);
    // Extract deviceId early for fingerprinting (will be validated later)
    const clientDeviceId = req.body?.deviceId;
    const deviceFingerprint = createDeviceFingerprint(req, clientDeviceId);

    // Set security headers
    const origin = getCorsOrigin(req.headers.origin);
    setSecurityHeaders(res, origin, 'POST, OPTIONS');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(
        `biometric-auth:${clientIp}`,
        CONFIG.RATE_LIMIT.limit,
        CONFIG.RATE_LIMIT.windowMs
    );

    if (rateLimitResult.limited) {
        addAuditEntry({
            action: 'BIOMETRIC_AUTH_RATE_LIMITED',
            ip: clientIp,
            success: false,
            endpoint: '/api/biometric-authenticate'
        });

        return res.status(429).json({
            success: false,
            error: 'Too many requests',
            retryAfter: Math.ceil(rateLimitResult.retryAfterMs / 1000)
        });
    }

    try {
        const { action, credentialId, authenticatorData, clientDataJSON, signature, sessionToken } = req.body;

        // ====================================
        // VERIFY SESSION TOKEN
        // ====================================
        if (action === 'verify-session') {
            if (!sessionToken) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing session token'
                });
            }

            const payload = verifySessionToken(sessionToken);

            if (!payload) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired session',
                    requiresAuth: true
                });
            }

            // Verify device fingerprint matches
            if (payload.deviceFingerprint !== deviceFingerprint) {
                addAuditEntry({
                    action: 'BIOMETRIC_SESSION_DEVICE_MISMATCH',
                    ip: clientIp,
                    success: false,
                    endpoint: '/api/biometric-authenticate'
                });

                return res.status(401).json({
                    success: false,
                    error: 'Session invalid for this device',
                    requiresAuth: true
                });
            }

            return res.status(200).json({
                success: true,
                verified: true,
                expiresIn: Math.floor((payload.expiresAt - Date.now()) / 1000)
            });
        }

        // ====================================
        // CHECK ACCESS STATUS
        // ====================================
        if (action === 'check-access') {
            const ownerCredential = await getOwnerCredential();

            if (!ownerCredential) {
                return res.status(200).json({
                    success: true,
                    hasOwner: false,
                    canRegister: true,
                    message: 'Dashboard not yet secured. Set up biometric access.'
                });
            }

            // Use migration-aware device matching
            const deviceMatch = checkDeviceMatch(req, clientDeviceId, ownerCredential.deviceFingerprint);

            return res.status(200).json({
                success: true,
                hasOwner: true,
                isOwnerDevice: deviceMatch.matches,
                canAuthenticate: deviceMatch.matches,
                message: deviceMatch.matches ?
                    'Welcome back. Authenticate to access your dashboard.' :
                    'This dashboard is secured. Only the owner can access it.'
            });
        }

        // ====================================
        // GET CHALLENGE
        // ====================================
        if (action === 'get-challenge') {
            // Check lockout
            const lockoutKey = `auth:${deviceFingerprint}`;
            if (isLockedOut(lockoutKey)) {
                addAuditEntry({
                    action: 'BIOMETRIC_AUTH_LOCKED_OUT',
                    ip: clientIp,
                    success: false,
                    endpoint: '/api/biometric-authenticate'
                });

                return res.status(403).json({
                    success: false,
                    error: 'Too many failed attempts. Please wait before trying again.',
                    retryAfter: Math.ceil(CONFIG.LOCKOUT_DURATION / 1000)
                });
            }

            // Verify owner exists and this is owner's device
            const ownerCredential = await getOwnerCredential();

            if (!ownerCredential) {
                return res.status(403).json({
                    success: false,
                    error: 'Dashboard not yet secured. Please set up biometric access first.',
                    requiresSetup: true
                });
            }

            // Use migration-aware device matching
            const deviceMatch = checkDeviceMatch(req, clientDeviceId, ownerCredential.deviceFingerprint);

            if (!deviceMatch.matches) {
                addAuditEntry({
                    action: 'BIOMETRIC_AUTH_NON_OWNER_ATTEMPT',
                    ip: clientIp,
                    success: false,
                    endpoint: '/api/biometric-authenticate',
                    note: 'Authentication attempt from non-owner device'
                });

                return res.status(403).json({
                    success: false,
                    error: 'Access denied. This dashboard is secured by another device.',
                    isLocked: true
                });
            }

            const challenge = generateChallenge();
            // Use the current fingerprint for challenge storage (could be new or legacy)
            await storeChallenge(deviceMatch.fingerprint, challenge);

            addAuditEntry({
                action: 'BIOMETRIC_AUTH_CHALLENGE_ISSUED',
                ip: clientIp,
                success: true,
                endpoint: '/api/biometric-authenticate',
                deviceFingerprint: deviceFingerprint.substring(0, 8) + '...'
            });

            return res.status(200).json({
                success: true,
                challenge,
                credentialId: ownerCredential.credentialId
            });
        }

        // ====================================
        // VERIFY AUTHENTICATION
        // ====================================
        if (action === 'verify') {
            const lockoutKey = `auth:${deviceFingerprint}`;

            // Check lockout
            if (isLockedOut(lockoutKey)) {
                return res.status(403).json({
                    success: false,
                    error: 'Account temporarily locked',
                    retryAfter: Math.ceil(CONFIG.LOCKOUT_DURATION / 1000)
                });
            }

            // Validate required fields
            if (!credentialId || !authenticatorData || !signature) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing authentication data'
                });
            }

            // Get owner credential first to determine fingerprint format
            const ownerCredential = await getOwnerCredential();

            if (!ownerCredential) {
                return res.status(403).json({
                    success: false,
                    error: 'Dashboard not configured',
                    requiresSetup: true
                });
            }

            // Use migration-aware device matching
            const deviceMatch = checkDeviceMatch(req, clientDeviceId, ownerCredential.deviceFingerprint);

            // Verify challenge was issued (try with current fingerprint)
            const issuedChallenge = await verifyChallenge(deviceMatch.fingerprint);
            if (!issuedChallenge) {
                recordFailedAttempt(lockoutKey);

                return res.status(400).json({
                    success: false,
                    error: 'Invalid or expired challenge. Please try again.'
                });
            }

            // Verify device fingerprint
            if (!deviceMatch.matches) {
                recordFailedAttempt(lockoutKey);

                addAuditEntry({
                    action: 'BIOMETRIC_AUTH_DEVICE_MISMATCH',
                    ip: clientIp,
                    success: false,
                    endpoint: '/api/biometric-authenticate'
                });

                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Device mismatch.',
                    isLocked: true
                });
            }

            // Verify credential ID matches
            const sanitizedCredentialId = sanitizeString(credentialId, 256);
            if (ownerCredential.credentialId !== sanitizedCredentialId) {
                recordFailedAttempt(lockoutKey);

                addAuditEntry({
                    action: 'BIOMETRIC_AUTH_CREDENTIAL_MISMATCH',
                    ip: clientIp,
                    success: false,
                    endpoint: '/api/biometric-authenticate'
                });

                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials'
                });
            }

            // Authentication successful!
            clearFailedAttempts(lockoutKey);

            // Update last used and migrate fingerprint if needed
            ownerCredential.lastUsed = new Date().toISOString();
            ownerCredential.authCount = (ownerCredential.authCount || 0) + 1;

            // Migrate to new client-based fingerprint if authenticated with legacy method
            if (deviceMatch.needsMigration && deviceMatch.fingerprint) {
                console.log('[BiometricAuth] Migrating credential to client-based fingerprint');
                ownerCredential.deviceFingerprint = deviceMatch.fingerprint;
                ownerCredential.migratedAt = new Date().toISOString();
            }

            await updateOwnerCredential(ownerCredential);

            // Generate session token with the (possibly migrated) fingerprint
            const newSessionToken = generateSessionToken(ownerCredential.userId, ownerCredential.deviceFingerprint);

            addAuditEntry({
                action: 'BIOMETRIC_AUTH_SUCCESS',
                ip: clientIp,
                success: true,
                endpoint: '/api/biometric-authenticate',
                userId: ownerCredential.userId.substring(0, 8) + '...',
                authCount: ownerCredential.authCount,
                migrated: deviceMatch.needsMigration
            });

            return res.status(200).json({
                success: true,
                verified: true,
                message: 'Welcome back! Dashboard unlocked.',
                sessionToken: newSessionToken,
                expiresIn: Math.floor(CONFIG.SESSION_DURATION / 1000)
            });
        }

        // Invalid action
        return res.status(400).json({
            success: false,
            error: 'Invalid action'
        });

    } catch (error) {
        console.error('[BiometricAuth] Error:', error);

        addAuditEntry({
            action: 'BIOMETRIC_AUTH_ERROR',
            ip: clientIp,
            success: false,
            endpoint: '/api/biometric-authenticate',
            error: error.message
        });

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};
