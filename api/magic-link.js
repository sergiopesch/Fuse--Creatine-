/**
 * FUSE Magic Link Authentication API
 * Simple email-based authentication for dashboard access.
 *
 * Flow:
 * 1. User clicks "Send Magic Link" → server emails a one-time link
 * 2. User clicks link → dashboard loads with token in URL
 * 3. Dashboard verifies token → gets session token → access granted
 *
 * @version 2.0.0
 */

const crypto = require('crypto');
const { Redis } = require('@upstash/redis');
const { createSecuredHandler, addAuditEntry } = require('./_lib/security');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CEO_EMAIL = process.env.CEO_EMAIL || 'speschiera@gmail.com';
const SESSION_SECRET = process.env.ENCRYPTION_KEY || null;
const RESEND_API_KEY = process.env.RESEND_API_KEY || null;

const CONFIG = {
    TOKEN_EXPIRY_SECONDS: 900,           // 15 minutes
    TOKEN_LENGTH: 48,                     // bytes (96 hex chars)
    REDIS_PREFIX: 'magic:token:',
    SESSION_DURATION: 30 * 60 * 1000,    // 30 minutes
    RATE_LIMIT: { limit: 5, windowMs: 300000 }
};

// Initialize Redis (required for magic links to work)
const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? Redis.fromEnv()
        : null;

if (!redis) {
    console.warn('[MagicLink] Redis not configured — magic links will not work without Redis.');
}

// ============================================================================
// TOKEN HELPERS
// ============================================================================

/**
 * Generate a cryptographically secure token
 */
function generateToken() {
    return crypto.randomBytes(CONFIG.TOKEN_LENGTH).toString('hex');
}

/**
 * Store token in Redis with automatic expiry
 */
async function storeToken(token) {
    if (!redis) return false;
    try {
        await redis.setex(
            `${CONFIG.REDIS_PREFIX}${token}`,
            CONFIG.TOKEN_EXPIRY_SECONDS,
            JSON.stringify({ createdAt: Date.now() })
        );
        return true;
    } catch (error) {
        console.error('[MagicLink] Failed to store token:', error.message);
        return false;
    }
}

/**
 * Verify and consume a token (one-time use)
 * Returns true if valid, false otherwise
 */
async function consumeToken(token) {
    if (!redis) return false;
    try {
        const key = `${CONFIG.REDIS_PREFIX}${token}`;
        const data = await redis.get(key);
        if (!data) return false;
        // Delete immediately (one-time use)
        await redis.del(key);
        return true;
    } catch (error) {
        console.error('[MagicLink] Token verification failed:', error.message);
        return false;
    }
}

// ============================================================================
// SESSION TOKEN
// ============================================================================

/**
 * Generate a signed session token
 */
function generateSessionToken() {
    if (!SESSION_SECRET) return null;

    const payload = {
        issuedAt: Date.now(),
        expiresAt: Date.now() + CONFIG.SESSION_DURATION,
        nonce: crypto.randomBytes(16).toString('hex'),
        authMethod: 'magic-link',
    };

    const data = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');

    return Buffer.from(data).toString('base64url') + '.' + hmac;
}

// ============================================================================
// EMAIL
// ============================================================================

/**
 * Send magic link email via Resend
 */
