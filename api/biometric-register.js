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
 * @version 2.2.0 - Refactored to use shared biometric utilities
 */

const { Redis } = require('@upstash/redis');
const { verifyRegistrationResponse } = require('@simplewebauthn/server');
const {
    bufferToBase64url,
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
    createDeviceFingerprint,
    checkDeviceMatch,
    normalizeCredentials,
    getOwnerCredential,
    storeOwnerCredential,
    generateChallenge,
    generateNonce,
    storeChallenge,
    verifyChallenge
} = require('./_lib/biometric-utils');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    ...BIOMETRIC_CONFIG,
    RATE_LIMIT: { limit: 5, windowMs: 60000 }, // 5 requests per minute (stricter)
    MAX_REGISTRATION_ATTEMPTS: 3,
    LOCKOUT_DURATION: 60 * 60 * 1000 // 1 hour lockout for registration abuse
};

// Initialize Redis client if configuration is available
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;


// ============================================================================
// LOCKOUT FUNCTIONS (Registration-specific, not in shared module)
// ============================================================================

/**
 * Check if registration is locked out using Redis
 * @param {string} ip - Client IP address
 * @returns {Promise<boolean>} - True if locked out
 */
async function isRegistrationLockedOut(ip) {
    if (!redis) return false;
    try {
        const key = `lockout:register:${ip}`;
        const attempts = await redis.get(key);
        return attempts && parseInt(attempts, 10) >= CONFIG.MAX_REGISTRATION_ATTEMPTS;
    } catch (error) {
        console.error('Redis registration lockout check failed:', error);
        return false; // Fail open
    }
}

/**
 * Record failed registration attempt in Redis
 * @param {string} ip - Client IP address
 */
async function recordRegistrationAttempt(ip) {
    if (!redis) return;
    try {
        const key = `lockout:register:${ip}`;
        const attempts = await redis.incr(key);
        if (attempts === 1) {
            await redis.expire(key, Math.ceil(CONFIG.LOCKOUT_DURATION / 1000));
        }
    } catch (error) {
        console.error('Redis record registration attempt failed:', error);
    }
}

/**
 * Wrapper to store challenge with 'reg' prefix for registration
 */
async function storeRegChallenge(key, challenge, nonce) {
    return storeChallenge(key, challenge, nonce, 'reg');
}

/**
 * Wrapper to verify challenge with 'reg' prefix for registration
 */
async function verifyRegChallenge(key) {
    return verifyChallenge(key, 'reg');
}

