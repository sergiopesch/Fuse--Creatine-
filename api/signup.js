const { put } = require('@vercel/blob');
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');
const { encrypt } = require('./_lib/crypto');
const { createSecuredHandler } = require('./_lib/security');

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_INTEREST_LENGTH = 1000;
const MAX_POLICY_VERSION_LENGTH = 32;
const MAX_HONEYPOT_LENGTH = 120;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_IP_MAX = 8;
const RATE_LIMIT_EMAIL_MAX = 4;

// Initialize Redis client if configuration is available
const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? Redis.fromEnv()
        : null;

/**
 * Checks rate limit for a given key using a fixed window counter algorithm in Redis.
 */
async function checkRateLimit(redis, key, limit, windowMs) {
    if (!redis) {
        console.warn('Rate limiting is disabled because Redis is not configured.');
        return { limited: false, retryAfterMs: 0 };
    }

    const windowSec = Math.ceil(windowMs / 1000);
    const rateLimitKey = `rate_limit:signup:${key}`;

    try {
        const count = await redis.incr(rateLimitKey);
        if (count === 1) {
            await redis.expire(rateLimitKey, windowSec);
        }
        if (count > limit) {
            const ttl = await redis.ttl(rateLimitKey);
            return { limited: true, retryAfterMs: ttl * 1000 };
        }
        return { limited: false, retryAfterMs: 0 };
    } catch (error) {
        console.error('Redis rate limit check failed:', error);
        return { limited: false, retryAfterMs: 0 };
    }
}

function hashEmail(email) {
    return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16);
}

const validationSchema = {
    fullName: { required: true, type: 'string', maxLength: MAX_NAME_LENGTH },
    email: { required: true, type: 'string', maxLength: MAX_EMAIL_LENGTH },
    mainInterest: { required: true, type: 'string', maxLength: MAX_INTEREST_LENGTH },
    policyVersion: { required: true, type: 'string', maxLength: MAX_POLICY_VERSION_LENGTH },
    consentToContact: { required: true, type: 'boolean' },
    company: { required: false, type: 'string', maxLength: MAX_HONEYPOT_LENGTH },
};

const signupHandler = async (req, res, { clientIp, validatedBody }) => {
    // Honeypot check
    if (validatedBody.company) {
        return res.status(400).json({ error: 'Unable to process request' });
    }

    const email = validatedBody.email.toLowerCase();

    // Email format validation
    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'Valid email is required' });
    }

    // IP-based rate limiting
    const ipLimit = await checkRateLimit(
        redis,
        `ip:${clientIp}`,
        RATE_LIMIT_IP_MAX,
        RATE_LIMIT_WINDOW_MS
    );
    if (ipLimit.limited) {
        res.setHeader('Retry-After', Math.ceil(ipLimit.retryAfterMs / 1000));
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    // Email-based rate limiting
    const emailLimit = await checkRateLimit(
        redis,
        `email:${email}`,
        RATE_LIMIT_EMAIL_MAX,
        RATE_LIMIT_WINDOW_MS
    );
    if (emailLimit.limited) {
        res.setHeader('Retry-After', Math.ceil(emailLimit.retryAfterMs / 1000));
        return res
            .status(429)
            .json({ error: 'Too many requests for this email. Please try again later.' });
    }

    if (!validatedBody.consentToContact) {
        return res.status(400).json({ error: 'Consent is required' });
    }

    const signupData = {
        email,
        fullName: validatedBody.fullName,
        mainInterest: validatedBody.mainInterest,
        consentToContact: validatedBody.consentToContact,
        policyVersion: validatedBody.policyVersion,
        consentTimestamp: new Date().toISOString(),
        signupDate: new Date().toISOString(),
    };

    try {
        const safeId = hashEmail(email);
        const filename = `signups/${safeId}_${Date.now()}.json`;

        let dataToStore = signupData;
        const encryptionKey = process.env.ENCRYPTION_KEY;

        if (encryptionKey) {
            try {
                const encrypted = encrypt(JSON.stringify(signupData), encryptionKey);
                dataToStore = {
                    payload: encrypted,
                    version: 1,
                    storedAt: new Date().toISOString(),
                };
            } catch (encError) {
                console.error('Encryption failed:', encError);
                return res.status(500).json({ error: 'Internal server error' });
            }
        } else {
            console.warn('ENCRYPTION_KEY not set. Storing unencrypted data.');
        }

        await put(filename, JSON.stringify(dataToStore), {
            access: 'private',
            addRandomSuffix: true,
            contentType: 'application/json',
        });

        return res.status(200).json({
            message: 'Successfully joined the waitlist',
        });
    } catch (error) {
        console.error('Vercel Blob Error:', error);
        return res.status(500).json({
            error: 'Unable to store signup at this time. Please try again.',
        });
    }
};

module.exports = createSecuredHandler(
    {
        requireAuth: false,
        allowedMethods: ['POST'],
        validationSchema,
        // Disable the generic rate limiter in createSecuredHandler, as we use
        // more specific IP and email-based rate limiting inside the handler.
        rateLimit: null,
    },
    signupHandler
);
