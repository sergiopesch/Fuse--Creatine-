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
const { verifyAuthenticationResponse } = require('@simplewebauthn/server');
const {
    base64urlToBuffer,
    getExpectedOrigins,
    getExpectedRpIds
} = require('./_lib/webauthn');
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

// Validate required environment variables at startup
const SESSION_SECRET = process.env.ENCRYPTION_KEY;
if (!SESSION_SECRET) {
    console.error('[BiometricAuth] CRITICAL: ENCRYPTION_KEY environment variable is not set');
}

const CONFIG = {
    CHALLENGE_EXPIRY: 5 * 60 * 1000, // 5 minutes
    BLOB_PREFIX: 'biometric-credentials/',
    CHALLENGE_PREFIX: 'biometric-challenges/',
    DEVICE_LINK_PREFIX: 'device-links/',
    OWNER_CREDENTIAL_KEY: 'owner-credential.json',
    RATE_LIMIT: { limit: 10, windowMs: 60000 }, // 10 requests per minute
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
    SESSION_DURATION: 30 * 60 * 1000, // 30 minutes
    DEVICE_LINK_EXPIRY: 5 * 60 * 1000, // 5 minutes for device link codes
    MAX_AUTHORIZED_DEVICES: 5, // Maximum number of authorized devices
    SESSION_SECRET: SESSION_SECRET
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
            console.error('[BiometricAuth] Blob fetch failed:', response.status);
            return { credential: null, error: 'BLOB_FETCH_FAILED' };
        }

        const credential = await response.json();
        return { credential, error: null };
    } catch (error) {
        console.error('[BiometricAuth] Failed to get owner credential:', error);
        return { credential: null, error: 'SERVICE_ERROR' };
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
 * Generate a 6-character device link code (uppercase alphanumeric)
 */
function generateDeviceLinkCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return code;
}

/**
 * Store device link for later claim
 */
async function storeDeviceLink(code, ownerUserId, createdByFingerprint) {
    const blobPath = `${CONFIG.DEVICE_LINK_PREFIX}${code}.json`;
    const data = {
        code,
        ownerUserId,
        createdByFingerprint,
        createdAt: Date.now(),
        claimed: false
    };

    try {
        await put(blobPath, JSON.stringify(data), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false
        });
        return true;
    } catch (error) {
        console.error('[BiometricAuth] Failed to store device link:', error);
        return false;
    }
}

/**
 * Get and validate device link
 */
async function getDeviceLink(code) {
    const blobPath = `${CONFIG.DEVICE_LINK_PREFIX}${code}.json`;

    try {
        const { blobs } = await list({ prefix: CONFIG.DEVICE_LINK_PREFIX });
        const blob = blobs.find(b => b.pathname === blobPath);

        if (!blob) return null;

        const response = await fetch(blob.url);
        if (!response.ok) return null;

        const data = await response.json();

        // Check expiry
        if (Date.now() - data.createdAt > CONFIG.DEVICE_LINK_EXPIRY) {
            // Delete expired link
            try {
                const { del } = require('@vercel/blob');
                await del(blob.url);
            } catch (e) { /* ignore cleanup errors */ }
            return null;
        }

        if (data.claimed) {
            return null; // Already used
        }

        return data;
    } catch (error) {
        console.error('[BiometricAuth] Failed to get device link:', error);
        return null;
    }
}

/**
 * Delete device link after use
 */
async function deleteDeviceLink(code) {
    const blobPath = `${CONFIG.DEVICE_LINK_PREFIX}${code}.json`;

    try {
        const { blobs } = await list({ prefix: CONFIG.DEVICE_LINK_PREFIX });
        const blob = blobs.find(b => b.pathname === blobPath);
        if (blob) {
            const { del } = require('@vercel/blob');
            await del(blob.url);
        }
    } catch (error) {
        console.error('[BiometricAuth] Failed to delete device link:', error);
    }
}

