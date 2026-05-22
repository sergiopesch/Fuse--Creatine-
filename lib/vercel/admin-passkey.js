const crypto = require('crypto');
const {
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} = require('@simplewebauthn/server');
const {
    setSecurityHeaders,
    getCorsOrigin,
    getClientIp,
    getRequestHost,
    addAuditEntry,
    sanitizeString,
} = require('../../api/_lib/security');
const {
    base64urlToBuffer,
    bufferToBase64url,
    getExpectedOrigins,
    getExpectedRpIds,
} = require('../../api/_lib/webauthn');
const {
    authenticateAdminRequest,
    createAdminSession,
    getAdminUsername,
    verifyAdminCredentials,
} = require('../../api/_lib/admin-auth');
const {
    generateAdminPasskeyChallenge,
    storeAdminPasskeyChallenge,
    consumeAdminPasskeyChallenge,
    getAdminPasskeyCredentials,
    getAdminPasskeyCredential,
    storeAdminPasskeyCredential,
    updateAdminPasskeyUsage,
} = require('../../api/_lib/admin-passkey-store');

const SESSION_SECONDS = 8 * 60 * 60;

function getAdminUserId() {
    return `fuse-admin-${getAdminUsername()}`;
}

function getRequestRpId(req) {
    return getExpectedRpIds(req)[0] || '';
}

function getCredentialName(req) {
    const ua = req.headers['user-agent'] || '';
    if (/iPhone|iPad/i.test(ua)) return 'iPhone/iPad Passkey';
    if (/Android/i.test(ua)) return 'Android Passkey';
    if (/Mac/i.test(ua)) return 'Mac Passkey';
    if (/Windows/i.test(ua)) return 'Windows Passkey';
    return 'Admin Passkey';
}

function getPublicCredentialDescriptor(credential) {
    return {
        id: credential.credentialId,
        type: 'public-key',
        transports: credential.transports || ['internal', 'hybrid'],
    };
}

function isAuthenticatedAdmin(req) {
    return authenticateAdminRequest(req).authenticated;
}

function verifySetupCredentials(req) {
    if (isAuthenticatedAdmin(req)) {
        return { ok: true, username: getAdminUsername(), method: 'session' };
    }

    const result = verifyAdminCredentials(req.body?.username, req.body?.password);
    if (!result.ok) return result;

    return { ok: true, username: result.username, method: 'password' };
}

async function createAdminSessionResponse(req, res, action, extraData = {}) {
    const token = createAdminSession(getAdminUsername());
    addAuditEntry({
        action,
        ip: getClientIp(req),
        success: true,
        endpoint: '/api/admin-passkey',
    });

    return res.status(200).json({
        success: true,
        data: {
            token,
            username: getAdminUsername(),
            expiresInSeconds: SESSION_SECONDS,
            ...extraData,
        },
    });
}

async function handleStatus(_req, res) {
    const credentials = await getAdminPasskeyCredentials();
    return res.status(200).json({
        success: true,
        data: {
            username: getAdminUsername(),
            registered: credentials.length > 0,
            passkeyCount: credentials.length,
            passwordConfigured: Boolean(process.env.ADMIN_PASSWORD_HASH),
        },
    });
}

async function handleRegisterStart(req, res) {
    const setupResult = verifySetupCredentials(req);
    if (!setupResult.ok) {
        addAuditEntry({
            action: 'ADMIN_PASSKEY_REGISTER_DENIED',
            ip: getClientIp(req),
            success: false,
            endpoint: '/api/admin-passkey',
        });
        return res.status(setupResult.error?.includes('not configured') ? 500 : 401).json({
            success: false,
            error: setupResult.error || 'Admin authorization required',
            code: 'UNAUTHORIZED',
        });
    }

    const credentials = await getAdminPasskeyCredentials();
    if (credentials.length >= 5) {
        return res.status(400).json({
            success: false,
            error: 'Maximum admin passkeys reached',
        });
    }

    const challenge = generateAdminPasskeyChallenge();
    const sessionId = crypto.randomBytes(16).toString('hex');
    await storeAdminPasskeyChallenge(sessionId, challenge, 'register', {
        username: setupResult.username,
    });

    addAuditEntry({
        action: 'ADMIN_PASSKEY_REGISTER_STARTED',
        ip: getClientIp(req),
        success: true,
        endpoint: '/api/admin-passkey',
        method: setupResult.method,
    });

    return res.status(200).json({
        success: true,
        data: {
            challenge,
            sessionId,
            rp: {
                name: 'FUSE Admin',
                id: getRequestRpId(req),
            },
            user: {
                id: getAdminUserId(),
                name: getAdminUsername(),
                displayName: 'FUSE Admin',
            },
            excludeCredentials: credentials.map(getPublicCredentialDescriptor),
        },
    });
}

