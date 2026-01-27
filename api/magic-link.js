/**
 * FUSE Magic Link Authentication API
 * Allows CEO/admin to authenticate via email magic link
 * Enables multi-device access without requiring biometric on every device
 *
 * Flow:
 * 1. User requests magic link → server sends email with token
 * 2. User clicks link → dashboard loads with token in URL
 * 3. Dashboard verifies token → device gets authorized + session created
 *
 * @version 1.0.0
 */

const crypto = require('crypto');
const { Redis } = require('@upstash/redis');
const {
    createSecuredHandler,
    addAuditEntry
} = require('./_lib/security');
const {
    CONFIG: BIOMETRIC_CONFIG,
    createDeviceFingerprint,
    getOwnerCredential,
    storeOwnerCredential,
    addAuthorizedDevice
} = require('./_lib/biometric-utils');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CEO_EMAIL = process.env.CEO_EMAIL || 'speschiera@gmail.com';
const SESSION_SECRET = process.env.ENCRYPTION_KEY || null;
const RESEND_API_KEY = process.env.RESEND_API_KEY || null;

const CONFIG = {
    TOKEN_EXPIRY: 15 * 60 * 1000, // 15 minutes
    TOKEN_EXPIRY_SECONDS: 900,
    TOKEN_LENGTH: 48, // bytes
    MAGIC_LINK_PREFIX: 'magic:token:',
    RATE_LIMIT: { limit: 5, windowMs: 300000 }, // 5 requests per 5 minutes
    SESSION_DURATION: 30 * 60 * 1000 // 30 minutes
};

// Initialize Redis (optional - falls back to in-memory store)
const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? Redis.fromEnv()
        : null;

// In-memory fallback token store (used when Redis is not configured)
const memoryTokenStore = new Map();

if (!redis) {
    console.warn('[MagicLink] Redis not configured - using in-memory token store. Tokens will not persist across serverless cold starts.');
}

/**
 * Clean up expired entries from the in-memory store
 */