/**
 * Add a new device to the authorized devices list
 */
async function addAuthorizedDevice(ownerCredential, newFingerprint, deviceName = 'Unknown Device') {
    // Initialize authorizedDevices array if needed
    if (!ownerCredential.authorizedDevices) {
        ownerCredential.authorizedDevices = [];
        // Migrate legacy single device if exists
        if (ownerCredential.deviceFingerprint) {
            ownerCredential.authorizedDevices.push({
                fingerprint: ownerCredential.deviceFingerprint,
                name: 'Primary Device',
                addedAt: ownerCredential.registeredAt || new Date().toISOString()
            });
        }
    }

    // Check max devices limit
    if (ownerCredential.authorizedDevices.length >= CONFIG.MAX_AUTHORIZED_DEVICES) {
        return { success: false, error: 'Maximum devices limit reached' };
    }

    // Check if already authorized
    if (ownerCredential.authorizedDevices.some(d => d.fingerprint === newFingerprint)) {
        return { success: false, error: 'Device already authorized' };
    }

    // Add new device
    ownerCredential.authorizedDevices.push({
        fingerprint: newFingerprint,
        name: deviceName,
        addedAt: new Date().toISOString()
    });

    // Save updated credential
    const saved = await updateOwnerCredential(ownerCredential);
    if (!saved) {
        return { success: false, error: 'Failed to save device' };
    }

    return { success: true, deviceCount: ownerCredential.authorizedDevices.length };
}

/**
 * Check if a device matches any of the authorized devices (with migration support)
 * Supports both legacy single fingerprint and new multi-device array
 * Returns { matches: boolean, needsMigration: boolean, fingerprint: string }
 */
function checkDeviceMatch(req, clientDeviceId, ownerCredential) {
    const clientFp = createClientFingerprint(clientDeviceId);
    const headerFp = createHeaderFingerprint(req);
    const currentFp = clientFp || headerFp;

    // Get all authorized fingerprints (support both old and new format)
    const authorizedDevices = ownerCredential.authorizedDevices || [];
    const legacyFingerprint = ownerCredential.deviceFingerprint;

    // Build list of all valid fingerprints
    const allFingerprints = [...authorizedDevices.map(d => d.fingerprint)];
    if (legacyFingerprint && !allFingerprints.includes(legacyFingerprint)) {
        allFingerprints.push(legacyFingerprint);
    }

    // Check client fingerprint first
    if (clientFp && allFingerprints.includes(clientFp)) {
        return { matches: true, needsMigration: false, fingerprint: clientFp };
    }

    // Check header fingerprint for backwards compatibility
    if (allFingerprints.includes(headerFp)) {
        return { matches: true, needsMigration: !!clientFp, fingerprint: clientFp || headerFp };
    }

    return { matches: false, needsMigration: false, fingerprint: currentFp };
}

/**
 * Normalize stored credentials into a list (supports legacy single credential)
 */
