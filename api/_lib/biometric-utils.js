/**
 * FUSE Biometric Utilities
 * Shared utilities for biometric authentication and registration
 *
 * @version 1.1.0 - Use Redis for challenges, Blob only for credentials
 */

const crypto = require('crypto');
const { list, put } = require('@vercel/blob');
const { Redis } = require('@upstash/redis');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    CHALLENGE_EXPIRY: 5 * 60 * 1000, // 5 minutes
    CHALLENGE_EXPIRY_SECONDS: 300, // 5 minutes in seconds for Redis
    BLOB_PREFIX: 'biometric-credentials/',
    CHALLENGE_PREFIX: 'biometric:challenge:',
    DEVICE_LINK_PREFIX: 'biometric:devicelink:',
    OWNER_CREDENTIAL_KEY: 'owner-credential.json',
    DEVICE_LINK_EXPIRY: 5 * 60 * 1000, // 5 minutes for device link codes
    MAX_AUTHORIZED_DEVICES: 5,
};

// Initialize Redis client
const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? Redis.fromEnv()
        : null;

if (!redis) {
    console.warn('[BiometricUtils] Redis not configured - challenges will use in-memory fallback');
}

// In-memory fallback for challenges (for development/testing)
const challengeStore = new Map();

// ============================================================================
// DEVICE FINGERPRINTING
// ============================================================================

/**
 * Create device fingerprint from client-provided deviceId (stable method)
 * @param {string} clientDeviceId - Client-provided device identifier
 * @returns {string|null} - Hashed fingerprint or null if invalid input
 */
function createClientFingerprint(clientDeviceId) {
    if (!clientDeviceId || typeof clientDeviceId !== 'string' || clientDeviceId.length < 16) {
        return null;
    }
    return crypto
        .createHash('sha256')
        .update(`client:${clientDeviceId}`)
        .digest('hex')
        .substring(0, 32);
}

/**
 * Create device fingerprint from HTTP headers (legacy fallback)
 * @param {object} req - HTTP request object
 * @returns {string} - Hashed fingerprint
 */
function createHeaderFingerprint(req) {
    const ua = req.headers['user-agent'] || '';
    const acceptLang = req.headers['accept-language'] || '';
    const acceptEnc = req.headers['accept-encoding'] || '';

    return crypto
        .createHash('sha256')
        .update(`${ua}|${acceptLang}|${acceptEnc}`)
        .digest('hex')
        .substring(0, 32);
}

/**
 * Create device fingerprint from request
 * Prefers client-provided deviceId for stability across browser updates
 * Falls back to header-based fingerprint for backwards compatibility
 * @param {object} req - HTTP request object
 * @param {string|null} clientDeviceId - Client-provided device identifier
 * @returns {string} - Device fingerprint
 */
function createDeviceFingerprint(req, clientDeviceId = null) {
    const clientFp = createClientFingerprint(clientDeviceId);
    if (clientFp) {
        return clientFp;
    }
    return createHeaderFingerprint(req);
}

/**
 * Check if a device matches any of the authorized devices (with migration support)
 * Supports both legacy single fingerprint and new multi-device array
 * @param {object} req - HTTP request object
 * @param {string|null} clientDeviceId - Client-provided device identifier
 * @param {object} ownerCredential - Stored owner credential
 * @returns {{ matches: boolean, needsMigration: boolean, fingerprint: string }}
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

// ============================================================================
// CREDENTIAL MANAGEMENT
// ============================================================================

/**
 * Normalize stored credentials into a list (supports legacy single credential)
 * @param {object} ownerCredential - Stored owner credential
 * @returns {Array} - Array of credential objects
 */
