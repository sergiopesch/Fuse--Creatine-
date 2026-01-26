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
 * @version 2.2.0 - Refactored to use shared biometric utilities
 */

const crypto = require('crypto');
const { Redis } = require('@upstash/redis');
const { verifyAuthenticationResponse } = require('@simplewebauthn/server');
const {
    base64urlToBuffer,
    getExpectedOrigins,
    getExpectedRpIds
} = require('./_lib/webauthn');
const {
    createSecuredHandler,
    addAuditEntry,
    sanitizeString
} = require('./_lib/security');
const {
    CONFIG: BIOMETRIC_CONFIG,
    createClientFingerprint,
    createHeaderFingerprint,
    createDeviceFingerprint,
    checkDeviceMatch,
    normalizeCredentials,
    getOwnerCredential,
    storeOwnerCredential: updateOwnerCredential,
    generateChallenge,
    storeChallenge,
    verifyChallenge,
    generateDeviceLinkCode,
    storeDeviceLink,
    getDeviceLink,
    deleteDeviceLink,
    addAuthorizedDevice
} = require('./_lib/biometric-utils');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Validate required environment variables at startup
const SESSION_SECRET = process.env.ENCRYPTION_KEY || null;
if (!SESSION_SECRET) {
    console.warn('[BiometricAuth] ENCRYPTION_KEY not set; session tokens will be disabled');
}

const CONFIG = {
    ...BIOMETRIC_CONFIG,
    RATE_LIMIT: { limit: 10, windowMs: 60000 }, // 10 requests per minute
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
    SESSION_DURATION: 30 * 60 * 1000, // 30 minutes
    SESSION_SECRET: SESSION_SECRET
};

// Initialize Redis client if configuration is available
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

// ============================================================================
// SESSION & LOCKOUT FUNCTIONS (Auth-specific, not in shared module)
// ============================================================================

/**
 * Generate a secure session token
 * @param {string} userId - User identifier
 * @param {string} deviceFingerprint - Device fingerprint
 * @returns {string} - HMAC-signed session token
 */