function cleanupMemoryStore() {
    const now = Date.now();
    for (const [key, value] of memoryTokenStore) {
        if (now > value.expiresAt) {
            memoryTokenStore.delete(key);
        }
    }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a secure magic link token
 * @returns {string} - Hex-encoded token
 */
function generateMagicToken() {
    return crypto.randomBytes(CONFIG.TOKEN_LENGTH).toString('hex');
}

/**
 * Hash token for storage (avoid storing raw tokens)
 * @param {string} token - Magic link token
 * @returns {string}
 */
function hashMagicToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Store magic link token in Redis
 * @param {string} token - Magic link token
 * @returns {Promise<boolean>}
 */
async function storeMagicToken(token) {
    const tokenHash = hashMagicToken(token);
    const redisKey = `${CONFIG.MAGIC_LINK_PREFIX}${tokenHash}`;
    const data = {
        createdAt: Date.now()
    };

    if (redis) {
        try {
            await redis.setex(redisKey, CONFIG.TOKEN_EXPIRY_SECONDS, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('[MagicLink] Failed to store token in Redis:', error.message);
            // Fall through to in-memory store
        }
    }

    // Fallback: in-memory store
    cleanupMemoryStore();
    memoryTokenStore.set(redisKey, { ...data, expiresAt: Date.now() + CONFIG.TOKEN_EXPIRY });
    console.log('[MagicLink] Token stored in memory (fallback)');
    return true;
}

/**
 * Verify and consume magic link token from Redis
 * @param {string} token - Magic link token to verify
 * @returns {Promise<object|null>} - Token data or null
 */
async function verifyMagicToken(token) {
    const tokenHash = hashMagicToken(token);
    const redisKey = `${CONFIG.MAGIC_LINK_PREFIX}${tokenHash}`;

    // Try Redis first
    if (redis) {
        try {
            const data = await redis.get(redisKey);
            if (data) {
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;

                // Mark as used and delete
                await redis.del(redisKey);

                // Check expiry (belt and suspenders)
                if (Date.now() - parsed.createdAt > CONFIG.TOKEN_EXPIRY) {
                    return null;
                }

                return parsed;
            }
        } catch (error) {
            console.error('[MagicLink] Redis verification failed, trying memory store:', error.message);
            // Fall through to in-memory store
        }
    }

    // Fallback: in-memory store
    cleanupMemoryStore();
    const memData = memoryTokenStore.get(redisKey);
    if (!memData) return null;

    // Consume token (one-time use)
    memoryTokenStore.delete(redisKey);

    // Check expiry
    if (Date.now() - memData.createdAt > CONFIG.TOKEN_EXPIRY) {
        return null;
    }

    return memData;
}

/**
 * Generate a session token (same logic as biometric-authenticate.js)
 * @param {string} userId - User identifier
 * @param {string} deviceFingerprint - Device fingerprint
 * @returns {string|null}
 */
function generateSessionToken(userId, deviceFingerprint) {
    if (!SESSION_SECRET) return null;

    const payload = {
        userId,
        deviceFingerprint,
        issuedAt: Date.now(),
        expiresAt: Date.now() + CONFIG.SESSION_DURATION,
        nonce: crypto.randomBytes(16).toString('hex'),
        authMethod: 'magic-link'
    };

    const data = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', SESSION_SECRET)
        .update(data)
        .digest('base64url');

    return Buffer.from(data).toString('base64url') + '.' + hmac;
}

/**
 * Send magic link email via Resend API
 * @param {string} email - Recipient email
 * @param {string} magicLinkUrl - The full magic link URL
 * @returns {Promise<boolean>}
 */
async function sendMagicLinkEmail(email, magicLinkUrl) {
    if (!RESEND_API_KEY) {
        const isProd = process.env.NODE_ENV === 'production';
        console.warn('[MagicLink] RESEND_API_KEY not set - email delivery disabled');
        if (!isProd) {
            console.log('[MagicLink] ===================================');
            console.log('[MagicLink] MAGIC LINK (copy this URL):');
            console.log('[MagicLink]', magicLinkUrl);
            console.log('[MagicLink] ===================================');
            return true; // Allow flow to continue for local testing
        }
        return false;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: process.env.RESEND_FROM_EMAIL || 'FUSE <noreply@fusecreatine.com>',
                to: [email],
                subject: 'FUSE Dashboard - Your Magic Link',
                html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
                        <div style="text-align: center; margin-bottom: 32px;">
                            <h1 style="font-size: 28px; font-weight: 700; color: #000; letter-spacing: 0.1em; margin: 0;">FUSE</h1>
                            <p style="color: #666; font-size: 14px; margin-top: 4px;">Command Center Access</p>
                        </div>
                        <div style="background: #f9f9f9; border-radius: 16px; padding: 32px 24px; text-align: center;">
                            <p style="color: #333; font-size: 16px; margin: 0 0 24px;">Click the button below to securely access your FUSE dashboard from this device.</p>
                            <a href="${magicLinkUrl}" style="display: inline-block; background: #ff3b30; color: #fff; text-decoration: none; padding: 14px 40px; border-radius: 980px; font-weight: 600; font-size: 15px;">Access Dashboard</a>
                            <p style="color: #999; font-size: 12px; margin: 24px 0 0;">This link expires in 15 minutes and can only be used once.</p>
                        </div>
                        <p style="color: #999; font-size: 11px; text-align: center; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
                    </div>
                `
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[MagicLink] Resend API error:', response.status, errorData);
            return false;
        }

        console.log('[MagicLink] Email sent successfully to:', email);
        return true;
    } catch (error) {
        console.error('[MagicLink] Email send failed:', error.message);
        return false;
    }
}

/**
 * Resolve the origin URL for building magic links
 * @param {object} req - HTTP request
 * @returns {string}
 */
function resolveOrigin(req) {
    const origin = req.headers.origin;
    if (origin) return origin;

    const forwardedProto = req.headers['x-forwarded-proto'] || 'https';
    const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto.split(',')[0].trim();
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const resolvedHost = Array.isArray(host) ? host[0] : host;

    return `${proto}://${resolvedHost}`;
}

// ============================================================================
// HANDLER
// ============================================================================

const magicLinkHandler = async (req, res, { clientIp, validatedBody }) => {
    const body = validatedBody && typeof validatedBody === 'object' ? validatedBody : {};
    const { action } = body;

    if (!action || !['send', 'verify'].includes(action)) {
        return res.status(400).json({ success: false, error: 'Invalid action. Use "send" or "verify".' });
    }

    // ====================================
    // SEND MAGIC LINK
    // ====================================
    if (action === 'send') {
        // Use the stored CEO email directly - no email input needed from the client
        const ceoEmail = CEO_EMAIL.trim().toLowerCase();
        const normalizedEmail = ceoEmail;

        // Generate token and build magic link URL
        const token = generateMagicToken();
        const stored = await storeMagicToken(token);

        if (!stored) {
            return res.status(500).json({ success: false, error: 'Failed to create magic link' });
        }

        // Determine which page the user is on to build the right return URL
        const page = (body.page && typeof body.page === 'string') ? body.page.replace(/[^a-z0-9-]/gi, '') : 'dashboard';
        const safePage = ['dashboard', 'ceo-dashboard'].includes(page) ? page : 'dashboard';
        const origin = resolveOrigin(req);
        const magicLinkUrl = `${origin.replace(/\/$/, '')}/${safePage}?magic_token=${encodeURIComponent(token)}`;

        const emailSent = await sendMagicLinkEmail(normalizedEmail, magicLinkUrl);

        addAuditEntry({
            action: 'MAGIC_LINK_SENT',
            ip: clientIp,
            success: emailSent,
            endpoint: '/api/magic-link'
        });

        if (!emailSent) {
            return res.status(500).json({
                success: false,
                error: 'Failed to send email. Please try again.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Magic link sent! Check your email inbox.',
            expiresIn: CONFIG.TOKEN_EXPIRY_SECONDS
        });
    }

    // ====================================
    // VERIFY MAGIC LINK TOKEN
    // ====================================
    if (action === 'verify') {
        const token = typeof body.token === 'string' ? body.token.trim() : '';

        if (!token || token.length < 32) {
            return res.status(400).json({ success: false, error: 'Invalid token' });
        }

        const tokenData = await verifyMagicToken(token);

        if (!tokenData) {
            addAuditEntry({
                action: 'MAGIC_LINK_INVALID_TOKEN',
                ip: clientIp,
                success: false,
                endpoint: '/api/magic-link'
            });
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired magic link. Please request a new one.'
            });
        }

        // Token is valid - authorize this device
        const deviceId = (body.deviceId && typeof body.deviceId === 'string') ? body.deviceId : null;
        const deviceFingerprint = createDeviceFingerprint(req, deviceId);

        // Get or create owner credential
        const { credential: ownerCredential, error: credentialError } = await getOwnerCredential();

        if (credentialError) {
            return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
        }

        let userId;

        if (ownerCredential) {
            // Add this device to authorized devices
            const ua = req.headers['user-agent'] || '';
            let deviceName = 'Magic Link Device';
            if (/iPhone|iPad/i.test(ua)) deviceName = 'iPhone/iPad (Magic Link)';
            else if (/Android/i.test(ua)) deviceName = 'Android (Magic Link)';
            else if (/Mac/i.test(ua)) deviceName = 'Mac (Magic Link)';
            else if (/Windows/i.test(ua)) deviceName = 'Windows PC (Magic Link)';

            const addResult = await addAuthorizedDevice(ownerCredential, deviceFingerprint, deviceName);

            if (!addResult.success && addResult.error !== 'Device already authorized') {
                console.error('[MagicLink] Failed to authorize device:', addResult.error);
                return res.status(500).json({ success: false, error: 'Failed to authorize device' });
            }

            userId = ownerCredential.userId;
        } else {
            // No owner yet - create a minimal owner record so dashboard works
            userId = crypto.randomBytes(16).toString('hex');
            const ownerData = {
                userId,
                deviceFingerprint,
                authorizedDevices: [{ fingerprint: deviceFingerprint, name: 'CEO (Magic Link)', addedAt: new Date().toISOString() }],
                registeredAt: new Date().toISOString(),
                registeredFromIp: clientIp,
                authCount: 0,
                version: '3.0',
                magicLinkSetup: true
            };

            const stored = await storeOwnerCredential(ownerData);
            if (!stored) {
                return res.status(500).json({ success: false, error: 'Failed to initialize dashboard' });
            }
        }

        // Generate session token
        const sessionToken = generateSessionToken(userId, deviceFingerprint);

        addAuditEntry({
            action: 'MAGIC_LINK_VERIFIED',
            ip: clientIp,
            success: true,
            endpoint: '/api/magic-link',
            userId: userId.substring(0, 8) + '...',
            authMethod: 'magic-link'
        });

        const responseBody = {
            success: true,
            verified: true,
            userId,
            message: 'Magic link verified. Welcome to your dashboard!'
        };

        if (sessionToken) {
            responseBody.sessionToken = sessionToken;
            responseBody.expiresIn = Math.floor(CONFIG.SESSION_DURATION / 1000);
        }

        return res.status(200).json(responseBody);
    }

    return res.status(400).json({ success: false, error: 'Invalid action' });
};

const validationSchema = {
    action: { required: true, type: 'string', enum: ['send', 'verify'] },
    page: { type: 'string' },
    token: { type: 'string' },
    deviceId: { type: 'string' }
};

module.exports = createSecuredHandler({
    requireAuth: false,
    allowedMethods: ['POST', 'OPTIONS'],
    validationSchema,
    rateLimit: {
        limit: CONFIG.RATE_LIMIT.limit,
        windowMs: CONFIG.RATE_LIMIT.windowMs,
        keyPrefix: 'magic-link'
    }
}, magicLinkHandler);
