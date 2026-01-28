/**
 * FUSE CEO Authentication API
 * Simple, cost-effective authentication for CEO dashboard access.
 *
 * Supports:
 * 1. PIN authentication (instant, no external services)
 * 2. Stateless magic links (HMAC-signed, no Redis required)
 *
 * @version 1.0.0
 */

const crypto = require('crypto');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CEO_EMAIL = process.env.CEO_EMAIL || 'speschiera@gmail.com';
const CEO_PIN = process.env.CEO_PIN || null;
const SESSION_SECRET = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || null;
const RESEND_API_KEY = process.env.RESEND_API_KEY || null;

const CONFIG = {
    MAGIC_LINK_EXPIRY_MS: 15 * 60 * 1000,  // 15 minutes
    SESSION_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours (longer for convenience)
    MIN_PIN_LENGTH: 4,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get client IP from request
 */
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
        return ip.trim();
    }
    return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

/**
 * Resolve origin from request
 */
function resolveOrigin(req) {
    if (req.headers.origin) return req.headers.origin;
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    return `${proto}://${Array.isArray(host) ? host[0] : host}`;
}

/**
 * Set CORS headers
 */
function setCorsHeaders(res, origin) {
    const allowedOrigins = [
        'https://fuse-creatine.vercel.app',
        'https://www.fusecreatine.com',
        'https://fusecreatine.com',
        /^https:\/\/.*\.vercel\.app$/,
        /^http:\/\/localhost(:\d+)?$/,
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,
    ];

    const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') return allowed === origin;
        return allowed.test(origin);
    });

    if (isAllowed && origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Content-Type', 'application/json');
}

// ============================================================================
// SESSION TOKEN (Stateless)
// ============================================================================

/**
 * Generate a stateless session token (HMAC-signed, no database needed)
 */
function generateSessionToken(authMethod = 'pin') {
    if (!SESSION_SECRET) {
        console.error('[CEOAuth] SESSION_SECRET/ENCRYPTION_KEY not configured');
        return null;
    }

    const payload = {
        sub: 'ceo',
        iat: Date.now(),
        exp: Date.now() + CONFIG.SESSION_DURATION_MS,
        method: authMethod,
        nonce: crypto.randomBytes(8).toString('hex'),
    };

    const data = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    return Buffer.from(data).toString('base64url') + '.' + signature;
}

/**
 * Verify a session token
 */
function verifySessionToken(token) {
    if (!token || !SESSION_SECRET) return { valid: false };

    try {
        const [dataB64, signature] = token.split('.');
        if (!dataB64 || !signature) return { valid: false };

        const data = Buffer.from(dataB64, 'base64url').toString('utf8');
        const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');

        // Timing-safe comparison
        if (signature.length !== expectedSig.length) return { valid: false };
        const sigBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSig);
        if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return { valid: false };

        const payload = JSON.parse(data);
        if (payload.exp < Date.now()) return { valid: false, expired: true };

        return { valid: true, payload };
    } catch (error) {
        return { valid: false };
    }
}

// ============================================================================
// MAGIC LINK (Stateless - No Redis Required)
// ============================================================================

/**
 * Generate a stateless magic link token
 * Format: timestamp.signature
 * The signature is HMAC(secret, email + timestamp)
 */
function generateMagicToken() {
    if (!SESSION_SECRET) return null;

    const timestamp = Date.now().toString();
    const data = CEO_EMAIL + ':' + timestamp;
    const signature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex');

    return timestamp + '.' + signature;
}

/**
 * Verify a magic link token (stateless)
 */
function verifyMagicToken(token) {
    if (!token || !SESSION_SECRET) return { valid: false };

    try {
        const [timestamp, signature] = token.split('.');
        if (!timestamp || !signature) return { valid: false };

        const ts = parseInt(timestamp, 10);
        if (isNaN(ts)) return { valid: false };

        // Check expiry
        if (Date.now() - ts > CONFIG.MAGIC_LINK_EXPIRY_MS) {
            return { valid: false, expired: true };
        }

        // Verify signature
        const data = CEO_EMAIL + ':' + timestamp;
        const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex');

        if (signature.length !== expectedSig.length) return { valid: false };
        const sigBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSig);
        if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return { valid: false };

        return { valid: true, timestamp: ts };
    } catch (error) {
        return { valid: false };
    }
}