async function handleRegisterComplete(req, res) {
    const {
        sessionId,
        credentialId,
        rawId,
        type,
        clientDataJSON,
        attestationObject,
        transports,
        authenticatorAttachment,
    } = req.body || {};

    if (!sessionId || !credentialId || !clientDataJSON || !attestationObject) {
        return res.status(400).json({
            success: false,
            error: 'Missing passkey registration data',
        });
    }

    const challengeEntry = await consumeAdminPasskeyChallenge(
        sanitizeString(sessionId, 128),
        'register'
    );
    if (!challengeEntry || challengeEntry.metadata?.username !== getAdminUsername()) {
        return res.status(400).json({
            success: false,
            error: 'Invalid or expired passkey setup challenge',
        });
    }

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
            expectedChallenge: challengeEntry.challenge,
            expectedOrigin: getExpectedOrigins(req),
            expectedRPID: getExpectedRpIds(req),
            requireUserVerification: true,
        });
    } catch (error) {
        console.error('[AdminPasskey] Registration verification failed:', error);
        return res.status(400).json({
            success: false,
            error: 'Passkey setup could not be verified',
        });
    }

    if (!verification?.verified || !verification.registrationInfo) {
        return res.status(400).json({
            success: false,
            error: 'Passkey setup could not be verified',
        });
    }

    const regInfo = verification.registrationInfo;
    const credentialPublicKey = regInfo.credential?.publicKey || regInfo.credentialPublicKey;
    const verifiedCredentialId = regInfo.credential?.id || regInfo.credentialID;
    const counter = regInfo.credential?.counter ?? regInfo.counter ?? 0;

    if (!credentialPublicKey || !verifiedCredentialId) {
        return res.status(400).json({
            success: false,
            error: 'Passkey registration data is incomplete',
        });
    }

    const storedCredentialId =
        typeof verifiedCredentialId === 'string'
            ? verifiedCredentialId
            : bufferToBase64url(verifiedCredentialId);
    const storedPublicKey =
        typeof credentialPublicKey === 'string'
            ? credentialPublicKey
            : bufferToBase64url(credentialPublicKey);

    try {
        await storeAdminPasskeyCredential({
            credentialId: storedCredentialId,
            publicKey: storedPublicKey,
            counter,
            username: getAdminUsername(),
            transports: Array.isArray(transports) ? transports : ['internal', 'hybrid'],
            name: getCredentialName(req),
            credentialDeviceType: regInfo.credentialDeviceType,
            credentialBackedUp: regInfo.credentialBackedUp,
            createdAt: new Date().toISOString(),
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message || 'Unable to store admin passkey',
        });
    }

    return createAdminSessionResponse(req, res, 'ADMIN_PASSKEY_REGISTERED', {
        credentialId: storedCredentialId,
        credentialName: getCredentialName(req),
        backedUp: Boolean(regInfo.credentialBackedUp),
    });
}

async function handleAuthStart(req, res) {
    const credentials = await getAdminPasskeyCredentials();
    if (!credentials.length) {
        return res.status(404).json({
            success: false,
            error: 'No admin passkey is registered yet',
            setupRequired: true,
        });
    }

    const challenge = generateAdminPasskeyChallenge();
    const sessionId = crypto.randomBytes(16).toString('hex');
    await storeAdminPasskeyChallenge(sessionId, challenge, 'authenticate');

    addAuditEntry({
        action: 'ADMIN_PASSKEY_AUTH_STARTED',
        ip: getClientIp(req),
        success: true,
        endpoint: '/api/admin-passkey',
    });

    return res.status(200).json({
        success: true,
        data: {
            challenge,
            sessionId,
            rpId: getRequestRpId(req),
            allowCredentials: credentials.map(getPublicCredentialDescriptor),
            userVerification: 'required',
        },
    });
}