function generateSessionToken(userId, deviceFingerprint) {
    if (!CONFIG.SESSION_SECRET) {
        return null;
    }
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
 * @param {string} token - Session token to verify
 * @returns {object|null} - Token payload if valid, null otherwise
 */
function verifySessionToken(token) {
    if (!CONFIG.SESSION_SECRET) {
        return null;
    }
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
 * Check if user is locked out using Redis
 * @param {string} key - Lockout key (typically device fingerprint)
 * @returns {Promise<boolean>} - True if locked out
 */
async function isLockedOut(key) {
    if (!redis) return false;
    try {
        const lockoutKey = `lockout:auth:${key}`;
        const attempts = await redis.get(lockoutKey);
        return attempts && parseInt(attempts, 10) >= CONFIG.MAX_FAILED_ATTEMPTS;
    } catch (error) {
        console.error('Redis lockout check failed:', error);
        return false; // Fail open
    }
}

/**
 * Record failed attempt in Redis
 * @param {string} key - Lockout key (typically device fingerprint)
 */
async function recordFailedAttempt(key) {
    if (!redis) return;
    try {
        const lockoutKey = `lockout:auth:${key}`;
        const attempts = await redis.incr(lockoutKey);
        if (attempts === 1) {
            await redis.expire(lockoutKey, Math.ceil(CONFIG.LOCKOUT_DURATION / 1000));
        }
    } catch (error) {
        console.error('Redis record failed attempt failed:', error);
    }
}

/**
 * Clear failed attempts on success from Redis
 * @param {string} key - Lockout key (typically device fingerprint)
 */
async function clearFailedAttempts(key) {
    if (!redis) return;
    try {
        const lockoutKey = `lockout:auth:${key}`;
        await redis.del(lockoutKey);
    } catch (error) {
        console.error('Redis clear failed attempts failed:', error);
    }
}


const biometricAuthHandler = async (req, res, { clientIp, validatedBody }) => {
    const deviceFingerprint = createDeviceFingerprint(req, validatedBody.deviceId);

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
        } = validatedBody;

        // ====================================
        // VERIFY SESSION TOKEN
        // ====================================
        if (action === 'verify-session') {
            if (!CONFIG.SESSION_SECRET) {
                return res.status(200).json({
                    success: false,
                    verified: false,
                    requiresAuth: true,
                    error: 'Session tokens unavailable'
                });
            }
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

            let fingerprintValid = (payload.deviceFingerprint === deviceFingerprint);
            if (!fingerprintValid && validatedBody.deviceId) {
                const clientFp = createClientFingerprint(validatedBody.deviceId);
                fingerprintValid = (payload.deviceFingerprint === clientFp);
            }
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
        // RESET OWNER (Admin only)
        // ====================================
        if (action === 'reset-owner') {
            const adminToken = process.env.ADMIN_TOKEN;
            const providedToken = validatedBody.adminToken;

            if (!adminToken) {
                return res.status(503).json({
                    success: false,
                    error: 'Admin functionality not configured'
                });
            }

            if (!providedToken || providedToken !== adminToken) {
                addAuditEntry({
                    action: 'BIOMETRIC_RESET_UNAUTHORIZED',
                    ip: clientIp,
                    success: false,
                    endpoint: '/api/biometric-authenticate'
                });
                return res.status(401).json({
                    success: false,
                    error: 'Invalid admin token'
                });
            }

            // Delete the owner credential
            const { del } = require('@vercel/blob');
            const blobPath = 'biometric-credentials/owner-credential.json';

            try {
                const { blobs } = await require('@vercel/blob').list({ prefix: 'biometric-credentials/' });
                const blob = blobs.find(b => b.pathname === blobPath);

                if (blob) {
                    await del(blob.url);
                }

                addAuditEntry({
                    action: 'BIOMETRIC_OWNER_RESET',
                    ip: clientIp,
                    success: true,
                    endpoint: '/api/biometric-authenticate'
                });

                return res.status(200).json({
                    success: true,
                    message: 'Owner registration cleared. You can now register a new owner.'
                });
            } catch (error) {
                console.error('[BiometricAuth] Reset owner failed:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to reset owner registration'
                });
            }
        }

        // ====================================
        // CHECK ACCESS STATUS
        // ====================================
        if (action === 'check-access') {
            const { credential: ownerCredential, error: credentialError } = await getOwnerCredential();

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

            const deviceMatch = checkDeviceMatch(req, validatedBody.deviceId, ownerCredential);

            return res.status(200).json({
                success: true,
                hasOwner: true,
                isOwnerDevice: deviceMatch.matches,
                canAuthenticate: deviceMatch.matches,
                canLinkDevice: !deviceMatch.matches,
                message: deviceMatch.matches ?
                    'Welcome back. Authenticate to access your dashboard.' :
                    'This dashboard is secured. Only the owner can access it.'
            });
        }

        // ====================================
        // GET CHALLENGE
        // ====================================
        if (action === 'get-challenge') {
            const lockoutKey = `auth:${deviceFingerprint}`;
            if (await isLockedOut(lockoutKey)) {
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

            const { credential: ownerCredential, error: credentialError } = await getOwnerCredential();

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

            const deviceMatch = checkDeviceMatch(req, validatedBody.deviceId, ownerCredential);

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
                    canLinkDevice: true
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
                allowCredentials: credentials.map(c => ({ id: c.credentialId, type: 'public-key', transports: c.transports || ['internal'] }))
            });
        }

        // ====================================
        // VERIFY AUTHENTICATION
        // ====================================
        if (action === 'verify') {
            const lockoutKey = `auth:${deviceFingerprint}`;

            if (await isLockedOut(lockoutKey)) {
                return res.status(403).json({
                    success: false,
                    error: 'Account temporarily locked',
                    retryAfter: Math.ceil(CONFIG.LOCKOUT_DURATION / 1000)
                });
            }

            if (!credentialId || !authenticatorData || !signature || !clientDataJSON) {
                return res.status(400).json({ success: false, error: 'Missing authentication data' });
            }

            const expectedOrigins = getExpectedOrigins(req);
            const expectedRpIds = getExpectedRpIds(req);

            if (!expectedOrigins.length || !expectedRpIds.length) {
                console.error('[BiometricAuth] Unable to resolve expected origin/RP ID');
                return res.status(500).json({ success: false, error: 'Authentication configuration error.' });
            }

            const { credential: ownerCredential, error: credentialError } = await getOwnerCredential();

            if (credentialError) {
                console.error('[BiometricAuth] Service error during verify:', credentialError);
                return res.status(503).json({ success: false, error: 'Authentication service temporarily unavailable.', code: credentialError });
            }

            if (!ownerCredential) {
                return res.status(403).json({ success: false, error: 'Dashboard not configured', requiresSetup: true });
            }

            const deviceMatch = checkDeviceMatch(req, validatedBody.deviceId, ownerCredential);
            const issuedChallenge = await verifyChallenge(deviceMatch.fingerprint);

            if (!issuedChallenge) {
                await recordFailedAttempt(lockoutKey);
                return res.status(400).json({ success: false, error: 'Invalid or expired challenge. Please try again.' });
            }

            if (!deviceMatch.matches) {
                await recordFailedAttempt(lockoutKey);
                addAuditEntry({ action: 'BIOMETRIC_AUTH_DEVICE_MISMATCH', ip: clientIp, success: false, endpoint: '/api/biometric-authenticate' });
                return res.status(403).json({ success: false, error: 'Access denied. Device mismatch.', isLocked: true });
            }

            const sanitizedCredentialId = sanitizeString(credentialId, 512);
            const credentials = normalizeCredentials(ownerCredential);
            const credentialRecord = credentials.find(entry => entry.credentialId === sanitizedCredentialId);

            if (!credentialRecord) {
                await recordFailedAttempt(lockoutKey);
                addAuditEntry({ action: 'BIOMETRIC_AUTH_CREDENTIAL_MISMATCH', ip: clientIp, success: false, endpoint: '/api/biometric-authenticate' });
                return res.status(401).json({ success: false, error: 'Invalid credentials' });
            }

            const credentialIdBuffer = base64urlToBuffer(credentialRecord.credentialId);
            const publicKeyBuffer = base64urlToBuffer(credentialRecord.publicKey);
            if (!credentialIdBuffer || !publicKeyBuffer) {
                await recordFailedAttempt(lockoutKey);
                return res.status(500).json({ success: false, error: 'Stored credential is invalid. Please re-register.' });
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
                await recordFailedAttempt(lockoutKey);
                console.error('[BiometricAuth] Authentication verification failed:', error);
                return res.status(401).json({ success: false, error: 'Authentication verification failed' });
            }

            if (!verification?.verified || !verification.authenticationInfo) {
                await recordFailedAttempt(lockoutKey);
                return res.status(401).json({ success: false, error: 'Authentication verification failed' });
            }

            await clearFailedAttempts(lockoutKey);

            ownerCredential.lastUsed = new Date().toISOString();
            ownerCredential.authCount = (ownerCredential.authCount || 0) + 1;
            credentialRecord.counter = typeof verification.authenticationInfo.newCounter === 'number' ? verification.authenticationInfo.newCounter : credentialRecord.counter;
            credentialRecord.lastUsed = new Date().toISOString();
            ownerCredential.credentials = credentials;
            ownerCredential.credentialId = credentialRecord.credentialId;
            ownerCredential.publicKey = credentialRecord.publicKey;
            ownerCredential.counter = credentialRecord.counter;
            ownerCredential.transports = credentialRecord.transports;

            if (deviceMatch.needsMigration && deviceMatch.fingerprint) {
                console.log('[BiometricAuth] Migrating credential to client-based fingerprint');
                ownerCredential.deviceFingerprint = deviceMatch.fingerprint;
                ownerCredential.migratedAt = new Date().toISOString();
            }

            await updateOwnerCredential(ownerCredential);

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

            const responseBody = {
                success: true,
                verified: true,
                message: 'Welcome back! Dashboard unlocked.',
                userId: ownerCredential.userId
            };

            if (newSessionToken) {
                responseBody.sessionToken = newSessionToken;
                responseBody.expiresIn = Math.floor(CONFIG.SESSION_DURATION / 1000);
            }

            return res.status(200).json(responseBody);
        }

        // ... (rest of the actions: create-device-link, claim-device-link)
        
        return res.status(400).json({ success: false, error: 'Invalid action' });

    } catch (error) {
        console.error('[BiometricAuth] Error:', error);
        addAuditEntry({
            action: 'BIOMETRIC_AUTH_ERROR',
            ip: clientIp,
            success: false,
            endpoint: '/api/biometric-authenticate',
            error: error.message
        });
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

module.exports = createSecuredHandler({
  requireAuth: false,
  allowedMethods: ['POST', 'OPTIONS'],
  rateLimit: {
      limit: CONFIG.RATE_LIMIT.limit,
      windowMs: CONFIG.RATE_LIMIT.windowMs,
      keyPrefix: 'biometric-auth'
  },
}, biometricAuthHandler);
