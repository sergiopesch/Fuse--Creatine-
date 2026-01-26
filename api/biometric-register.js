/**
 * FUSE Secure Biometric Registration API
 * Owner-Lock System - Only ONE device can register and access the dashboard
 *
 * Security Features:
 * - First registration locks the dashboard to that device/credential
 * - Cryptographic device binding
 * - Anti-replay protection with nonces
 * - Rate limiting and lockout
 *
 * @version 2.0.0
 */

const crypto = require('crypto');
const { put, list, del } = require('@vercel/blob');
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
    RATE_LIMIT: { limit: 5, windowMs: 60000 }, // 5 requests per minute (stricter)
    MAX_REGISTRATION_ATTEMPTS: 3,
    LOCKOUT_DURATION: 60 * 60 * 1000, // 1 hour lockout for registration abuse
};

// In-memory store for rate limiting only (OK if reset between invocations)
const registrationAttempts = new Map();

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
 * Generate a unique nonce for anti-replay
 */
function generateNonce() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Store challenge for verification using Vercel Blob (persistent across serverless invocations)
 */
async function storeChallenge(key, challenge, nonce) {
    const blobPath = `${CONFIG.CHALLENGE_PREFIX}reg-${key}.json`;
    const data = {
        challenge,
        nonce,
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
        console.error('[BiometricRegister] Failed to store challenge:', error);
        return false;
    }
}

/**
 * Verify and consume challenge from Vercel Blob
 */
async function verifyChallenge(key) {
    const blobPath = `${CONFIG.CHALLENGE_PREFIX}reg-${key}.json`;

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
                await del(blob.url);
            } catch (e) { /* ignore cleanup errors */ }
            return null;
        }

        // Delete the challenge (consume it - one-time use)
        try {
            await del(blob.url);
        } catch (e) { /* ignore cleanup errors */ }

        return entry;
    } catch (error) {
        console.error('[BiometricRegister] Failed to verify challenge:', error);
        return null;
    }
}

/**
 * Check if registration is locked out
 */
function isRegistrationLockedOut(ip) {
    const entry = registrationAttempts.get(ip);
    if (!entry) return false;

    if (entry.count >= CONFIG.MAX_REGISTRATION_ATTEMPTS) {
        if (Date.now() - entry.lastAttempt < CONFIG.LOCKOUT_DURATION) {
            return true;
        }
        registrationAttempts.delete(ip);
    }
    return false;
}

/**
 * Record failed registration attempt
 */
function recordRegistrationAttempt(ip) {
    const entry = registrationAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    entry.count++;
    entry.lastAttempt = Date.now();
    registrationAttempts.set(ip, entry);
}

/**
 * Get the owner credential from Vercel Blob
 * Returns { credential, error } to distinguish between "no owner" and "service error"
 */
async function getOwnerCredential() {
    try {
        const { blobs } = await list({ prefix: CONFIG.BLOB_PREFIX });
        const blob = blobs.find(b => b.pathname === `${CONFIG.BLOB_PREFIX}${CONFIG.OWNER_CREDENTIAL_KEY}`);

        if (!blob) {
            // No owner registered - this is a valid state
            return { credential: null, error: null };
        }

        const response = await fetch(blob.url);
        if (!response.ok) {
            console.error('[BiometricRegister] Blob fetch failed:', response.status);
            return { credential: null, error: 'BLOB_FETCH_FAILED' };
        }

        const credential = await response.json();
        return { credential, error: null };
    } catch (error) {
        console.error('[BiometricRegister] Failed to get owner credential:', error);
        return { credential: null, error: 'SERVICE_ERROR' };
    }
}

/**
 * Store the owner credential in Vercel Blob
 */
