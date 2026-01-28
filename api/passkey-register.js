/**
 * FUSE Passkey Registration API
 * Handles passkey (WebAuthn) credential registration
 *
 * Unlike the owner-lock biometric system, this allows:
 * - Multiple users with their own passkeys
 * - Passkeys that sync across devices
 * - No device fingerprint restrictions
 *
 * @version 1.0.0
 */

const crypto = require('crypto');
const { verifyRegistrationResponse } = require('@simplewebauthn/server');
const { bufferToBase64url, getExpectedOrigins, getExpectedRpIds } = require('./_lib/webauthn');
const { createSecuredHandler, addAuditEntry, sanitizeString } = require('./_lib/security');
const {
    CONFIG,
    generateChallenge,
    storeChallenge,
    verifyChallenge,
    generateUserId,
    getUserByEmail,
    getUserById,
    saveUser,
    storeCredential,
    addCredentialToUser,
    getUserCredentials,
    generateSessionToken,
} = require('./_lib/passkey-utils');

// ============================================================================
// CONFIGURATION
// ============================================================================

const RATE_LIMIT = { limit: 10, windowMs: 60000 }; // 10 requests per minute

// ============================================================================
// HANDLER
// ============================================================================

const passkeyRegisterHandler = async (req, res, { clientIp, validatedBody }) => {
    try {
        const { action } = validatedBody;

        // ====================================
        // START REGISTRATION - Get Challenge
        // ====================================
        if (action === 'start') {
            const { email, displayName } = validatedBody;

            if (!email || typeof email !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required',
                });
            }

            const normalizedEmail = sanitizeString(email.toLowerCase().trim(), 256);
            const name = sanitizeString(displayName || email.split('@')[0], 64);

            // Check if user exists
            let user = await getUserByEmail(normalizedEmail);
            let isNewUser = false;

            if (!user) {
                // Create new user
                isNewUser = true;
                user = {
                    id: generateUserId(),
                    email: normalizedEmail,
                    displayName: name,
                    credentialIds: [],
                    createdAt: new Date().toISOString(),
                };
                await saveUser(user);
                console.log('[PasskeyRegister] New user created:', user.id);
            }

            // Check credential limit
            const existingCredentials = await getUserCredentials(user.id);
            if (existingCredentials.length >= CONFIG.MAX_CREDENTIALS_PER_USER) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum passkeys limit reached. Please delete an existing passkey first.',
                });
            }

            // Generate challenge
            const challenge = generateChallenge();
            const sessionId = crypto.randomBytes(16).toString('hex');
            await storeChallenge(sessionId, challenge, 'register');

            addAuditEntry({
                action: 'PASSKEY_REGISTER_STARTED',
                ip: clientIp,
                success: true,
                endpoint: '/api/passkey-register',
                userId: user.id.substring(0, 8) + '...',
                isNewUser,
            });

            // Build excludeCredentials to prevent re-registering same authenticator
            const excludeCredentials = existingCredentials.map(cred => ({
                id: cred.credentialId,
                type: 'public-key',
                transports: cred.transports || ['internal', 'hybrid'],
            }));

            return res.status(200).json({
                success: true,
                challenge,
                sessionId,
                user: {
                    id: user.id,
                    name: user.displayName || user.email,
                    displayName: user.displayName || user.email,
                },
                excludeCredentials,
                isNewUser,
            });
        }

        // ====================================
        // COMPLETE REGISTRATION - Verify & Store
        // ====================================
        if (action === 'complete') {
            const {
                sessionId,
                userId,
                credentialId,
                rawId,
                type,
                clientDataJSON,
                attestationObject,
                transports,
                authenticatorAttachment,
            } = validatedBody;

            if (!sessionId || !userId || !credentialId || !clientDataJSON || !attestationObject) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required registration data',
                });
            }

            // Verify challenge
            const expectedChallenge = await verifyChallenge(sessionId, 'register');
            if (!expectedChallenge) {
                addAuditEntry({
                    action: 'PASSKEY_REGISTER_INVALID_CHALLENGE',
                    ip: clientIp,
                    success: false,
                    endpoint: '/api/passkey-register',
                });
                return res.status(400).json({
                    success: false,
                    error: 'Invalid or expired challenge. Please try again.',
                });
            }

            // Get user
            const user = await getUserById(sanitizeString(userId, 64));
            if (!user) {
                return res.status(400).json({
                    success: false,
                    error: 'User not found. Please start registration again.',
                });
            }

            // Get expected origins and RP IDs
            const expectedOrigins = getExpectedOrigins(req);
            const expectedRpIds = getExpectedRpIds(req);

            if (!expectedOrigins.length || !expectedRpIds.length) {
                console.error('[PasskeyRegister] Unable to resolve expected origin/RP ID');
                return res.status(500).json({
                    success: false,
                    error: 'Server configuration error',
                });
            }

            // Verify registration response
            let verification;
            try {
                verification = await verifyRegistrationResponse({
                    response: {
                        id: sanitizeString(credentialId, 512),
                        rawId: sanitizeString(rawId || credentialId, 512),
                        type: type || 'public-key',
                        response: {
                            clientDataJSON: sanitizeString(clientDataJSON, 4096),
                            attestationObject: sanitizeString(attestationObject, 8192),
                            transports: Array.isArray(transports) ? transports : undefined,
                        },
                        clientExtensionResults: {},
                        authenticatorAttachment: authenticatorAttachment || undefined,
                    },
                    expectedChallenge,
                    expectedOrigin: expectedOrigins,
                    expectedRPID: expectedRpIds,
                    requireUserVerification: true,
                });
            } catch (error) {
                console.error('[PasskeyRegister] Verification failed:', error);
                addAuditEntry({
                    action: 'PASSKEY_REGISTER_VERIFICATION_FAILED',
                    ip: clientIp,
                    success: false,
                    endpoint: '/api/passkey-register',
                    error: error.message,
                });
                return res.status(400).json({
                    success: false,
                    error: 'Passkey verification failed. Please try again.',
                });
            }

            if (!verification?.verified || !verification.registrationInfo) {
                return res.status(400).json({
                    success: false,
                    error: 'Passkey verification failed',
                });
            }

            // Extract credential info (support both old and new simplewebauthn API)
            const regInfo = verification.registrationInfo;
            const credentialPublicKey = regInfo.credential?.publicKey || regInfo.credentialPublicKey;
            const credentialID = regInfo.credential?.id || regInfo.credentialID;
            const counter = regInfo.credential?.counter ?? regInfo.counter ?? 0;

            if (!credentialPublicKey || !credentialID) {
                console.error('[PasskeyRegister] Missing credential data from verification');
                return res.status(400).json({
                    success: false,
                    error: 'Registration data incomplete',
                });
            }

            // Convert to base64url strings
            const credIdString =
                typeof credentialID === 'string' ? credentialID : bufferToBase64url(credentialID);
            const pubKeyString =
                typeof credentialPublicKey === 'string'
                    ? credentialPublicKey
                    : bufferToBase64url(credentialPublicKey);

            // Determine passkey name from user agent
            const ua = req.headers['user-agent'] || '';
            let passkeyName = 'Passkey';
            if (/iPhone|iPad/i.test(ua)) passkeyName = 'iPhone/iPad Passkey';
            else if (/Android/i.test(ua)) passkeyName = 'Android Passkey';
            else if (/Mac/i.test(ua)) passkeyName = 'Mac Passkey';
            else if (/Windows/i.test(ua)) passkeyName = 'Windows Passkey';

            // Store the credential
            const credentialData = {
                credentialId: credIdString,
                publicKey: pubKeyString,
                counter,
                userId: user.id,
                userEmail: user.email,
                transports: Array.isArray(transports) ? transports : ['internal', 'hybrid'],
                name: passkeyName,
                aaguid: regInfo.aaguid ? bufferToBase64url(regInfo.aaguid) : null,
                credentialDeviceType: regInfo.credentialDeviceType,
                credentialBackedUp: regInfo.credentialBackedUp,
                fmt: regInfo.fmt,
                createdAt: new Date().toISOString(),
            };

            await storeCredential(credIdString, credentialData);
            await addCredentialToUser(user.id, credIdString);

            // Generate session token
            const sessionToken = generateSessionToken(user.id, user.email);

            addAuditEntry({
                action: 'PASSKEY_REGISTERED',
                ip: clientIp,
                success: true,
                endpoint: '/api/passkey-register',
                userId: user.id.substring(0, 8) + '...',
                credentialId: credIdString.substring(0, 16) + '...',
                backedUp: regInfo.credentialBackedUp,
            });

            return res.status(200).json({
                success: true,
                message: 'Passkey registered successfully!',
                credentialId: credIdString,
                credentialName: passkeyName,
                backedUp: regInfo.credentialBackedUp || false,
                sessionToken,
                expiresIn: Math.floor(CONFIG.SESSION_DURATION / 1000),
            });
        }

        // ====================================
        // LIST USER'S PASSKEYS
        // ====================================
        if (action === 'list') {
            const { sessionToken } = validatedBody;

            if (!sessionToken) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
            }

            const { verifySessionToken } = require('./_lib/passkey-utils');
            const payload = verifySessionToken(sessionToken);

            if (!payload) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired session',
                });
            }

            const credentials = await getUserCredentials(payload.sub);

            const passkeys = credentials.map(cred => ({
                id: cred.credentialId,
                name: cred.name || 'Passkey',
                createdAt: cred.createdAt,
                lastUsed: cred.lastUsed,
                backedUp: cred.credentialBackedUp || false,
            }));

            return res.status(200).json({
                success: true,
                passkeys,
            });
        }

        // ====================================
        // DELETE A PASSKEY
        // ====================================
        if (action === 'delete') {
            const { sessionToken, credentialId: deleteCredentialId } = validatedBody;

            if (!sessionToken || !deleteCredentialId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required parameters',
                });
            }

            const { verifySessionToken, deleteCredential } = require('./_lib/passkey-utils');
            const payload = verifySessionToken(sessionToken);

            if (!payload) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired session',
                });
            }

            // Verify credential belongs to user
            const credentials = await getUserCredentials(payload.sub);
            const credential = credentials.find(c => c.credentialId === deleteCredentialId);

            if (!credential) {
                return res.status(404).json({
                    success: false,
                    error: 'Passkey not found',
                });
            }

            // Don't allow deleting last passkey
            if (credentials.length <= 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete your only passkey',
                });
            }

            await deleteCredential(deleteCredentialId, payload.sub);

            addAuditEntry({
                action: 'PASSKEY_DELETED',
                ip: clientIp,
                success: true,
                endpoint: '/api/passkey-register',
                userId: payload.sub.substring(0, 8) + '...',
            });

            return res.status(200).json({
                success: true,
                message: 'Passkey deleted',
            });
        }

        return res.status(400).json({
            success: false,
            error: 'Invalid action',
        });
    } catch (error) {
        console.error('[PasskeyRegister] Error:', error);
        addAuditEntry({
            action: 'PASSKEY_REGISTER_ERROR',
            ip: clientIp,
            success: false,
            endpoint: '/api/passkey-register',
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
            keyPrefix: 'passkey-register',
        },
    },
    passkeyRegisterHandler
);
