const { put } = require("@vercel/blob");
const crypto = require("crypto");
const { encrypt } = require("./_lib/crypto");

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_INTEREST_LENGTH = 1000;
const MAX_POLICY_VERSION_LENGTH = 32;
const MAX_HONEYPOT_LENGTH = 120;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_IP_MAX = 8;
const RATE_LIMIT_EMAIL_MAX = 4;
const RATE_LIMIT_MAX_ENTRIES = 5000;

const rateLimitStore = new Map();

function getHeaderValue(value) {
  if (Array.isArray(value)) return value[0] || "";
  if (typeof value === "string") return value;
  return "";
}

function getClientIp(req) {
  const forwarded = getHeaderValue(req.headers["x-forwarded-for"]);
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = getHeaderValue(req.headers["x-real-ip"]);
  if (realIp) return realIp.trim();
  const remote = req.socket?.remoteAddress || req.connection?.remoteAddress;
  return remote || "unknown";
}

function pruneRateLimitStore(now) {
  if (rateLimitStore.size <= RATE_LIMIT_MAX_ENTRIES) return;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (!entry || !entry.lastSeen || now - entry.lastSeen > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
    if (rateLimitStore.size <= RATE_LIMIT_MAX_ENTRIES) break;
  }
}

function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  const timestamps = entry ? entry.timestamps : [];
  const cutoff = now - windowMs;
  const recent = timestamps.filter((ts) => ts > cutoff);

  if (recent.length >= limit) {
    rateLimitStore.set(key, { timestamps: recent, lastSeen: now });
    pruneRateLimitStore(now);
    const retryAfterMs = recent[0] + windowMs - now;
    return { limited: true, retryAfterMs };
  }

  recent.push(now);
  rateLimitStore.set(key, { timestamps: recent, lastSeen: now });
  pruneRateLimitStore(now);
  return { limited: false, retryAfterMs: 0 };
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
  const ipLimit = checkRateLimit(`ip:${clientIp}`, RATE_LIMIT_IP_MAX, RATE_LIMIT_WINDOW_MS);
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

  const emailLimit = checkRateLimit(`email:${email}`, RATE_LIMIT_EMAIL_MAX, RATE_LIMIT_WINDOW_MS);
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
      access: "public",
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
