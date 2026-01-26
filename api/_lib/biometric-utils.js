/**
 * FUSE Biometric Utilities
 * Shared utilities for biometric authentication and registration
 *
 * @version 1.0.0
 */

const crypto = require('crypto');
const { list, put, del } = require('@vercel/blob');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    CHALLENGE_EXPIRY: 5 * 60 * 1000, // 5 minutes
    BLOB_PREFIX: 'biometric-credentials/',
    CHALLENGE_PREFIX: 'biometric-challenges/',
    DEVICE_LINK_PREFIX: 'device-links/',
    OWNER_CREDENTIAL_KEY: 'owner-credential.json',
    DEVICE_LINK_EXPIRY: 5 * 60 * 1000, // 5 minutes for device link codes
    MAX_AUTHORIZED_DEVICES: 5
};

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
    return crypto.createHash('sha256')
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

    return crypto.createHash('sha256')
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

/**
 * Get the owner credential from Vercel Blob
 * Returns { credential, error } to distinguish between "no owner" and "service error"
 * @returns {Promise<{ credential: object|null, error: string|null }>}
 */
async function getOwnerCredential() {
    try {
        const { blobs } = await list({ prefix: CONFIG.BLOB_PREFIX });
        const blob = blobs.find(b => b.pathname === `${CONFIG.BLOB_PREFIX}${CONFIG.OWNER_CREDENTIAL_KEY}`);

        if (!blob) {
            return { credential: null, error: null };
        }

        const response = await fetch(blob.url);
        if (!response.ok) {
            console.error('[BiometricUtils] Blob fetch failed:', response.status);
            return { credential: null, error: 'BLOB_FETCH_FAILED' };
        }

        const credential = await response.json();
        return { credential, error: null };
    } catch (error) {
        console.error('[BiometricUtils] Failed to get owner credential:', error);
        return { credential: null, error: 'SERVICE_ERROR' };
    }
}

/**
 * Store or update owner credential in Vercel Blob
 * @param {object} credentialData - Credential data to store
 * @returns {Promise<boolean>} - Success status
 */
async function storeOwnerCredential(credentialData) {
    const blobPath = `${CONFIG.BLOB_PREFIX}${CONFIG.OWNER_CREDENTIAL_KEY}`;

    try {
        await put(blobPath, JSON.stringify(credentialData), {
            access: 'private',
            contentType: 'application/json',
            addRandomSuffix: false
        });
        return true;
    } catch (error) {
        console.error('[BiometricUtils] Failed to store owner credential:', error);
        return false;
    }
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
    const blobPath = `${CONFIG.CHALLENGE_PREFIX}${prefix}-${key}.json`;
    const data = {
        challenge,
        createdAt: Date.now()
    };
    if (nonce) {
        data.nonce = nonce;
    }

    try {
        await put(blobPath, JSON.stringify(data), {
            access: 'private',
            contentType: 'application/json',
            addRandomSuffix: false
        });
        return true;
    } catch (error) {
        console.error('[BiometricUtils] Failed to store challenge:', error);
        return false;
    }
}

/**
 * Verify and consume challenge from Vercel Blob
 * @param {string} key - Challenge key (typically device fingerprint)
 * @param {string} prefix - 'auth' or 'reg' to differentiate challenge types
 * @returns {Promise<object|null>} - Challenge data or null if invalid/expired
 */
async function verifyChallenge(key, prefix = 'auth') {
    const blobPath = `${CONFIG.CHALLENGE_PREFIX}${prefix}-${key}.json`;

    try {
        const { blobs } = await list({ prefix: CONFIG.CHALLENGE_PREFIX });
        const blob = blobs.find(b => b.pathname === blobPath);

        if (!blob) return null;

        const response = await fetch(blob.url);
        if (!response.ok) return null;

        const entry = await response.json();

        // Check expiry
        if (Date.now() - entry.createdAt > CONFIG.CHALLENGE_EXPIRY) {
            try {
                await del(blob.url);
            } catch (e) { /* ignore cleanup errors */ }
            return null;
        }

        // Delete the challenge (consume it - one-time use)
        try {
            await del(blob.url);
        } catch (e) { /* ignore cleanup errors */ }

        // Return full entry for registration (includes nonce), just challenge for auth
        return prefix === 'reg' ? entry : entry.challenge;
    } catch (error) {
        console.error('[BiometricUtils] Failed to verify challenge:', error);
        return null;
    }
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
 * Store device link for later claim
 * @param {string} code - Device link code
 * @param {string} ownerUserId - Owner's user ID
 * @param {string} createdByFingerprint - Fingerprint of device that created the link
 * @returns {Promise<boolean>} - Success status
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
            access: 'private',
            contentType: 'application/json',
            addRandomSuffix: false
        });
        return true;
    } catch (error) {
        console.error('[BiometricUtils] Failed to store device link:', error);
        return false;
    }
}

/**
 * Get and validate device link
 * @param {string} code - Device link code
 * @returns {Promise<object|null>} - Device link data or null if invalid/expired
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
            try {
                await del(blob.url);
            } catch (e) { /* ignore cleanup errors */ }
            return null;
        }

        if (data.claimed) {
            return null; // Already used
        }

        return data;
    } catch (error) {
        console.error('[BiometricUtils] Failed to get device link:', error);
        return null;
    }
}

/**
 * Delete device link after use
 * @param {string} code - Device link code
 * @returns {Promise<void>}
 */
async function deleteDeviceLink(code) {
    const blobPath = `${CONFIG.DEVICE_LINK_PREFIX}${code}.json`;

    try {
        const { blobs } = await list({ prefix: CONFIG.DEVICE_LINK_PREFIX });
        const blob = blobs.find(b => b.pathname === blobPath);
        if (blob) {
            await del(blob.url);
        }
    } catch (error) {
        console.error('[BiometricUtils] Failed to delete device link:', error);
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
    addAuthorizedDevice
};