async function handleAuthComplete(req, res) {
    const {
        sessionId,
        credentialId,
        rawId,
        type,
        authenticatorData,
        clientDataJSON,
        signature,
        userHandle,
    } = req.body || {};

    if (!sessionId || !credentialId || !authenticatorData || !clientDataJSON || !signature) {
        return res.status(400).json({
            success: false,
            error: 'Missing passkey authentication data',
        });
    }

    const challengeEntry = await consumeAdminPasskeyChallenge(
        sanitizeString(sessionId, 128),
        'authenticate'
    );
    if (!challengeEntry) {
        return res.status(400).json({
            success: false,
            error: 'Invalid or expired passkey challenge',
        });
    }

    const sanitizedCredentialId = sanitizeString(credentialId, 512);
    const credential = await getAdminPasskeyCredential(sanitizedCredentialId);
    if (!credential) {
        addAuditEntry({
            action: 'ADMIN_PASSKEY_CREDENTIAL_NOT_FOUND',
            ip: getClientIp(req),
            success: false,
            endpoint: '/api/admin-passkey',
        });
        return res.status(401).json({
            success: false,
            error: 'Admin passkey not recognized',
        });
    }

    const credentialIdBuffer = base64urlToBuffer(credential.credentialId);
    const publicKeyBuffer = base64urlToBuffer(credential.publicKey);
    if (!credentialIdBuffer || !publicKeyBuffer) {
        return res.status(500).json({
            success: false,
            error: 'Stored admin passkey is invalid',
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
                    userHandle: userHandle ? sanitizeString(userHandle, 512) : undefined,
                },
                clientExtensionResults: {},
            },
            expectedChallenge: challengeEntry.challenge,
            expectedOrigin: getExpectedOrigins(req),
            expectedRPID: getExpectedRpIds(req),
            credential: {
                id: credentialIdBuffer,
                publicKey: publicKeyBuffer,
                counter: credential.counter || 0,
                transports: credential.transports,
            },
            requireUserVerification: true,
        });
    } catch (error) {
        console.error('[AdminPasskey] Authentication verification failed:', error);
        return res.status(401).json({
            success: false,
            error: 'Passkey authentication failed',
        });
    }

    if (!verification?.verified || !verification.authenticationInfo) {
        return res.status(401).json({
            success: false,
            error: 'Passkey authentication failed',
        });
    }

    const newCounter =
        typeof verification.authenticationInfo.newCounter === 'number'
            ? verification.authenticationInfo.newCounter
            : credential.counter;
    await updateAdminPasskeyUsage(sanitizedCredentialId, newCounter);

    return createAdminSessionResponse(req, res, 'ADMIN_PASSKEY_AUTH_SUCCESS', {
        credentialId: sanitizedCredentialId,
    });
}

module.exports = async (req, res) => {
    const origin = getCorsOrigin(req.headers.origin, getRequestHost(req));
    setSecurityHeaders(res, origin, 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.headers.origin && !origin) {
        return res.status(403).json({
            success: false,
            error: 'Origin not allowed',
            code: 'CORS_ERROR',
        });
    }

    if (req.method === 'GET') {
        return handleStatus(req, res);
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED',
        });
    }

    try {
        const action = sanitizeString(req.body?.action, 64);

        if (action === 'register-start') return handleRegisterStart(req, res);
        if (action === 'register-complete') return handleRegisterComplete(req, res);
        if (action === 'auth-start') return handleAuthStart(req, res);
        if (action === 'auth-complete') return handleAuthComplete(req, res);

        return res.status(400).json({
            success: false,
            error: 'Invalid admin passkey action',
        });
    } catch (error) {
        console.error('[AdminPasskey] Error:', error);
        addAuditEntry({
            action: 'ADMIN_PASSKEY_ERROR',
            ip: getClientIp(req),
            success: false,
            endpoint: '/api/admin-passkey',
            error: error.message,
        });
        return res.status(500).json({
            success: false,
            error: 'Admin passkey request failed',
        });
    }
};
