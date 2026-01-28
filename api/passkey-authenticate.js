/**
 * FUSE Passkey Authentication API
 * Handles passkey (WebAuthn) authentication
 *
 * Supports:
 * - Standard passkey authentication
 * - Conditional UI (autofill) authentication
 * - Session verification
 *
 * @version 1.0.0
 */

const crypto = require('crypto');
const { verifyAuthenticationResponse } = require('@simplewebauthn/server');
const { base64urlToBuffer, getExpectedOrigins, getExpectedRpIds } = require('./_lib/webauthn');
const { createSecuredHandler, addAuditEntry, sanitizeString } = require('./_lib/security');
const {
    CONFIG,
    generateChallenge,
    storeChallenge,
    verifyChallenge,
    getUserByEmail,
    getUserById,
    getCredential,
    getUserCredentials,
    updateCredentialUsage,
    generateSessionToken,
    verifySessionToken,
} = require('./_lib/passkey-utils');

// ============================================================================
// CONFIGURATION
// ============================================================================

const RATE_LIMIT = { limit: 15, windowMs: 60000 }; // 15 requests per minute
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Redis client for lockout tracking
const { Redis } = require('@upstash/redis');
const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? Redis.fromEnv()
        : null;

// ============================================================================
// LOCKOUT FUNCTIONS
// ============================================================================

async function isLockedOut(key) {
    if (!redis) return false;
    try {
        const attempts = await redis.get(`lockout:passkey:${key}`);
        return attempts && parseInt(attempts, 10) >= MAX_FAILED_ATTEMPTS;
    } catch {
        return false;
    }
}

async function recordFailedAttempt(key) {
    if (!redis) return;
    try {
        const lockoutKey = `lockout:passkey:${key}`;
        const attempts = await redis.incr(lockoutKey);
        if (attempts === 1) {
            await redis.expire(lockoutKey, Math.ceil(LOCKOUT_DURATION / 1000));
        }
    } catch (error) {
        console.error('[PasskeyAuth] Record failed attempt error:', error);
    }
}

async function clearFailedAttempts(key) {
    if (!redis) return;
    try {
        await redis.del(`lockout:passkey:${key}`);
    } catch (error) {
        console.error('[PasskeyAuth] Clear failed attempts error:', error);
    }
}

// ============================================================================
// HANDLER
// ============================================================================