async function sendEmail(magicLinkUrl) {
    if (!RESEND_API_KEY) {
        if (process.env.NODE_ENV !== 'production') {
            console.log('[MagicLink] DEV MODE — Magic link URL:', magicLinkUrl);
            return { sent: true };
        }
        console.warn('[MagicLink] RESEND_API_KEY not set — cannot send email');
        return { sent: false, reason: 'RESEND_API_KEY not configured' };
    }

    try {
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'FUSE <onboarding@resend.dev>';
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: fromEmail,
                to: [CEO_EMAIL],
                subject: 'FUSE Dashboard — Your Magic Link',
                html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
                        <div style="text-align: center; margin-bottom: 32px;">
                            <h1 style="font-size: 28px; font-weight: 700; color: #000; letter-spacing: 0.1em; margin: 0;">FUSE</h1>
                            <p style="color: #666; font-size: 14px; margin-top: 4px;">Command Center Access</p>
                        </div>
                        <div style="background: #f9f9f9; border-radius: 16px; padding: 32px 24px; text-align: center;">
                            <p style="color: #333; font-size: 16px; margin: 0 0 24px;">Click below to access your dashboard.</p>
                            <a href="${magicLinkUrl}" style="display: inline-block; background: #ff3b30; color: #fff; text-decoration: none; padding: 14px 40px; border-radius: 980px; font-weight: 600; font-size: 15px;">Access Dashboard</a>
                            <p style="color: #999; font-size: 12px; margin: 24px 0 0;">Expires in 15 minutes. One-time use.</p>
                        </div>
                        <p style="color: #999; font-size: 11px; text-align: center; margin-top: 24px;">If you didn't request this, ignore this email.</p>
                    </div>
                `,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error('[MagicLink] Resend error:', response.status, err);
            const detail = err.message || err.name || `Resend API ${response.status}`;
            return { sent: false, reason: `Email provider error: ${detail}` };
        }

        console.log('[MagicLink] Email sent to:', CEO_EMAIL);
        return { sent: true };
    } catch (error) {
        console.error('[MagicLink] Email failed:', error.message);
        return { sent: false, reason: `Email send exception: ${error.message}` };
    }
}

// ============================================================================
// URL HELPER
// ============================================================================

function resolveOrigin(req) {
    if (req.headers.origin) return req.headers.origin;
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    return `${proto}://${Array.isArray(host) ? host[0] : host}`;
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

    // ── SEND ────────────────────────────────────────────────────────────
    if (action === 'send') {
        if (!redis) {
            return res.status(503).json({ success: false, error: 'Magic links require Redis. Please configure UPSTASH_REDIS_REST_URL.' });
        }

        const token = generateToken();
        const stored = await storeToken(token);
        if (!stored) {
            return res.status(500).json({ success: false, error: 'Failed to create magic link.' });
        }

        // Build the return URL
        const page = 'dashboard';
        const origin = resolveOrigin(req).replace(/\/$/, '');
        const magicLinkUrl = `${origin}/${page}?magic_token=${encodeURIComponent(token)}`;

        const emailResult = await sendEmail(magicLinkUrl);

        addAuditEntry({
            action: 'MAGIC_LINK_SENT',
            ip: clientIp,
            success: emailResult.sent,
            endpoint: '/api/magic-link'
        });

        if (!emailResult.sent) {
            // Email failed — return the magic link URL directly so the user can still log in
            return res.status(200).json({
                success: true,
                message: 'Email unavailable — use the link below to log in.',
                magicLinkUrl,
                expiresIn: CONFIG.TOKEN_EXPIRY_SECONDS,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Magic link sent! Check your email inbox.',
            expiresIn: CONFIG.TOKEN_EXPIRY_SECONDS,
        });
    }

    // ── VERIFY ──────────────────────────────────────────────────────────
    if (action === 'verify') {
        const token = typeof body.token === 'string' ? body.token.trim() : '';

        if (!token || token.length < 32) {
            return res.status(400).json({ success: false, error: 'Invalid token.' });
        }

        if (!redis) {
            return res.status(503).json({ success: false, error: 'Verification unavailable — Redis not configured.' });
        }

        const valid = await consumeToken(token);

        if (!valid) {
            addAuditEntry({
                action: 'MAGIC_LINK_INVALID',
                ip: clientIp,
                success: false,
                endpoint: '/api/magic-link',
            });
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired magic link. Please request a new one.',
            });
        }

        // Token is valid — generate session
        const sessionToken = generateSessionToken();

        addAuditEntry({
            action: 'MAGIC_LINK_VERIFIED',
            ip: clientIp,
            success: true,
            endpoint: '/api/magic-link',
            authMethod: 'magic-link'
        });

        const response = {
            success: true,
            verified: true,
            message: 'Magic link verified. Welcome!'
        };

        if (sessionToken) {
            response.sessionToken = sessionToken;
            response.expiresIn = Math.floor(CONFIG.SESSION_DURATION / 1000);
        }

        return res.status(200).json(response);
    }

    return res.status(400).json({ success: false, error: 'Invalid action.' });
};

// ============================================================================
// EXPORT
// ============================================================================

module.exports = createSecuredHandler({
    requireAuth: false,
    allowedMethods: ['POST', 'OPTIONS'],
    validationSchema: {
        action: { required: true, type: 'string', enum: ['send', 'verify'] },
        page: { type: 'string' },
        token: { type: 'string' }
    },
    rateLimit: {
        limit: CONFIG.RATE_LIMIT.limit,
        windowMs: CONFIG.RATE_LIMIT.windowMs,
        keyPrefix: 'magic-link'
    }
}, magicLinkHandler);