const biometricRegisterHandler = async (req, res, { clientIp, validatedBody }) => {
    const deviceFingerprint = createDeviceFingerprint(req, validatedBody.deviceId);

    // Check registration lockout
    if (await isRegistrationLockedOut(clientIp)) {
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
        const { action, userId, credentialId, clientDataJSON } = validatedBody;

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
                const deviceMatch = checkDeviceMatch(req, validatedBody.deviceId, ownerCredential);
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
            const { credential: ownerCredential, error: credentialError } = await getOwnerCredential();

            if (credentialError) {
                console.error('[BiometricRegister] Service error during get-challenge:', credentialError);
                return res.status(503).json({
                    success: false,
                    error: 'Registration service temporarily unavailable. Please try again.',
                    code: credentialError
                });
            }

            if (ownerCredential) {
                const deviceMatch = checkDeviceMatch(req, validatedBody.deviceId, ownerCredential);

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
            await storeRegChallenge(deviceFingerprint, challenge, nonce);

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
            if (!credentialId || !clientDataJSON || !validatedBody?.attestationObject) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing credential data'
                });
            }

            const expectedOrigins = getExpectedOrigins(req);
            const expectedRpIds = getExpectedRpIds(req);

            if (!expectedOrigins.length || !expectedRpIds.length) {
                console.error('[BiometricRegister] Unable to resolve expected origin/RP ID');
                return res.status(500).json({
                    success: false,
                    error: 'Registration configuration error. Please contact support.'
                });
            }

            const challengeData = await verifyRegChallenge(deviceFingerprint);
            if (!challengeData) {
                await recordRegistrationAttempt(clientIp);
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

            const { credential: existingOwner, error: existingOwnerError } = await getOwnerCredential();

            if (existingOwnerError) {
                console.error('[BiometricRegister] Service error during register:', existingOwnerError);
                return res.status(503).json({
                    success: false,
                    error: 'Registration service temporarily unavailable. Please try again.',
                    code: existingOwnerError
                });
            }

            if (existingOwner) {
                const deviceMatch = checkDeviceMatch(req, validatedBody.deviceId, existingOwner);

                if (!deviceMatch.matches) {
                    await recordRegistrationAttempt(clientIp);
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

            let verification;
            try {
                verification = await verifyRegistrationResponse({
                    response: {
                        id: sanitizeString(credentialId, 512),
                        rawId: sanitizeString(validatedBody?.rawId || credentialId, 512),
                        type: validatedBody?.type || 'public-key',
                        response: {
                            clientDataJSON: sanitizeString(clientDataJSON, 4096),
                            attestationObject: sanitizeString(validatedBody?.attestationObject, 8192),
                            transports: Array.isArray(validatedBody?.transports) ? validatedBody.transports : undefined
                        }
                    },
                    expectedChallenge: challengeData.challenge,
                    expectedOrigin: expectedOrigins,
                    expectedRPID: expectedRpIds,
                    requireUserVerification: true
                });
            } catch (error) {
                await recordRegistrationAttempt(clientIp);
                console.error('[BiometricRegister] Registration verification failed:', error);
                return res.status(400).json({
                    success: false,
                    error: 'Registration verification failed. Please try again.'
                });
            }

            if (!verification?.verified || !verification.registrationInfo) {
                await recordRegistrationAttempt(clientIp);
                return res.status(400).json({
                    success: false,
                    error: 'Registration verification failed. Please try again.'
                });
            }

            const {
                credentialPublicKey,
                credentialID,
                counter,
                fmt,
                aaguid,
                credentialDeviceType,
                credentialBackedUp
            } = verification.registrationInfo;

            if (!credentialPublicKey || !credentialID) {
                await recordRegistrationAttempt(clientIp);
                return res.status(400).json({
                    success: false,
                    error: 'Registration data incomplete. Please try again.'
                });
            }

            const ua = req.headers['user-agent'] || '';
            let deviceName = 'Primary Device';
            if (/iPhone|iPad/i.test(ua)) deviceName = 'iPhone/iPad';
            else if (/Android/i.test(ua)) deviceName = 'Android Device';
            else if (/Mac/i.test(ua)) deviceName = 'Mac';
            else if (/Windows/i.test(ua)) deviceName = 'Windows PC';

            const resolvedUserId = existingOwner?.userId || sanitizeString(userId, 64);
            if (!resolvedUserId) {
                return res.status(400).json({ success: false, error: 'Missing user identifier' });
            }

            const newCredential = {
                credentialId: sanitizeString(bufferToBase64url(credentialID), 512),
                publicKey: sanitizeString(bufferToBase64url(credentialPublicKey), 2048),
                counter: typeof counter === 'number' ? counter : 0,
                transports: Array.isArray(validatedBody?.transports) ? validatedBody.transports : [],
                deviceName,
                createdAt: new Date().toISOString(),
                lastUsed: null,
                fmt: fmt || 'none',
                aaguid: typeof aaguid === 'string' ? aaguid : (aaguid ? bufferToBase64url(aaguid) : null),
                credentialDeviceType,
                credentialBackedUp
            };

            let ownerCredentialData;
            if (existingOwner) {
                const credentials = normalizeCredentials(existingOwner);
                const existingIndex = credentials.findIndex(entry => entry.credentialId === newCredential.credentialId);

                if (existingIndex >= 0) {
                    credentials[existingIndex] = { ...credentials[existingIndex], ...newCredential, updatedAt: new Date().toISOString() };
                } else {
                    credentials.push(newCredential);
                }

                const authorizedDevices = Array.isArray(existingOwner.authorizedDevices) ? [...existingOwner.authorizedDevices] : [];
                if (!authorizedDevices.some(device => device.fingerprint === deviceFingerprint)) {
                    authorizedDevices.push({ fingerprint: deviceFingerprint, name: deviceName, addedAt: new Date().toISOString() });
                }

                ownerCredentialData = {
                    ...existingOwner,
                    userId: resolvedUserId,
                    credentials,
                    authorizedDevices,
                    credentialId: newCredential.credentialId,
                    publicKey: newCredential.publicKey,
                    counter: newCredential.counter,
                    transports: newCredential.transports,
                    deviceFingerprint: existingOwner.deviceFingerprint || deviceFingerprint,
                    version: existingOwner.version || '3.0',
                    algorithm: existingOwner.algorithm || 'ES256',
                    updatedAt: new Date().toISOString()
                };
            } else {
                ownerCredentialData = {
                    credentialId: newCredential.credentialId,
                    publicKey: newCredential.publicKey,
                    counter: newCredential.counter,
                    transports: newCredential.transports,
                    userId: resolvedUserId,
                    deviceFingerprint,
                    credentials: [newCredential],
                    authorizedDevices: [{ fingerprint: deviceFingerprint, name: deviceName, addedAt: new Date().toISOString() }],
                    registeredAt: new Date().toISOString(),
                    registeredFromIp: clientIp,
                    lastUsed: null,
                    authCount: 0,
                    rpId: expectedRpIds[0],
                    version: '3.0',
                    algorithm: 'ES256'
                };
            }

            const stored = await storeOwnerCredential(ownerCredentialData);

            if (!stored) {
                addAuditEntry({ action: 'BIOMETRIC_REGISTER_STORAGE_FAILED', ip: clientIp, success: false, endpoint: '/api/biometric-register' });
                return res.status(500).json({ success: false, error: 'Failed to secure dashboard. Please try again.' });
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
                userId: ownerCredentialData.userId,
                credentialId: newCredential.credentialId
            });
        }

        return res.status(400).json({ success: false, error: 'Invalid action' });

    } catch (error) {
        console.error('[BiometricRegister] Error:', error);
        addAuditEntry({
            action: 'BIOMETRIC_REGISTER_ERROR',
            ip: clientIp,
            success: false,
            endpoint: '/api/biometric-register',
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
      keyPrefix: 'biometric-register'
  },
}, biometricRegisterHandler);