function normalizeCredentials(ownerCredential) {
    if (!ownerCredential) return [];
    if (Array.isArray(ownerCredential.credentials) && ownerCredential.credentials.length) {
        return ownerCredential.credentials;
    }

    if (ownerCredential.credentialId && ownerCredential.publicKey) {
        return [
            {
                credentialId: ownerCredential.credentialId,
                publicKey: ownerCredential.publicKey,
                counter: ownerCredential.counter || 0,
                transports: ownerCredential.transports || [],
                createdAt: ownerCredential.registeredAt || new Date().toISOString(),
                lastUsed: ownerCredential.lastUsed || null,
                legacy: true,
            },
        ];
    }

    return [];
}

/**
 * Get the owner credential from Redis (primary) or Vercel Blob (backup)
 * Returns { credential, error } to distinguish between "no owner" and "service error"
 * @returns {Promise<{ credential: object|null, error: string|null }>}
 */
async function getOwnerCredential() {
    const redisKey = 'biometric:owner:credential';

    // Try Redis first (primary storage)
    if (redis) {
        try {
            const data = await redis.get(redisKey);
            console.log('[BiometricUtils] Redis get result:', data ? 'found' : 'not found');

            if (data) {
                const credential = typeof data === 'string' ? JSON.parse(data) : data;
                return { credential, error: null };
            }
            // Data not in Redis, continue to check Blob
        } catch (error) {
            console.warn('[BiometricUtils] Redis get failed:', error.message);
            // Continue to Blob as fallback
        }
    }

    // Try Vercel Blob (backup storage) - but don't fail if unavailable
    try {
        const { blobs } = await list({ prefix: CONFIG.BLOB_PREFIX });
        const blob = blobs.find(
            b => b.pathname === `${CONFIG.BLOB_PREFIX}${CONFIG.OWNER_CREDENTIAL_KEY}`
        );

        if (!blob) {
            console.log('[BiometricUtils] No owner credential in Blob');
            return { credential: null, error: null }; // No owner yet
        }

        const response = await fetch(blob.url);
        if (!response.ok) {
            console.error('[BiometricUtils] Blob fetch failed:', response.status);
            // Blob had a file but couldn't fetch - still return null to allow re-registration
            return { credential: null, error: null };
        }

        const credential = await response.json();
        console.log('[BiometricUtils] Owner credential loaded from Blob');

        // Cache in Redis for faster access next time
        if (redis) {
            try {
                await redis.set(redisKey, JSON.stringify(credential));
                console.log('[BiometricUtils] Cached credential in Redis');
            } catch (e) {
                console.warn('[BiometricUtils] Failed to cache in Redis:', e.message);
            }
        }

        return { credential, error: null };
    } catch (error) {
        console.warn('[BiometricUtils] Blob unavailable:', error.message);
        // Blob storage not configured - that's OK, we'll use Redis only
        return { credential: null, error: null };
    }
}

/**
 * Store or update owner credential in Redis (primary) and Vercel Blob (backup)
 * @param {object} credentialData - Credential data to store
 * @returns {Promise<boolean>} - Success status
 */
async function storeOwnerCredential(credentialData) {
    const redisKey = 'biometric:owner:credential';
    const dataString = JSON.stringify(credentialData);
    let storedInRedis = false;
    let storedInBlob = false;

    // Store in Redis (primary storage)
    if (redis) {
        try {
            await redis.set(redisKey, dataString);
            storedInRedis = true;
            console.log('[BiometricUtils] Owner credential stored in Redis');

            // Verify it was stored
            const verify = await redis.get(redisKey);
            console.log('[BiometricUtils] Redis verify:', verify ? 'confirmed' : 'FAILED');
        } catch (error) {
            console.error('[BiometricUtils] Redis store failed:', error.message);
        }
    } else {
        console.warn('[BiometricUtils] Redis not available for storing credential');
    }

    // Also try to store in Blob (backup) - but don't fail if unavailable
    try {
        const blobPath = `${CONFIG.BLOB_PREFIX}${CONFIG.OWNER_CREDENTIAL_KEY}`;
        await put(blobPath, dataString, {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
        });
        storedInBlob = true;
        console.log('[BiometricUtils] Owner credential stored in Blob');
    } catch (error) {
        console.warn('[BiometricUtils] Blob store failed (non-critical):', error.message);
    }

    const success = storedInRedis || storedInBlob;
    console.log(
        '[BiometricUtils] Store result - Redis:',
        storedInRedis,
        'Blob:',
        storedInBlob,
        'Success:',
        success
    );
    return success;
}

