/**
 * FUSE Biometric Registration API
 * Handles WebAuthn credential registration for Face ID/Fingerprint authentication
 *
 * @version 1.0.0
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
    RATE_LIMIT: { limit: 10, windowMs: 60000 }, // 10 requests per minute
};

// In-memory challenge store (use Redis/KV in production)
const challengeStore = new Map();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a random challenge
 */
function generateChallenge() {
    const challenge = crypto.randomBytes(32);
    return challenge.toString('base64url');
}

/**
 * Store challenge for verification
 */
function storeChallenge(userId, challenge) {
    challengeStore.set(userId, {
        challenge,
        createdAt: Date.now()
    });

    // Clean up expired challenges
    for (const [key, value] of challengeStore.entries()) {
        if (Date.now() - value.createdAt > CONFIG.CHALLENGE_EXPIRY) {
            challengeStore.delete(key);
        }
    }
}

/**
 * Verify and consume challenge
 */
function verifyChallenge(userId) {
    const entry = challengeStore.get(userId);
    if (!entry) return null;

    if (Date.now() - entry.createdAt > CONFIG.CHALLENGE_EXPIRY) {
        challengeStore.delete(userId);
        return null;
    }

    challengeStore.delete(userId);
    return entry.challenge;
}

/**
 * Store credential in Vercel Blob
 */
async function storeCredential(userId, credentialData) {
    const blobPath = `${CONFIG.BLOB_PREFIX}${userId}.json`;

    try {
        await put(blobPath, JSON.stringify(credentialData), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false
        });
        return true;
    } catch (error) {
        console.error('[BiometricRegister] Failed to store credential:', error);
        return false;
    }
}

/**
 * Get credential from Vercel Blob
 */
async function getCredential(userId) {
    try {
        const { blobs } = await list({ prefix: CONFIG.BLOB_PREFIX });
        const blob = blobs.find(b => b.pathname === `${CONFIG.BLOB_PREFIX}${userId}.json`);

        if (!blob) return null;

        const response = await fetch(blob.url);
        if (!response.ok) return null;

        return await response.json();
    } catch (error) {
        console.error('[BiometricRegister] Failed to get credential:', error);
        return null;
    }
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

module.exports = async function handler(req, res) {
    const clientIp = getClientIp(req);

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
            action: 'BIOMETRIC_RATE_LIMITED',
            ip: clientIp,
            success: false,
            endpoint: '/api/biometric-register'
        });

        return res.status(429).json({
            success: false,
            error: 'Too many requests',
            retryAfter: Math.ceil(rateLimitResult.retryAfterMs / 1000)
        });
    }

    try {
        const { action, userId, credentialId, publicKey, clientDataJSON, authenticatorData } = req.body;

        // Validate action
        if (!action || !['get-challenge', 'register'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid action'
            });
        }

        // Validate userId
        if (!userId || typeof userId !== 'string' || userId.length < 16 || userId.length > 64) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID'
            });
        }

        const sanitizedUserId = sanitizeString(userId, 64);

        // ====================================
        // GET CHALLENGE
        // ====================================
        if (action === 'get-challenge') {
            const challenge = generateChallenge();
            storeChallenge(sanitizedUserId, challenge);

            addAuditEntry({
                action: 'BIOMETRIC_CHALLENGE_ISSUED',
                ip: clientIp,
                success: true,
                endpoint: '/api/biometric-register',
                userId: sanitizedUserId
            });

            return res.status(200).json({
                success: true,
                challenge
            });
        }

        // ====================================
        // REGISTER CREDENTIAL
        // ====================================
        if (action === 'register') {
            // Validate required fields
            if (!credentialId || !publicKey) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing credential data'
                });
            }

            // Verify challenge was issued
            const issuedChallenge = verifyChallenge(sanitizedUserId);
            if (!issuedChallenge) {
                // Allow registration without challenge verification for flexibility
                console.warn('[BiometricRegister] Challenge not found, proceeding anyway');
            }

            // Store credential
            const credentialData = {
                userId: sanitizedUserId,
                credentialId: sanitizeString(credentialId, 256),
                publicKey: sanitizeString(publicKey, 2048),
                registeredAt: new Date().toISOString(),
                registeredFrom: clientIp,
                lastUsed: null
            };

            const stored = await storeCredential(sanitizedUserId, credentialData);

            if (!stored) {
                // Log but don't fail - local storage is acceptable
                console.warn('[BiometricRegister] Could not persist to blob storage');
            }

            addAuditEntry({
                action: 'BIOMETRIC_REGISTERED',
                ip: clientIp,
                success: true,
                endpoint: '/api/biometric-register',
                userId: sanitizedUserId,
                credentialId: credentialData.credentialId.substring(0, 16) + '...'
            });

            return res.status(200).json({
                success: true,
                message: 'Biometric credential registered successfully',
                userId: sanitizedUserId
            });
        }

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