/**
 * Send magic link email via Resend
 */
async function sendMagicLinkEmail(magicLinkUrl) {
    if (!RESEND_API_KEY) {
        // Dev mode: log to console
        if (process.env.NODE_ENV !== 'production') {
            console.log('[CEOAuth] DEV MODE - Magic Link URL:', magicLinkUrl);
            return { success: true, devMode: true };
        }
        return { success: false, error: 'Email not configured' };
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: process.env.RESEND_FROM_EMAIL || 'FUSE <noreply@fusecreatine.com>',
                to: [CEO_EMAIL],
                subject: 'FUSE Dashboard - Login Link',
                html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
                        <div style="text-align: center; margin-bottom: 32px;">
                            <h1 style="font-size: 28px; font-weight: 700; color: #000; letter-spacing: 0.1em; margin: 0;">FUSE</h1>
                            <p style="color: #666; font-size: 14px; margin-top: 4px;">CEO Command Center</p>
                        </div>
                        <div style="background: #f9f9f9; border-radius: 16px; padding: 32px 24px; text-align: center;">
                            <p style="color: #333; font-size: 16px; margin: 0 0 24px;">Click below to access your dashboard.</p>
                            <a href="${magicLinkUrl}" style="display: inline-block; background: #ff3b30; color: #fff; text-decoration: none; padding: 14px 40px; border-radius: 980px; font-weight: 600; font-size: 15px;">Access Dashboard</a>
                            <p style="color: #999; font-size: 12px; margin: 24px 0 0;">This link expires in 15 minutes.</p>
                        </div>
                        <p style="color: #999; font-size: 11px; text-align: center; margin-top: 24px;">If you didn't request this, ignore this email.</p>
                    </div>
                `,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error('[CEOAuth] Resend error:', response.status, err);
            return { success: false, error: 'Failed to send email' };
        }

        return { success: true };
    } catch (error) {
        console.error('[CEOAuth] Email error:', error.message);
        return { success: false, error: 'Email service error' };
    }
}

// ============================================================================
// PIN AUTHENTICATION
// ============================================================================

/**
 * Verify CEO PIN
 */
function verifyPin(providedPin) {
    if (!CEO_PIN) {
        return { valid: false, error: 'PIN not configured' };
    }

    if (!providedPin || typeof providedPin !== 'string') {
        return { valid: false, error: 'Invalid PIN' };
    }

    const pin = providedPin.trim();
    if (pin.length < CONFIG.MIN_PIN_LENGTH) {
        return { valid: false, error: 'Invalid PIN' };
    }

    // Timing-safe comparison
    const providedBuffer = Buffer.from(pin);
    const expectedBuffer = Buffer.from(CEO_PIN);

    if (providedBuffer.length !== expectedBuffer.length) {
        return { valid: false, error: 'Invalid PIN' };
    }

    if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
        return { valid: false, error: 'Invalid PIN' };
    }

    return { valid: true };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

module.exports = async (req, res) => {
    const origin = req.headers.origin || '';
    setCorsHeaders(res, origin);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Parse body
    let body = {};
    try {
        if (typeof req.body === 'object') {
            body = req.body;
        } else if (typeof req.body === 'string') {
            body = JSON.parse(req.body);
        }
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Invalid JSON' });
    }

    const { action } = body;
    const clientIp = getClientIp(req);

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION: status - Check what auth methods are available
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'status') {
        return res.status(200).json({
            success: true,
            methods: {
                pin: !!CEO_PIN,
                magicLink: !!SESSION_SECRET,
                email: RESEND_API_KEY ? 'configured' : (process.env.NODE_ENV !== 'production' ? 'dev-mode' : 'not-configured'),
            },
            ceoEmail: CEO_EMAIL ? CEO_EMAIL.replace(/(.{2}).*(@.*)/, '$1***$2') : null,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION: pin - Authenticate with PIN
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'pin') {
        const { pin } = body;
        const result = verifyPin(pin);

        if (!result.valid) {
            console.log(`[CEOAuth] PIN auth failed from ${clientIp}`);
            return res.status(401).json({ success: false, error: result.error || 'Invalid PIN' });
        }

        const sessionToken = generateSessionToken('pin');
        if (!sessionToken) {
            return res.status(500).json({ success: false, error: 'Session generation failed. Check ENCRYPTION_KEY.' });
        }

        console.log(`[CEOAuth] PIN auth successful from ${clientIp}`);
        return res.status(200).json({
            success: true,
            message: 'Welcome! Access granted.',
            sessionToken,
            expiresIn: Math.floor(CONFIG.SESSION_DURATION_MS / 1000),
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION: send-magic-link - Send magic link email
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'send-magic-link') {
        if (!SESSION_SECRET) {
            return res.status(503).json({ success: false, error: 'Magic links not configured. Set ENCRYPTION_KEY.' });
        }

        const token = generateMagicToken();
        if (!token) {
            return res.status(500).json({ success: false, error: 'Failed to generate magic link.' });
        }

        const baseUrl = resolveOrigin(req).replace(/\/$/, '');
        const page = body.page === 'dashboard' ? 'dashboard' : 'ceo-dashboard';
        const magicLinkUrl = `${baseUrl}/${page}?auth_token=${encodeURIComponent(token)}`;

        const emailResult = await sendMagicLinkEmail(magicLinkUrl);

        if (!emailResult.success && !emailResult.devMode) {
            return res.status(500).json({ success: false, error: emailResult.error || 'Failed to send email.' });
        }

        console.log(`[CEOAuth] Magic link sent to ${CEO_EMAIL} from ${clientIp}`);
        return res.status(200).json({
            success: true,
            message: emailResult.devMode
                ? 'Dev mode: Check server console for magic link URL.'
                : `Magic link sent to ${CEO_EMAIL.replace(/(.{2}).*(@.*)/, '$1***$2')}`,
            expiresIn: Math.floor(CONFIG.MAGIC_LINK_EXPIRY_MS / 1000),
            devMode: emailResult.devMode || false,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION: verify-magic-link - Verify magic link token
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'verify-magic-link') {
        const { token } = body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ success: false, error: 'Token required' });
        }

        const result = verifyMagicToken(token.trim());

        if (!result.valid) {
            console.log(`[CEOAuth] Magic link verification failed from ${clientIp}: ${result.expired ? 'expired' : 'invalid'}`);
            return res.status(401).json({
                success: false,
                error: result.expired ? 'Magic link expired. Please request a new one.' : 'Invalid magic link.'
            });
        }

        const sessionToken = generateSessionToken('magic-link');
        if (!sessionToken) {
            return res.status(500).json({ success: false, error: 'Session generation failed.' });
        }

        console.log(`[CEOAuth] Magic link verified from ${clientIp}`);
        return res.status(200).json({
            success: true,
            message: 'Welcome! Access granted via magic link.',
            sessionToken,
            expiresIn: Math.floor(CONFIG.SESSION_DURATION_MS / 1000),
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION: verify-session - Verify session token
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'verify-session') {
        const { sessionToken } = body;

        if (!sessionToken) {
            return res.status(400).json({ success: false, error: 'Session token required' });
        }

        const result = verifySessionToken(sessionToken);

        if (!result.valid) {
            return res.status(401).json({
                success: false,
                error: result.expired ? 'Session expired. Please log in again.' : 'Invalid session.'
            });
        }

        return res.status(200).json({
            success: true,
            verified: true,
            method: result.payload.method,
            expiresAt: result.payload.exp,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unknown action
    // ─────────────────────────────────────────────────────────────────────────
    return res.status(400).json({
        success: false,
        error: 'Invalid action. Use: status, pin, send-magic-link, verify-magic-link, verify-session'
    });
};
