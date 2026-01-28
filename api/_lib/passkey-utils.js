/**
 * FUSE Passkey Utilities
 * Shared utilities for passkey (WebAuthn) authentication
 *
 * Unlike the owner-lock biometric system, passkeys:
 * - Sync across devices via iCloud Keychain, Google Password Manager, etc.
 * - Don't require strict device fingerprint matching
 * - Support multiple users with separate passkeys
 * - Use discoverable credentials (resident keys)
 *
 * @version 1.0.0
 */

const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    CHALLENGE_EXPIRY: 5 * 60 * 1000, // 5 minutes
    CHALLENGE_EXPIRY_SECONDS: 300,
    CHALLENGE_PREFIX: 'passkey:challenge:',
    CREDENTIAL_PREFIX: 'passkey:credential:',
    USER_PREFIX: 'passkey:user:',
    SESSION_DURATION: 30 * 60 * 1000, // 30 minutes
    MAX_CREDENTIALS_PER_USER: 10,
};

// Initialize Redis client
const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? Redis.fromEnv()
        : null;

// In-memory fallback stores
const challengeStore = new Map();
const credentialStore = new Map();
const userStore = new Map();

// ============================================================================
// CHALLENGE MANAGEMENT
// ============================================================================

/**
 * Generate a cryptographically secure challenge
 * @returns {string} - Base64url encoded challenge
 */
function generateChallenge() {
    return crypto.randomBytes(32).toString('base64url');
}

/**
 * Store challenge for verification
 * @param {string} sessionId - Unique session identifier
 * @param {string} challenge - The challenge to store
 * @param {string} type - 'register' or 'authenticate'
 * @returns {Promise<boolean>}
 */
