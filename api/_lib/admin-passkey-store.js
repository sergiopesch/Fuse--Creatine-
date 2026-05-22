const crypto = require('crypto');
const { createRedisClient } = require('./redis-client');

const ADMIN_PASSKEY_CONFIG = {
    CHALLENGE_EXPIRY_MS: 5 * 60 * 1000,
    CHALLENGE_EXPIRY_SECONDS: 300,
    CHALLENGE_PREFIX: 'admin-passkey:challenge:',
    CREDENTIALS_KEY: 'admin-passkey:credentials',
    MAX_CREDENTIALS: 5,
};

const redis = createRedisClient();

const challengeStore = new Map();
let credentialStore = [];

function generateAdminPasskeyChallenge() {
    return crypto.randomBytes(32).toString('base64url');
}

async function storeAdminPasskeyChallenge(sessionId, challenge, type, metadata = {}) {
    const key = `${ADMIN_PASSKEY_CONFIG.CHALLENGE_PREFIX}${type}:${sessionId}`;
    const data = {
        challenge,
        type,
        metadata,
        createdAt: Date.now(),
    };

    if (redis) {
        try {
            await redis.setex(
                key,
                ADMIN_PASSKEY_CONFIG.CHALLENGE_EXPIRY_SECONDS,
                JSON.stringify(data)
            );
            return true;
        } catch (error) {
            console.error('[AdminPasskeyStore] Redis challenge store failed:', error.message);
        }
    }

    challengeStore.set(key, {
        ...data,
        expiresAt: Date.now() + ADMIN_PASSKEY_CONFIG.CHALLENGE_EXPIRY_MS,
    });
    return true;
}

async function consumeAdminPasskeyChallenge(sessionId, type) {
    const key = `${ADMIN_PASSKEY_CONFIG.CHALLENGE_PREFIX}${type}:${sessionId}`;

    if (redis) {
        try {
            const data = await redis.get(key);
            if (data) {
                await redis.del(key);
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                if (Date.now() - parsed.createdAt <= ADMIN_PASSKEY_CONFIG.CHALLENGE_EXPIRY_MS) {
                    return parsed;
                }
            }
        } catch (error) {
            console.error('[AdminPasskeyStore] Redis challenge consume failed:', error.message);
        }
    }

    const entry = challengeStore.get(key);
    if (entry) {
        challengeStore.delete(key);
        if (entry.expiresAt > Date.now()) {
            return entry;
        }
    }

    return null;
}

function normalizeCredentials(credentials) {
    return Array.isArray(credentials) ? credentials.filter(Boolean) : [];
}

async function getAdminPasskeyCredentials() {
    if (redis) {
        try {
            const data = await redis.get(ADMIN_PASSKEY_CONFIG.CREDENTIALS_KEY);
            if (data) {
                return normalizeCredentials(typeof data === 'string' ? JSON.parse(data) : data);
            }
        } catch (error) {
            console.error('[AdminPasskeyStore] Redis credential read failed:', error.message);
        }
    }

    return normalizeCredentials(credentialStore);
}

async function saveAdminPasskeyCredentials(credentials) {
    const normalized = normalizeCredentials(credentials).slice(0, ADMIN_PASSKEY_CONFIG.MAX_CREDENTIALS);

    if (redis) {
        try {
            await redis.set(ADMIN_PASSKEY_CONFIG.CREDENTIALS_KEY, JSON.stringify(normalized));
            return true;
        } catch (error) {
            console.error('[AdminPasskeyStore] Redis credential save failed:', error.message);
        }
    }

    credentialStore = normalized;
    return true;
}

async function getAdminPasskeyCredential(credentialId) {
    const credentials = await getAdminPasskeyCredentials();
    return credentials.find(credential => credential.credentialId === credentialId) || null;
}

async function storeAdminPasskeyCredential(credentialData) {
    const credentials = await getAdminPasskeyCredentials();
    const existingIndex = credentials.findIndex(
        credential => credential.credentialId === credentialData.credentialId
    );
    const nextCredential = {
        ...credentialData,
        createdAt: credentialData.createdAt || new Date().toISOString(),
        lastUsed: credentialData.lastUsed || null,
        useCount: credentialData.useCount || 0,
    };

    if (existingIndex >= 0) {
        credentials[existingIndex] = nextCredential;
    } else {
        if (credentials.length >= ADMIN_PASSKEY_CONFIG.MAX_CREDENTIALS) {
            throw new Error('Maximum admin passkeys reached');
        }
        credentials.push(nextCredential);
    }

    await saveAdminPasskeyCredentials(credentials);
    return nextCredential;
}

async function updateAdminPasskeyUsage(credentialId, counter) {
    const credentials = await getAdminPasskeyCredentials();
    const index = credentials.findIndex(credential => credential.credentialId === credentialId);
    if (index < 0) return false;

    credentials[index] = {
        ...credentials[index],
        counter,
        lastUsed: new Date().toISOString(),
        useCount: (credentials[index].useCount || 0) + 1,
    };

    await saveAdminPasskeyCredentials(credentials);
    return true;
}

async function hasAdminPasskeyCredentials() {
    const credentials = await getAdminPasskeyCredentials();
    return credentials.length > 0;
}

function __resetAdminPasskeyStoreForTests() {
    challengeStore.clear();
    credentialStore = [];
}

module.exports = {
    ADMIN_PASSKEY_CONFIG,
    generateAdminPasskeyChallenge,
    storeAdminPasskeyChallenge,
    consumeAdminPasskeyChallenge,
    getAdminPasskeyCredentials,
    saveAdminPasskeyCredentials,
    getAdminPasskeyCredential,
    storeAdminPasskeyCredential,
    updateAdminPasskeyUsage,
    hasAdminPasskeyCredentials,
    __resetAdminPasskeyStoreForTests,
};