// ============================================================================
// CHALLENGE MANAGEMENT
// ============================================================================

/**
 * Generate a cryptographically secure challenge
 * @returns {string} - Base64url encoded challenge
 */
function generateChallenge() {
    const challenge = crypto.randomBytes(32);
    return challenge.toString('base64url');
}

/**
 * Generate a unique nonce for anti-replay
 * @returns {string} - Hex-encoded nonce
 */
function generateNonce() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Store challenge for verification using Vercel Blob
 * @param {string} key - Challenge key (typically device fingerprint)
 * @param {string} challenge - The challenge to store
 * @param {string} nonce - Optional nonce for anti-replay (registration only)
 * @param {string} prefix - 'auth' or 'reg' to differentiate challenge types
 * @returns {Promise<boolean>} - Success status
 */
async function storeChallenge(key, challenge, nonce = null, prefix = 'auth') {
    const redisKey = `${CONFIG.CHALLENGE_PREFIX}${prefix}:${key}`;
    const data = {
        challenge,
        createdAt: Date.now(),
    };
    if (nonce) {
        data.nonce = nonce;
    }

    // Try Redis first
    if (redis) {
        try {
            await redis.setex(redisKey, CONFIG.CHALLENGE_EXPIRY_SECONDS, JSON.stringify(data));
            console.log('[BiometricUtils] Challenge stored in Redis:', redisKey);
            return true;
        } catch (error) {
            console.error('[BiometricUtils] Redis store failed:', error.message);
            // Fall through to in-memory
        }
    }

    // Fallback to in-memory store
    challengeStore.set(redisKey, { ...data, expiresAt: Date.now() + CONFIG.CHALLENGE_EXPIRY });
    console.log('[BiometricUtils] Challenge stored in memory:', redisKey);

    // Clean up old entries
    for (const [k, v] of challengeStore) {
        if (v.expiresAt < Date.now()) {
            challengeStore.delete(k);
        }
    }

    return true;
}

/**
 * Verify and consume challenge from Redis or in-memory store
 * @param {string} key - Challenge key (typically device fingerprint)
 * @param {string} prefix - 'auth' or 'reg' to differentiate challenge types
 * @returns {Promise<object|null>} - Challenge data or null if invalid/expired
 */
async function verifyChallenge(key, prefix = 'auth') {
    const redisKey = `${CONFIG.CHALLENGE_PREFIX}${prefix}:${key}`;

    // Try Redis first
    if (redis) {
        try {
            const data = await redis.get(redisKey);
            if (data) {
                // Delete the challenge (consume it - one-time use)
                await redis.del(redisKey);

                const entry = typeof data === 'string' ? JSON.parse(data) : data;
                console.log('[BiometricUtils] Challenge verified from Redis:', redisKey);

                // Check expiry (belt and suspenders - Redis TTL should handle this)
                if (Date.now() - entry.createdAt > CONFIG.CHALLENGE_EXPIRY) {
                    return null;
                }

                // Return full entry for registration (includes nonce), just challenge for auth
                return prefix === 'reg' ? entry : entry.challenge;
            }
        } catch (error) {
            console.error('[BiometricUtils] Redis verify failed:', error.message);
            // Fall through to in-memory
        }
    }

    // Fallback to in-memory store
    const entry = challengeStore.get(redisKey);
    if (entry) {
        challengeStore.delete(redisKey); // Consume it

        if (entry.expiresAt < Date.now()) {
            return null; // Expired
        }

        console.log('[BiometricUtils] Challenge verified from memory:', redisKey);
        return prefix === 'reg' ? entry : entry.challenge;
    }

    console.log('[BiometricUtils] Challenge not found:', redisKey);
    return null;
}

