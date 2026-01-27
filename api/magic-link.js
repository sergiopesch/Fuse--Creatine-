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

// Initialize Redis
const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? Redis.fromEnv()
        : null;

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
 * Store magic link token in Redis
 * @param {string} token - Magic link token
 * @param {string} email - Email the link was sent to
 * @param {string} ip - Requesting IP address
 * @returns {Promise<boolean>}
 */
async function storeMagicToken(token, email, ip) {
    const redisKey = `${CONFIG.MAGIC_LINK_PREFIX}${token}`;
    const data = {
        email,
        ip,
        createdAt: Date.now(),
        used: false
    };

    if (redis) {
        try {
            await redis.setex(redisKey, CONFIG.TOKEN_EXPIRY_SECONDS, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('[MagicLink] Failed to store token:', error.message);
            return false;
        }
    }

    console.error('[MagicLink] Redis not available - magic links require Redis');
    return false;
}

/**
 * Verify and consume magic link token from Redis
 * @param {string} token - Magic link token to verify
 * @returns {Promise<object|null>} - Token data or null
 */
async function verifyMagicToken(token) {
    if (!redis) return null;

    const redisKey = `${CONFIG.MAGIC_LINK_PREFIX}${token}`;

    try {
        const data = await redis.get(redisKey);
        if (!data) return null;

        const parsed = typeof data === 'string' ? JSON.parse(data) : data;

        if (parsed.used) return null;

        // Mark as used and delete
        await redis.del(redisKey);

        // Check expiry (belt and suspenders)
        if (Date.now() - parsed.createdAt > CONFIG.TOKEN_EXPIRY) {
            return null;
        }

        return parsed;
    } catch (error) {
        console.error('[MagicLink] Token verification failed:', error.message);
        return null;
    }
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
        console.warn('[MagicLink] RESEND_API_KEY not set - logging magic link to console');
        console.log('[MagicLink] ===================================');
        console.log('[MagicLink] MAGIC LINK (copy this URL):');
        console.log('[MagicLink]', magicLinkUrl);
        console.log('[MagicLink] ===================================');
        return true; // Allow flow to continue for testing
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
    const { action } = validatedBody;

    // ====================================
    // SEND MAGIC LINK
    // ====================================
    if (action === 'send') {
        const { email } = validatedBody;

        if (!email || typeof email !== 'string') {
            return res.status(400).json({ success: false, error: 'Email address required' });
        }

        // Normalize and validate email
        const normalizedEmail = email.trim().toLowerCase();
        const ceoEmail = CEO_EMAIL.trim().toLowerCase();

        if (normalizedEmail !== ceoEmail) {
            addAuditEntry({
                action: 'MAGIC_LINK_UNAUTHORIZED_EMAIL',
                ip: clientIp,
                success: false,
                endpoint: '/api/magic-link',
                note: 'Non-CEO email attempted magic link'
            });
            return res.status(403).json({
                success: false,
                error: 'Magic link is only available for authorized administrators'
            });
        }

        if (!redis) {
            return res.status(503).json({
                success: false,
                error: 'Magic link service requires Redis. Please configure UPSTASH_REDIS_REST_URL.'
            });
        }

        // Generate token and build magic link URL
        const token = generateMagicToken();
        const stored = await storeMagicToken(token, normalizedEmail, clientIp);

        if (!stored) {
            return res.status(500).json({ success: false, error: 'Failed to create magic link' });
        }

        // Determine which page the user is on to build the right return URL
        const page = validatedBody.page || 'dashboard';
        const origin = resolveOrigin(req);
        const magicLinkUrl = `${origin}/${page}?magic_token=${token}`;

        const emailSent = await sendMagicLinkEmail(normalizedEmail, magicLinkUrl);

        addAuditEntry({
            action: 'MAGIC_LINK_SENT',
            ip: clientIp,
            success: emailSent,
            endpoint: '/api/magic-link',
            email: normalizedEmail.substring(0, 3) + '***'
        });

        if (!emailSent && RESEND_API_KEY) {
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
        const { token } = validatedBody;

        if (!token || typeof token !== 'string' || token.length < 32) {
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
        const deviceFingerprint = createDeviceFingerprint(req, validatedBody.deviceId);

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

module.exports = createSecuredHandler({
    requireAuth: false,
    allowedMethods: ['POST', 'OPTIONS'],
    rateLimit: {
        limit: CONFIG.RATE_LIMIT.limit,
        windowMs: CONFIG.RATE_LIMIT.windowMs,
        keyPrefix: 'magic-link'
    }
}, magicLinkHandler);