async function storeChallenge(sessionId, challenge, type = 'authenticate') {
    const key = `${CONFIG.CHALLENGE_PREFIX}${type}:${sessionId}`;
    const data = {
        challenge,
        type,
        createdAt: Date.now(),
    };

    if (redis) {
        try {
            await redis.setex(key, CONFIG.CHALLENGE_EXPIRY_SECONDS, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('[PasskeyUtils] Redis store challenge failed:', error.message);
        }
    }

    // In-memory fallback
    challengeStore.set(key, { ...data, expiresAt: Date.now() + CONFIG.CHALLENGE_EXPIRY });
    return true;
}

/**
 * Verify and consume a challenge
 * @param {string} sessionId - Session identifier
 * @param {string} type - 'register' or 'authenticate'
 * @returns {Promise<string|null>} - The challenge or null if invalid
 */
async function verifyChallenge(sessionId, type = 'authenticate') {
    const key = `${CONFIG.CHALLENGE_PREFIX}${type}:${sessionId}`;

    if (redis) {
        try {
            const data = await redis.get(key);
            if (data) {
                await redis.del(key);
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                if (Date.now() - parsed.createdAt <= CONFIG.CHALLENGE_EXPIRY) {
                    return parsed.challenge;
                }
            }
        } catch (error) {
            console.error('[PasskeyUtils] Redis verify challenge failed:', error.message);
        }
    }

    // In-memory fallback
    const entry = challengeStore.get(key);
    if (entry) {
        challengeStore.delete(key);
        if (entry.expiresAt > Date.now()) {
            return entry.challenge;
        }
    }

    return null;
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Generate a unique user ID
 * @returns {string}
 */
function generateUserId() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Get user by email
 * @param {string} email - User email
 * @returns {Promise<object|null>}
 */
async function getUserByEmail(email) {
    const normalizedEmail = email.toLowerCase().trim();
    const key = `${CONFIG.USER_PREFIX}email:${normalizedEmail}`;

    if (redis) {
        try {
            const data = await redis.get(key);
            if (data) {
                return typeof data === 'string' ? JSON.parse(data) : data;
            }
        } catch (error) {
            console.error('[PasskeyUtils] Redis get user failed:', error.message);
        }
    }

    // In-memory fallback
    return userStore.get(key) || null;
}

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<object|null>}
 */
async function getUserById(userId) {
    const key = `${CONFIG.USER_PREFIX}id:${userId}`;

    if (redis) {
        try {
            const data = await redis.get(key);
            if (data) {
                return typeof data === 'string' ? JSON.parse(data) : data;
            }
        } catch (error) {
            console.error('[PasskeyUtils] Redis get user by id failed:', error.message);
        }
    }

    return userStore.get(key) || null;
}

/**
 * Create or update a user
 * @param {object} userData - User data
 * @returns {Promise<boolean>}
 */
async function saveUser(userData) {
    const normalizedEmail = userData.email.toLowerCase().trim();
    const emailKey = `${CONFIG.USER_PREFIX}email:${normalizedEmail}`;
    const idKey = `${CONFIG.USER_PREFIX}id:${userData.id}`;

    const data = {
        ...userData,
        email: normalizedEmail,
        updatedAt: new Date().toISOString(),
    };

    if (redis) {
        try {
            const pipeline = redis.pipeline();
            pipeline.set(emailKey, JSON.stringify(data));
            pipeline.set(idKey, JSON.stringify(data));
            await pipeline.exec();
            return true;
        } catch (error) {
            console.error('[PasskeyUtils] Redis save user failed:', error.message);
        }
    }

    // In-memory fallback
    userStore.set(emailKey, data);
    userStore.set(idKey, data);
    return true;
}

// ============================================================================
// CREDENTIAL MANAGEMENT
// ============================================================================

/**
 * Store a passkey credential
 * @param {string} credentialId - Base64url credential ID
 * @param {object} credentialData - Credential data
 * @returns {Promise<boolean>}
 */
async function storeCredential(credentialId, credentialData) {
    const key = `${CONFIG.CREDENTIAL_PREFIX}${credentialId}`;

    const data = {
        ...credentialData,
        credentialId,
        createdAt: credentialData.createdAt || new Date().toISOString(),
        lastUsed: null,
        useCount: 0,
    };

    if (redis) {
        try {
            await redis.set(key, JSON.stringify(data));
            console.log('[PasskeyUtils] Credential stored in Redis');
            return true;
        } catch (error) {
            console.error('[PasskeyUtils] Redis store credential failed:', error.message);
        }
    }

    // In-memory fallback
    credentialStore.set(key, data);
    return true;
}

/**
 * Get a credential by ID
 * @param {string} credentialId - Base64url credential ID
 * @returns {Promise<object|null>}
 */
async function getCredential(credentialId) {
    const key = `${CONFIG.CREDENTIAL_PREFIX}${credentialId}`;

    if (redis) {
        try {
            const data = await redis.get(key);
            if (data) {
                return typeof data === 'string' ? JSON.parse(data) : data;
            }
        } catch (error) {
            console.error('[PasskeyUtils] Redis get credential failed:', error.message);
        }
    }

    return credentialStore.get(key) || null;
}

/**
 * Update credential after successful authentication
 * @param {string} credentialId - Credential ID
 * @param {number} newCounter - New counter value
 * @returns {Promise<boolean>}
 */
async function updateCredentialUsage(credentialId, newCounter) {
    const credential = await getCredential(credentialId);
    if (!credential) return false;

    credential.counter = newCounter;
    credential.lastUsed = new Date().toISOString();
    credential.useCount = (credential.useCount || 0) + 1;

    return storeCredential(credentialId, credential);
}

/**
 * Get all credentials for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>}
 */
async function getUserCredentials(userId) {
    const user = await getUserById(userId);
    if (!user || !user.credentialIds) return [];

    const credentials = [];
    for (const credId of user.credentialIds) {
        const cred = await getCredential(credId);
        if (cred) {
            credentials.push(cred);
        }
    }

    return credentials;
}

/**
 * Add credential ID to user's list
 * @param {string} userId - User ID
 * @param {string} credentialId - Credential ID to add
 * @returns {Promise<boolean>}
 */
async function addCredentialToUser(userId, credentialId) {
    const user = await getUserById(userId);
    if (!user) return false;

    if (!user.credentialIds) {
        user.credentialIds = [];
    }

    if (user.credentialIds.length >= CONFIG.MAX_CREDENTIALS_PER_USER) {
        console.warn('[PasskeyUtils] Max credentials per user reached');
        return false;
    }

    if (!user.credentialIds.includes(credentialId)) {
        user.credentialIds.push(credentialId);
        return saveUser(user);
    }

    return true;
}

/**
 * Delete a credential
 * @param {string} credentialId - Credential ID
 * @param {string} userId - User ID (to remove from user's list)
 * @returns {Promise<boolean>}
 */
async function deleteCredential(credentialId, userId) {
    const key = `${CONFIG.CREDENTIAL_PREFIX}${credentialId}`;

    // Remove from Redis/memory
    if (redis) {
        try {
            await redis.del(key);
        } catch (error) {
            console.error('[PasskeyUtils] Redis delete credential failed:', error.message);
        }
    }
    credentialStore.delete(key);

    // Remove from user's list
    if (userId) {
        const user = await getUserById(userId);
        if (user && user.credentialIds) {
            user.credentialIds = user.credentialIds.filter(id => id !== credentialId);
            await saveUser(user);
        }
    }

    return true;
}

// ============================================================================
// SESSION TOKEN MANAGEMENT
// ============================================================================

/**
 * Generate a secure session token
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {string|null} - HMAC-signed session token
 */
function generateSessionToken(userId, email) {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
        console.warn('[PasskeyUtils] ENCRYPTION_KEY not set');
        return null;
    }

    const payload = {
        sub: userId,
        email,
        iat: Date.now(),
        exp: Date.now() + CONFIG.SESSION_DURATION,
        type: 'passkey',
        nonce: crypto.randomBytes(16).toString('hex'),
    };

    const data = JSON.stringify(payload);
    const hmac = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('base64url');

    return Buffer.from(data).toString('base64url') + '.' + hmac;
}

/**
 * Verify a session token
 * @param {string} token - Session token
 * @returns {object|null} - Decoded payload or null
 */
function verifySessionToken(token) {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret || !token) return null;

    try {
        const [dataB64, hmac] = token.split('.');
        if (!dataB64 || !hmac) return null;

        const data = Buffer.from(dataB64, 'base64url').toString();
        const expectedHmac = crypto
            .createHmac('sha256', secret)
            .update(data)
            .digest('base64url');

        if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
            return null;
        }

        const payload = JSON.parse(data);
        if (Date.now() > payload.exp) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    CONFIG,

    // Challenge management
    generateChallenge,
    storeChallenge,
    verifyChallenge,

    // User management
    generateUserId,
    getUserByEmail,
    getUserById,
    saveUser,

    // Credential management
    storeCredential,
    getCredential,
    updateCredentialUsage,
    getUserCredentials,
    addCredentialToUser,
    deleteCredential,

    // Session management
    generateSessionToken,
    verifySessionToken,
};