const passkeyAuthHandler = async (req, res, { clientIp, validatedBody }) => {
    try {
        const { action } = validatedBody;

        // ====================================
        // VERIFY SESSION TOKEN
        // ====================================
        if (action === 'verify-session') {
            const { sessionToken } = validatedBody;

            if (!sessionToken) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing session token',
                });
            }

            const payload = verifySessionToken(sessionToken);

            if (!payload) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired session',
                    requiresAuth: true,
                });
            }

            return res.status(200).json({
                success: true,
                verified: true,
                userId: payload.sub,
                email: payload.email,
                expiresIn: Math.floor((payload.exp - Date.now()) / 1000),
            });
        }

        // ====================================
        // START AUTHENTICATION - Get Challenge
        // ====================================
        if (action === 'start') {
            const { email, conditional } = validatedBody;

            // Generate session ID and challenge
            const sessionId = crypto.randomBytes(16).toString('hex');
            const challenge = generateChallenge();
            await storeChallenge(sessionId, challenge, 'authenticate');

            let allowCredentials = [];

            // If email provided, get user's credentials
            if (email && typeof email === 'string') {
                const normalizedEmail = sanitizeString(email.toLowerCase().trim(), 256);
                const user = await getUserByEmail(normalizedEmail);

                if (user) {
                    const credentials = await getUserCredentials(user.id);
                    allowCredentials = credentials.map(cred => ({
                        id: cred.credentialId,
                        type: 'public-key',
                        transports: cred.transports || ['internal', 'hybrid'],
                    }));
                }
            }

            // For conditional UI (autofill), we don't specify allowCredentials
            // This lets the browser show all available passkeys
            const isConditional = conditional === true;

            addAuditEntry({
                action: 'PASSKEY_AUTH_STARTED',
                ip: clientIp,
                success: true,
                endpoint: '/api/passkey-authenticate',
                conditional: isConditional,
            });

            return res.status(200).json({
                success: true,
                challenge,
                sessionId,
                allowCredentials: isConditional ? [] : allowCredentials,
                userVerification: 'required',
            });
        }

        // ====================================
        // COMPLETE AUTHENTICATION - Verify
        // ====================================
        if (action === 'complete') {
            const {
                sessionId,
                credentialId,
                rawId,
                type,
                authenticatorData,
                clientDataJSON,
                signature,
                userHandle,
            } = validatedBody;

            // Check lockout
            if (await isLockedOut(clientIp)) {
                addAuditEntry({
                    action: 'PASSKEY_AUTH_LOCKED_OUT',
                    ip: clientIp,
                    success: false,
                    endpoint: '/api/passkey-authenticate',
                });
                return res.status(403).json({
                    success: false,
                    error: 'Too many failed attempts. Please wait before trying again.',
                    retryAfter: Math.ceil(LOCKOUT_DURATION / 1000),
                });
            }

            if (!sessionId || !credentialId || !authenticatorData || !clientDataJSON || !signature) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing authentication data',
                });
            }

            // Verify challenge
            const expectedChallenge = await verifyChallenge(sessionId, 'authenticate');
            if (!expectedChallenge) {
                await recordFailedAttempt(clientIp);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid or expired challenge. Please try again.',
                });
            }

            // Get credential from storage
            const sanitizedCredentialId = sanitizeString(credentialId, 512);
            const credential = await getCredential(sanitizedCredentialId);

            if (!credential) {
                await recordFailedAttempt(clientIp);
                addAuditEntry({
                    action: 'PASSKEY_AUTH_CREDENTIAL_NOT_FOUND',
                    ip: clientIp,
                    success: false,
                    endpoint: '/api/passkey-authenticate',
                });
                return res.status(401).json({
                    success: false,
                    error: 'Passkey not recognized. Please register first.',
                });
            }

            // Get expected origins and RP IDs
            const expectedOrigins = getExpectedOrigins(req);
            const expectedRpIds = getExpectedRpIds(req);

            if (!expectedOrigins.length || !expectedRpIds.length) {
                return res.status(500).json({
                    success: false,
                    error: 'Server configuration error',
                });
            }

            // Convert stored credential data
            const credentialIdBuffer = base64urlToBuffer(credential.credentialId);
            const publicKeyBuffer = base64urlToBuffer(credential.publicKey);

            if (!credentialIdBuffer || !publicKeyBuffer) {
                return res.status(500).json({
                    success: false,
                    error: 'Stored credential is invalid',
                });
            }

            // Verify authentication response
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
                            userHandle: userHandle ? sanitizeString(userHandle, 512) : undefined,
                        },
                        clientExtensionResults: {},
                    },
                    expectedChallenge,
                    expectedOrigin: expectedOrigins,
                    expectedRPID: expectedRpIds,
                    credential: {
                        id: credentialIdBuffer,
                        publicKey: publicKeyBuffer,
                        counter: credential.counter || 0,
                        transports: credential.transports,
                    },
                    requireUserVerification: true,
                });
            } catch (error) {
                await recordFailedAttempt(clientIp);
                console.error('[PasskeyAuth] Verification failed:', error);
                addAuditEntry({
                    action: 'PASSKEY_AUTH_VERIFICATION_FAILED',
                    ip: clientIp,
                    success: false,
                    endpoint: '/api/passkey-authenticate',
                    error: error.message,
                });
                return res.status(401).json({
                    success: false,
                    error: 'Authentication verification failed',
                });
            }

            if (!verification?.verified || !verification.authenticationInfo) {
                await recordFailedAttempt(clientIp);
                return res.status(401).json({
                    success: false,
                    error: 'Authentication verification failed',
                });
            }

            // Clear failed attempts on success
            await clearFailedAttempts(clientIp);

            // Update credential counter
            const newCounter =
                typeof verification.authenticationInfo.newCounter === 'number'
                    ? verification.authenticationInfo.newCounter
                    : credential.counter;
            await updateCredentialUsage(sanitizedCredentialId, newCounter);

            // Get user info
            const user = await getUserById(credential.userId);
            if (!user) {
                return res.status(500).json({
                    success: false,
                    error: 'User not found',
                });
            }

            // Generate session token
            const sessionToken = generateSessionToken(user.id, user.email);

            addAuditEntry({
                action: 'PASSKEY_AUTH_SUCCESS',
                ip: clientIp,
                success: true,
                endpoint: '/api/passkey-authenticate',
                userId: user.id.substring(0, 8) + '...',
            });

            return res.status(200).json({
                success: true,
                verified: true,
                message: 'Welcome back!',
                userId: user.id,
                email: user.email,
                displayName: user.displayName,
                sessionToken,
                expiresIn: Math.floor(CONFIG.SESSION_DURATION / 1000),
            });
        }

        // ====================================
        // CHECK IF USER HAS PASSKEYS
        // ====================================
        if (action === 'check-user') {
            const { email } = validatedBody;

            if (!email || typeof email !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required',
                });
            }

            const normalizedEmail = sanitizeString(email.toLowerCase().trim(), 256);
            const user = await getUserByEmail(normalizedEmail);

            if (!user) {
                return res.status(200).json({
                    success: true,
                    hasPasskeys: false,
                    message: 'No account found. Register a passkey to continue.',
                });
            }

            const credentials = await getUserCredentials(user.id);

            return res.status(200).json({
                success: true,
                hasPasskeys: credentials.length > 0,
                passkeyCount: credentials.length,
                message: credentials.length > 0
                    ? 'Passkeys found. Ready to authenticate.'
                    : 'Account exists but no passkeys registered.',
            });
        }

        // ====================================
        // LOGOUT - Clear Session
        // ====================================
        if (action === 'logout') {
            // Sessions are stateless (JWT-like), so logout is client-side
            // This endpoint is mainly for audit logging
            const { sessionToken } = validatedBody;

            if (sessionToken) {
                const payload = verifySessionToken(sessionToken);
                if (payload) {
                    addAuditEntry({
                        action: 'PASSKEY_LOGOUT',
                        ip: clientIp,
                        success: true,
                        endpoint: '/api/passkey-authenticate',
                        userId: payload.sub.substring(0, 8) + '...',
                    });
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Logged out successfully',
            });
        }

        return res.status(400).json({
            success: false,
            error: 'Invalid action',
        });
    } catch (error) {
        console.error('[PasskeyAuth] Error:', error);
        addAuditEntry({
            action: 'PASSKEY_AUTH_ERROR',
            ip: clientIp,
            success: false,
            endpoint: '/api/passkey-authenticate',
            error: error.message,
        });
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
};

module.exports = createSecuredHandler(
    {
        requireAuth: false,
        allowedMethods: ['POST', 'OPTIONS'],
        rateLimit: {
            limit: RATE_LIMIT.limit,
            windowMs: RATE_LIMIT.windowMs,
            keyPrefix: 'passkey-auth',
        },
    },
    passkeyAuthHandler
);
