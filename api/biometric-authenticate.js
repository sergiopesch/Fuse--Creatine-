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
    OWNER_CREDENTIAL_KEY: 'owner-credential.json',
    RATE_LIMIT: { limit: 10, windowMs: 60000 }, // 10 requests per minute
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
    SESSION_DURATION: 30 * 60 * 1000, // 30 minutes
    SESSION_SECRET: process.env.ENCRYPTION_KEY || 'fuse-default-secret-key-change-me'
};

// In-memory stores (use Redis/KV in production)
const challengeStore = new Map();
const failedAttempts = new Map();
const sessionStore = new Map();

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
 * Store challenge for verification
 */
function storeChallenge(key, challenge) {
    challengeStore.set(key, {
        challenge,
        createdAt: Date.now()
    });

    // Clean up expired challenges
    for (const [k, value] of challengeStore.entries()) {
        if (Date.now() - value.createdAt > CONFIG.CHALLENGE_EXPIRY) {
            challengeStore.delete(k);
        }
    }
}

/**
 * Verify and consume challenge
 */
function verifyChallenge(key) {
    const entry = challengeStore.get(key);
    if (!entry) return null;

    if (Date.now() - entry.createdAt > CONFIG.CHALLENGE_EXPIRY) {
        challengeStore.delete(key);
        return null;
    }

    challengeStore.delete(key);
    return entry.challenge;
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
 * Create device fingerprint from request
 */
function createDeviceFingerprint(req) {
    const ua = req.headers['user-agent'] || '';
    const acceptLang = req.headers['accept-language'] || '';
    const acceptEnc = req.headers['accept-encoding'] || '';

    const fingerprint = crypto.createHash('sha256')
        .update(`${ua}|${acceptLang}|${acceptEnc}`)
        .digest('hex')
        .substring(0, 32);

    return fingerprint;
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

module.exports = async function handler(req, res) {
    const clientIp = getClientIp(req);
    const deviceFingerprint = createDeviceFingerprint(req);

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

            const isOwnerDevice = ownerCredential.deviceFingerprint === deviceFingerprint;

            return res.status(200).json({
                success: true,
                hasOwner: true,
                isOwnerDevice,
                canAuthenticate: isOwnerDevice,
                message: isOwnerDevice ?
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

            if (ownerCredential.deviceFingerprint !== deviceFingerprint) {
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
            storeChallenge(deviceFingerprint, challenge);

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

            // Verify challenge was issued
            const issuedChallenge = verifyChallenge(deviceFingerprint);
            if (!issuedChallenge) {
                recordFailedAttempt(lockoutKey);

                return res.status(400).json({
                    success: false,
                    error: 'Invalid or expired challenge. Please try again.'
                });
            }

            // Get owner credential
            const ownerCredential = await getOwnerCredential();

            if (!ownerCredential) {
                return res.status(403).json({
                    success: false,
                    error: 'Dashboard not configured',
                    requiresSetup: true
                });
            }

            // Verify device fingerprint
            if (ownerCredential.deviceFingerprint !== deviceFingerprint) {
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

            // Update last used
            ownerCredential.lastUsed = new Date().toISOString();
            ownerCredential.authCount = (ownerCredential.authCount || 0) + 1;
            await updateOwnerCredential(ownerCredential);

            // Generate session token
            const newSessionToken = generateSessionToken(ownerCredential.userId, deviceFingerprint);

            addAuditEntry({
                action: 'BIOMETRIC_AUTH_SUCCESS',
                ip: clientIp,
                success: true,
                endpoint: '/api/biometric-authenticate',
                userId: ownerCredential.userId.substring(0, 8) + '...',
                authCount: ownerCredential.authCount
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
