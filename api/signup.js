const { put } = require("@vercel/blob");
const crypto = require("crypto");
const { Redis } = require("@upstash/redis");
const { encrypt } = require("./_lib/crypto");
// Import shared utilities to avoid code duplication
const { getClientIp, getHeaderValue } = require("./_lib/security");

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
 * @param {Redis | null} redis - The Redis client instance.
 * @param {string} key - The key to rate limit against.
 * @param {number} limit - The maximum number of requests allowed.
 * @param {number} windowMs - The time window in milliseconds.
 * @returns {Promise<{ limited: boolean, retryAfterMs: number }>}
 */
async function checkRateLimit(redis, key, limit, windowMs) {
  if (!redis) {
    // If Redis is not configured, bypass rate limiting.
    // Log this event for monitoring purposes.
    console.warn("Rate limiting is disabled because Redis is not configured.");
    return { limited: false, retryAfterMs: 0 };
  }

  const windowSec = Math.ceil(windowMs / 1000);
  // Add a prefix to avoid key collisions in Redis
  const rateLimitKey = `rate_limit:signup:${key}`;

  try {
    const count = await redis.incr(rateLimitKey);

    // Set expiry only on the first increment in the window
    if (count === 1) {
      await redis.expire(rateLimitKey, windowSec);
    }

    if (count > limit) {
      const ttl = await redis.ttl(rateLimitKey);
      // Return retry-after in milliseconds
      return { limited: true, retryAfterMs: ttl * 1000 };
    }

    return { limited: false, retryAfterMs: 0 };
  } catch (error) {
    console.error("Redis rate limit check failed:", error);
    // In case of Redis error, fail open (allow request) to not block users.
    return { limited: false, retryAfterMs: 0 };
  }
}


function parseBody(req) {
  if (!req || typeof req.body === "undefined") return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return null;
    }
  }
  if (typeof req.body === "object" && req.body) return req.body;
  return {};
}

function normalizeString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }
  return false;
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function isValidEmail(email) {
  return email.length > 0 && email.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(email);
}

function hashEmail(email) {
  return crypto.createHash("sha256").update(email).digest("hex").slice(0, 16);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const contentType = req.headers["content-type"] || "";
  if (contentType && !contentType.includes("application/json")) {
    return res.status(415).json({ error: "Unsupported content type" });
  }

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } catch (error) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  const clientIp = getClientIp(req);
  const ipLimit = await checkRateLimit(redis, `ip:${clientIp}`, RATE_LIMIT_IP_MAX, RATE_LIMIT_WINDOW_MS);
  if (ipLimit.limited) {
    res.setHeader("Retry-After", Math.ceil(ipLimit.retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const body = parseBody(req);
  if (body === null) {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  const fullName = normalizeString(body.fullName);
  const email = normalizeEmail(body.email);
  const mainInterest = normalizeString(body.mainInterest);
  const policyVersion = normalizeString(body.policyVersion);
  const consentToContact = parseBoolean(body.consentToContact);
  const honeypot = normalizeString(body.company || "").slice(0, MAX_HONEYPOT_LENGTH);

  if (honeypot) {
    return res.status(400).json({ error: "Unable to process request" });
  }

  if (!fullName) {
    return res.status(400).json({ error: "Full name is required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  const emailLimit = await checkRateLimit(redis, `email:${email}`, RATE_LIMIT_EMAIL_MAX, RATE_LIMIT_WINDOW_MS);
  if (emailLimit.limited) {
    res.setHeader("Retry-After", Math.ceil(emailLimit.retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  if (!mainInterest) {
    return res.status(400).json({ error: "Main interest is required" });
  }

  if (mainInterest.length > MAX_INTEREST_LENGTH) {
    return res.status(400).json({ error: "Main interest is too long" });
  }

  if (!consentToContact) {
    return res.status(400).json({ error: "Consent is required" });
  }

  if (policyVersion.length > MAX_POLICY_VERSION_LENGTH) {
    return res.status(400).json({ error: "Policy version is invalid" });
  }

  const signupData = {
    email,
    fullName: fullName.slice(0, MAX_NAME_LENGTH),
    mainInterest: mainInterest.slice(0, MAX_INTEREST_LENGTH),
    consentToContact,
    policyVersion: policyVersion ? policyVersion.slice(0, MAX_POLICY_VERSION_LENGTH) : "unknown",
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
          // Store non-PII metadata for easier debugging/listing if needed, but keep PII encrypted
          // Actually, let's keep it simple and just store the payload wrapper
          storedAt: new Date().toISOString()
        };
      } catch (encError) {
        console.error("Encryption failed:", encError);
        return res.status(500).json({ error: "Internal server error" });
      }
    } else {
        console.warn("ENCRYPTION_KEY not set. Storing unencrypted data.");
    }

    await put(filename, JSON.stringify(dataToStore), {
      access: "private",
      addRandomSuffix: true,
      contentType: "application/json",
    });

    return res.status(200).json({
      message: "Successfully joined the waitlist",
    });
  } catch (error) {
    console.error("Vercel Blob Error:", error);
    return res.status(500).json({
      error: "Unable to store signup at this time. Please try again.",
    });
  }
};