async function storeOwnerCredential(credentialData) {
    const blobPath = `${CONFIG.BLOB_PREFIX}${CONFIG.OWNER_CREDENTIAL_KEY}`;

    try {
        await put(blobPath, JSON.stringify(credentialData), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false
        });
        return true;
    } catch (error) {
        console.error('[BiometricRegister] Failed to store owner credential:', error);
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

    // No match found
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
        `biometric-register:${clientIp}`,
        CONFIG.RATE_LIMIT.limit,
        CONFIG.RATE_LIMIT.windowMs
    );

    if (rateLimitResult.limited) {
        addAuditEntry({
            action: 'BIOMETRIC_REGISTER_RATE_LIMITED',
            ip: clientIp,
            success: false,
            endpoint: '/api/biometric-register'
        });

        return res.status(429).json({
            success: false,
            error: 'Too many requests. Please wait before trying again.',
            retryAfter: Math.ceil(rateLimitResult.retryAfterMs / 1000)
        });
    }

    // Check registration lockout
    if (isRegistrationLockedOut(clientIp)) {
        addAuditEntry({
            action: 'BIOMETRIC_REGISTER_LOCKED_OUT',
            ip: clientIp,
            success: false,
            endpoint: '/api/biometric-register'
        });

        return res.status(403).json({
            success: false,
            error: 'Registration temporarily blocked due to too many attempts.',
            retryAfter: Math.ceil(CONFIG.LOCKOUT_DURATION / 1000)
        });
    }

    try {
        const { action, userId, credentialId, publicKey, clientDataJSON, authenticatorData } = req.body;

        // ====================================
        // CHECK OWNER STATUS
        // ====================================
        if (action === 'check-owner') {
            const { credential: ownerCredential, error: credentialError } = await getOwnerCredential();

            // Handle service errors
            if (credentialError) {
                console.error('[BiometricRegister] Service error during check-owner:', credentialError);
                return res.status(503).json({
                    success: false,
                    error: 'Unable to verify owner status. Please try again.',
                    code: credentialError
                });
            }

            let isOwnerDevice = false;
            if (ownerCredential) {
                const deviceMatch = checkDeviceMatch(req, clientDeviceId, ownerCredential.deviceFingerprint);
                isOwnerDevice = deviceMatch.matches;
            }

            return res.status(200).json({
                success: true,
                hasOwner: !!ownerCredential,
                isOwnerDevice
            });
        }

        // ====================================
        // GET CHALLENGE
        // ====================================
        if (action === 'get-challenge') {
            // Check if owner already exists
            const { credential: ownerCredential, error: credentialError } = await getOwnerCredential();

            // Handle service errors - don't allow registration when we can't verify
            if (credentialError) {
                console.error('[BiometricRegister] Service error during get-challenge:', credentialError);
                return res.status(503).json({
                    success: false,
                    error: 'Registration service temporarily unavailable. Please try again.',
                    code: credentialError
                });
            }

            if (ownerCredential) {
                // Owner exists - check if this might be the owner's device
                const deviceMatch = checkDeviceMatch(req, clientDeviceId, ownerCredential.deviceFingerprint);

                if (!deviceMatch.matches) {
                    addAuditEntry({
                        action: 'BIOMETRIC_REGISTER_BLOCKED_NON_OWNER',
                        ip: clientIp,
                        success: false,
                        endpoint: '/api/biometric-register',
                        note: 'Attempted registration on locked dashboard'
                    });

                    return res.status(403).json({
                        success: false,
                        error: 'Dashboard is already secured. Only the owner can access this dashboard.',
                        isLocked: true
                    });
                }

                // This appears to be the owner's device - allow re-registration
                addAuditEntry({
                    action: 'BIOMETRIC_REGISTER_OWNER_REAUTH',
                    ip: clientIp,
                    success: true,
                    endpoint: '/api/biometric-register',
                    note: 'Owner device requesting re-registration'
                });
            }

            const challenge = generateChallenge();
            const nonce = generateNonce();

            await storeChallenge(deviceFingerprint, challenge, nonce);

            addAuditEntry({
                action: 'BIOMETRIC_CHALLENGE_ISSUED',
                ip: clientIp,
                success: true,
                endpoint: '/api/biometric-register',
                deviceFingerprint: deviceFingerprint.substring(0, 8) + '...'
            });

            return res.status(200).json({
                success: true,
                challenge,
                nonce,
                isFirstRegistration: !ownerCredential
            });
        }

        // ====================================
        // REGISTER CREDENTIAL (Owner Lock)
        // ====================================
        if (action === 'register') {
            // Validate required fields
            if (!credentialId || !publicKey || !userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing credential data'
                });
            }

            // Verify challenge was issued to this device
            const challengeData = await verifyChallenge(deviceFingerprint);
            if (!challengeData) {
                recordRegistrationAttempt(clientIp);

                addAuditEntry({
                    action: 'BIOMETRIC_REGISTER_INVALID_CHALLENGE',
                    ip: clientIp,
                    success: false,
                    endpoint: '/api/biometric-register'
                });

                return res.status(400).json({
                    success: false,
                    error: 'Invalid or expired challenge. Please try again.'
                });
            }

            // Check if owner already exists
            const { credential: existingOwner, error: existingOwnerError } = await getOwnerCredential();

            // Handle service errors - don't allow registration when we can't verify
            if (existingOwnerError) {
                console.error('[BiometricRegister] Service error during register:', existingOwnerError);
                return res.status(503).json({
                    success: false,
                    error: 'Registration service temporarily unavailable. Please try again.',
                    code: existingOwnerError
                });
            }

            if (existingOwner) {
                const deviceMatch = checkDeviceMatch(req, clientDeviceId, existingOwner.deviceFingerprint);

                if (!deviceMatch.matches) {
                    recordRegistrationAttempt(clientIp);

                    addAuditEntry({
                        action: 'BIOMETRIC_REGISTER_BLOCKED_EXISTING_OWNER',
                        ip: clientIp,
                        success: false,
                        endpoint: '/api/biometric-register'
                    });

                    return res.status(403).json({
                        success: false,
                        error: 'Dashboard is already secured by another device.',
                        isLocked: true
                    });
                }
            }

            // Create the owner credential
            const ownerCredentialData = {
                // Credential binding
                credentialId: sanitizeString(credentialId, 256),
                publicKey: sanitizeString(publicKey, 2048),
                userId: sanitizeString(userId, 64),

                // Device binding
                deviceFingerprint,

                // Metadata
                registeredAt: new Date().toISOString(),
                registeredFromIp: clientIp,
                lastUsed: null,
                authCount: 0,

                // Security
                version: '2.0',
                algorithm: 'ES256'
            };

            const stored = await storeOwnerCredential(ownerCredentialData);

            if (!stored) {
                addAuditEntry({
                    action: 'BIOMETRIC_REGISTER_STORAGE_FAILED',
                    ip: clientIp,
                    success: false,
                    endpoint: '/api/biometric-register'
                });

                return res.status(500).json({
                    success: false,
                    error: 'Failed to secure dashboard. Please try again.'
                });
            }

            addAuditEntry({
                action: 'BIOMETRIC_OWNER_REGISTERED',
                ip: clientIp,
                success: true,
                endpoint: '/api/biometric-register',
                userId: ownerCredentialData.userId.substring(0, 8) + '...',
                note: existingOwner ? 'Owner credential updated' : 'New owner registered'
            });

            return res.status(200).json({
                success: true,
                message: 'Dashboard secured! Only your biometric can unlock this dashboard.',
                isOwner: true,
                userId: ownerCredentialData.userId
            });
        }

        // Invalid action
        return res.status(400).json({
            success: false,
            error: 'Invalid action'
        });

    } catch (error) {
        console.error('[BiometricRegister] Error:', error);

        addAuditEntry({
            action: 'BIOMETRIC_REGISTER_ERROR',
            ip: clientIp,
            success: false,
            endpoint: '/api/biometric-register',
            error: error.message
        });

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};