function normalizeCredentials(ownerCredential) {
    if (!ownerCredential) return [];
    if (Array.isArray(ownerCredential.credentials) && ownerCredential.credentials.length) {
        return ownerCredential.credentials;
    }

    if (ownerCredential.credentialId && ownerCredential.publicKey) {
        return [{
            credentialId: ownerCredential.credentialId,
            publicKey: ownerCredential.publicKey,
            counter: ownerCredential.counter || 0,
            transports: ownerCredential.transports || [],
            createdAt: ownerCredential.registeredAt || new Date().toISOString(),
            lastUsed: ownerCredential.lastUsed || null,
            legacy: true
        }];
    }

    return [];
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

module.exports = async function handler(req, res) {
    // Fail early if encryption key is not configured
    if (!CONFIG.SESSION_SECRET) {
        console.error('[BiometricAuth] Authentication disabled: ENCRYPTION_KEY not configured');
        return res.status(503).json({
            success: false,
            error: 'Authentication service temporarily unavailable',
            code: 'CONFIG_ERROR'
        });
    }

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
        const {
            action,
            credentialId,
            authenticatorData,
            clientDataJSON,
            signature,
            sessionToken,
            rawId,
            type,
            userHandle
        } = req.body;

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
            // First check: exact match with current fingerprint
            let fingerprintValid = (payload.deviceFingerprint === deviceFingerprint);

            // Second check: if client provides a deviceId, check if token's fingerprint
            // matches what the client's deviceId would generate (handles localStorage reset)
            if (!fingerprintValid && clientDeviceId) {
                const clientFp = createClientFingerprint(clientDeviceId);
                fingerprintValid = (payload.deviceFingerprint === clientFp);
            }

            // Third check: for legacy tokens, check if the header fingerprint matches
            if (!fingerprintValid) {
                const headerFp = createHeaderFingerprint(req);
                fingerprintValid = (payload.deviceFingerprint === headerFp);
            }

            if (!fingerprintValid) {
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
            const { credential: ownerCredential, error: credentialError } = await getOwnerCredential();

            // Handle service errors - don't falsely report "no owner"
            if (credentialError) {
                console.error('[BiometricAuth] Service error during check-access:', credentialError);
                return res.status(503).json({
                    success: false,
                    error: 'Unable to verify access status. Please try again.',
                    code: credentialError
                });
            }

            if (!ownerCredential) {
                return res.status(200).json({
                    success: true,
                    hasOwner: false,
                    canRegister: true,
                    message: 'Dashboard not yet secured. Set up biometric access.'
                });
            }

            // Use migration-aware device matching (supports multi-device)
            const deviceMatch = checkDeviceMatch(req, clientDeviceId, ownerCredential);

            return res.status(200).json({
                success: true,
                hasOwner: true,
                isOwnerDevice: deviceMatch.matches,
                canAuthenticate: deviceMatch.matches,
                canLinkDevice: !deviceMatch.matches, // Non-owner devices can request to link
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
            const { credential: ownerCredential, error: credentialError } = await getOwnerCredential();

            // Handle service errors
            if (credentialError) {
                console.error('[BiometricAuth] Service error during get-challenge:', credentialError);
                return res.status(503).json({
                    success: false,
                    error: 'Authentication service temporarily unavailable. Please try again.',
                    code: credentialError
                });
            }

            if (!ownerCredential) {
                return res.status(403).json({
                    success: false,
                    error: 'Dashboard not yet secured. Please set up biometric access first.',
                    requiresSetup: true
                });
            }

            // Use migration-aware device matching (supports multi-device)
            const deviceMatch = checkDeviceMatch(req, clientDeviceId, ownerCredential);

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
                    isLocked: true,
                    canLinkDevice: true // Hint that device linking is available
                });
            }

            const credentials = normalizeCredentials(ownerCredential);
            if (!credentials.length) {
                return res.status(500).json({
                    success: false,
                    error: 'No credentials available. Please re-register.',
                    requiresSetup: true
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
                allowCredentials: credentials.map(credential => ({
                    id: credential.credentialId,
                    type: 'public-key',
                    transports: credential.transports || ['internal']
                }))
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
            if (!credentialId || !authenticatorData || !signature || !clientDataJSON) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing authentication data'
                });
            }

            const expectedOrigins = getExpectedOrigins(req);
            const expectedRpIds = getExpectedRpIds(req);

            if (!expectedOrigins.length || !expectedRpIds.length) {
                console.error('[BiometricAuth] Unable to resolve expected origin/RP ID');
                return res.status(500).json({
                    success: false,
                    error: 'Authentication configuration error. Please contact support.'
                });
            }

            // Get owner credential first to determine fingerprint format
            const { credential: ownerCredential, error: credentialError } = await getOwnerCredential();

            // Handle service errors
            if (credentialError) {
                console.error('[BiometricAuth] Service error during verify:', credentialError);
                return res.status(503).json({
                    success: false,
                    error: 'Authentication service temporarily unavailable. Please try again.',
                    code: credentialError
                });
            }

            if (!ownerCredential) {
                return res.status(403).json({
                    success: false,
                    error: 'Dashboard not configured',
                    requiresSetup: true
                });
            }

            // Use migration-aware device matching (supports multi-device)
            const deviceMatch = checkDeviceMatch(req, clientDeviceId, ownerCredential);

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

            const sanitizedCredentialId = sanitizeString(credentialId, 512);
            const credentials = normalizeCredentials(ownerCredential);
            const credentialRecord = credentials.find(entry => entry.credentialId === sanitizedCredentialId);

            if (!credentialRecord) {
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

            const credentialIdBuffer = base64urlToBuffer(credentialRecord.credentialId);
            const publicKeyBuffer = base64urlToBuffer(credentialRecord.publicKey);
            if (!credentialIdBuffer || !publicKeyBuffer) {
                recordFailedAttempt(lockoutKey);
                return res.status(500).json({
                    success: false,
                    error: 'Stored credential is invalid. Please re-register.'
                });
            }

            let verification;
            try {
                verification = await verifyAuthenticationResponse({
                    response: {
                        id: sanitizedCredentialId,
                        rawId: sanitizeString(rawId || sanitizedCredentialId, 512),
                        type: type || 'public-key',
                        response: {
                            authenticatorData: sanitizeString(authenticatorData, 4096),
                            clientDataJSON: sanitizeString(clientDataJSON, 4096),
                            signature: sanitizeString(signature, 4096),
                            userHandle: userHandle ? sanitizeString(userHandle, 512) : undefined
                        }
                    },
                    expectedChallenge: issuedChallenge,
                    expectedOrigin: expectedOrigins,
                    expectedRPID: expectedRpIds,
                    credential: {
                        id: credentialIdBuffer,
                        publicKey: publicKeyBuffer,
                        counter: credentialRecord.counter || 0,
                        transports: credentialRecord.transports
                    }
                });
            } catch (error) {
                recordFailedAttempt(lockoutKey);
                console.error('[BiometricAuth] Authentication verification failed:', error);
                return res.status(401).json({
                    success: false,
                    error: 'Authentication verification failed'
                });
            }

            if (!verification?.verified || !verification.authenticationInfo) {
                recordFailedAttempt(lockoutKey);
                return res.status(401).json({
                    success: false,
                    error: 'Authentication verification failed'
                });
            }

            // Authentication successful!
            clearFailedAttempts(lockoutKey);

            // Update last used and migrate fingerprint if needed
            ownerCredential.lastUsed = new Date().toISOString();
            ownerCredential.authCount = (ownerCredential.authCount || 0) + 1;

            credentialRecord.counter = typeof verification.authenticationInfo.newCounter === 'number'
                ? verification.authenticationInfo.newCounter
                : credentialRecord.counter;
            credentialRecord.lastUsed = new Date().toISOString();
            ownerCredential.credentials = credentials;
            ownerCredential.credentialId = credentialRecord.credentialId;
            ownerCredential.publicKey = credentialRecord.publicKey;
            ownerCredential.counter = credentialRecord.counter;
            ownerCredential.transports = credentialRecord.transports;

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
                expiresIn: Math.floor(CONFIG.SESSION_DURATION / 1000),
                userId: ownerCredential.userId
            });
        }

        // ====================================
        // CREATE DEVICE LINK (from authenticated session)
        // ====================================
        if (action === 'create-device-link') {
            const { sessionToken: linkSessionToken } = req.body;

            // Verify session
            if (!linkSessionToken) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            const sessionPayload = verifySessionToken(linkSessionToken);
            if (!sessionPayload) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired session',
                    requiresAuth: true
                });
            }

            // Get owner credential
            const { credential: ownerCredential, error: credentialError } = await getOwnerCredential();
            if (credentialError || !ownerCredential) {
                return res.status(503).json({
                    success: false,
                    error: 'Unable to create device link'
                });
            }

            // Verify this is an owner device
            const deviceMatch = checkDeviceMatch(req, clientDeviceId, ownerCredential);
            if (!deviceMatch.matches) {
                return res.status(403).json({
                    success: false,
                    error: 'Only the owner can create device links'
                });
            }

            // Check device limit
            const currentDevices = ownerCredential.authorizedDevices?.length || 1;
            if (currentDevices >= CONFIG.MAX_AUTHORIZED_DEVICES) {
                return res.status(400).json({
                    success: false,
                    error: `Maximum of ${CONFIG.MAX_AUTHORIZED_DEVICES} devices allowed`
                });
            }

            // Generate link code
            const linkCode = generateDeviceLinkCode();
            const stored = await storeDeviceLink(linkCode, ownerCredential.userId, deviceFingerprint);

            if (!stored) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to create device link'
                });
            }

            addAuditEntry({
                action: 'DEVICE_LINK_CREATED',
                ip: clientIp,
                success: true,
                endpoint: '/api/biometric-authenticate',
                note: `Link code created, expires in ${CONFIG.DEVICE_LINK_EXPIRY / 60000} minutes`
            });

            return res.status(200).json({
                success: true,
                linkCode,
                expiresIn: Math.floor(CONFIG.DEVICE_LINK_EXPIRY / 1000),
                message: 'Device link created. Enter this code on your new device.'
            });
        }

        // ====================================
        // CLAIM DEVICE LINK (from new device)
        // ====================================
        if (action === 'claim-device-link') {
            const { linkCode } = req.body;

            if (!linkCode || typeof linkCode !== 'string' || linkCode.length !== 6) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid link code format'
                });
            }

            // Normalize code (uppercase)
            const normalizedCode = linkCode.toUpperCase().trim();

            // Get and validate link
            const linkData = await getDeviceLink(normalizedCode);
            if (!linkData) {
                addAuditEntry({
                    action: 'DEVICE_LINK_CLAIM_FAILED',
                    ip: clientIp,
                    success: false,
                    endpoint: '/api/biometric-authenticate',
                    note: 'Invalid or expired link code'
                });

                return res.status(400).json({
                    success: false,
                    error: 'Invalid or expired link code. Please request a new one.'
                });
            }

            // Get owner credential
            const { credential: ownerCredential, error: credentialError } = await getOwnerCredential();
            if (credentialError || !ownerCredential) {
                return res.status(503).json({
                    success: false,
                    error: 'Unable to complete device linking'
                });
            }

            // Verify link belongs to this owner
            if (ownerCredential.userId !== linkData.ownerUserId) {
                return res.status(403).json({
                    success: false,
                    error: 'Link code is not valid'
                });
            }

            // Detect device type for naming
            const ua = req.headers['user-agent'] || '';
            let deviceName = 'New Device';
            if (/iPhone|iPad/i.test(ua)) {
                deviceName = 'iPhone/iPad';
            } else if (/Android/i.test(ua)) {
                deviceName = 'Android Device';
            } else if (/Mac/i.test(ua)) {
                deviceName = 'Mac';
            } else if (/Windows/i.test(ua)) {
                deviceName = 'Windows PC';
            }

            // Add this device to authorized list
            const result = await addAuthorizedDevice(ownerCredential, deviceFingerprint, deviceName);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    error: result.error
                });
            }

            // Delete the used link code
            await deleteDeviceLink(normalizedCode);

            addAuditEntry({
                action: 'DEVICE_LINK_CLAIMED',
                ip: clientIp,
                success: true,
                endpoint: '/api/biometric-authenticate',
                note: `New device added: ${deviceName}. Total devices: ${result.deviceCount}`
            });

            return res.status(200).json({
                success: true,
                message: 'Device linked successfully! You can now set up biometric access.',
                deviceName,
                deviceCount: result.deviceCount
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