// ============================================================================
// DEVICE LINK MANAGEMENT
// ============================================================================

/**
 * Generate a 6-character device link code (uppercase alphanumeric)
 * @returns {string} - Device link code
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
 * Store device link for later claim (uses Redis)
 * @param {string} code - Device link code
 * @param {string} ownerUserId - Owner's user ID
 * @param {string} createdByFingerprint - Fingerprint of device that created the link
 * @returns {Promise<boolean>} - Success status
 */
async function storeDeviceLink(code, ownerUserId, createdByFingerprint) {
    const redisKey = `${CONFIG.DEVICE_LINK_PREFIX}${code}`;
    const data = {
        code,
        ownerUserId,
        createdByFingerprint,
        createdAt: Date.now(),
        claimed: false,
    };

    if (redis) {
        try {
            await redis.setex(
                redisKey,
                Math.ceil(CONFIG.DEVICE_LINK_EXPIRY / 1000),
                JSON.stringify(data)
            );
            return true;
        } catch (error) {
            console.error('[BiometricUtils] Failed to store device link:', error);
            return false;
        }
    }

    // In-memory fallback
    challengeStore.set(redisKey, { ...data, expiresAt: Date.now() + CONFIG.DEVICE_LINK_EXPIRY });
    return true;
}

/**
 * Get and validate device link (uses Redis)
 * @param {string} code - Device link code
 * @returns {Promise<object|null>} - Device link data or null if invalid/expired
 */
async function getDeviceLink(code) {
    const redisKey = `${CONFIG.DEVICE_LINK_PREFIX}${code}`;

    if (redis) {
        try {
            const data = await redis.get(redisKey);
            if (!data) return null;

            const parsed = typeof data === 'string' ? JSON.parse(data) : data;

            if (parsed.claimed) {
                return null; // Already used
            }

            return parsed;
        } catch (error) {
            console.error('[BiometricUtils] Failed to get device link:', error);
            return null;
        }
    }

    // In-memory fallback
    const entry = challengeStore.get(redisKey);
    if (entry && entry.expiresAt > Date.now() && !entry.claimed) {
        return entry;
    }
    return null;
}

/**
 * Delete device link after use (uses Redis)
 * @param {string} code - Device link code
 * @returns {Promise<void>}
 */
async function deleteDeviceLink(code) {
    const redisKey = `${CONFIG.DEVICE_LINK_PREFIX}${code}`;

    if (redis) {
        try {
            await redis.del(redisKey);
        } catch (error) {
            console.error('[BiometricUtils] Failed to delete device link:', error);
        }
    } else {
        challengeStore.delete(redisKey);
    }
}

/**
 * Add a new device to the authorized devices list
 * @param {object} ownerCredential - Owner credential object
 * @param {string} newFingerprint - New device fingerprint
 * @param {string} deviceName - Human-readable device name
 * @returns {Promise<{ success: boolean, error?: string, deviceCount?: number }>}
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
                addedAt: ownerCredential.registeredAt || new Date().toISOString(),
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
        addedAt: new Date().toISOString(),
    });

    // Save updated credential
    const saved = await storeOwnerCredential(ownerCredential);
    if (!saved) {
        return { success: false, error: 'Failed to save device' };
    }

    return { success: true, deviceCount: ownerCredential.authorizedDevices.length };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Configuration
    CONFIG,

    // Device fingerprinting
    createClientFingerprint,
    createHeaderFingerprint,
    createDeviceFingerprint,
    checkDeviceMatch,

    // Credential management
    normalizeCredentials,
    getOwnerCredential,
    storeOwnerCredential,

    // Challenge management
    generateChallenge,
    generateNonce,
    storeChallenge,
    verifyChallenge,

    // Device link management
    generateDeviceLinkCode,
    storeDeviceLink,
    getDeviceLink,
    deleteDeviceLink,
    addAuthorizedDevice,
};
