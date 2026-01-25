const { list } = require("@vercel/blob");
const crypto = require("crypto");
const { decrypt } = require("./_lib/crypto");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getHeaderValue(value) {
  if (Array.isArray(value)) return value[0] || "";
  if (typeof value === "string") return value;
  return "";
}

function getAuthToken(req) {
  const authHeader = getHeaderValue(req.headers.authorization);
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  const altHeader = getHeaderValue(req.headers["x-admin-token"]);
  return altHeader.trim();
}

function normalizeString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
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

function tokensMatch(provided, expected) {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

async function fetchSignup(blob) {
  const url = blob.downloadUrl || blob.url;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load blob ${blob.pathname}`);
  }

  let data = await response.json();
  
  // Handle encrypted data
  if (data.payload && data.version === 1) {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (encryptionKey) {
      try {
        const decrypted = decrypt(data.payload, encryptionKey);
        data = JSON.parse(decrypted);
      } catch (e) {
        console.error(`Failed to decrypt blob ${blob.pathname}:`, e);
        // Return a placeholder or error object so we know something went wrong but don't crash
        return {
           id: blob.pathname,
           fullName: "Error: Decryption Failed",
           email: "Error",
           mainInterest: "Error",
           consentToContact: false,
           consentTimestamp: "",
           policyVersion: "",
           signupDate: blob.uploadedAt.toISOString(),
           storedAt: blob.uploadedAt.toISOString(),
        };
      }
    } else {
       console.error("Missing ENCRYPTION_KEY for encrypted blob");
       return {
           id: blob.pathname,
           fullName: "Error: Missing Key",
           email: "Error",
           mainInterest: "Error",
           consentToContact: false,
           consentTimestamp: "",
           policyVersion: "",
           signupDate: blob.uploadedAt.toISOString(),
           storedAt: blob.uploadedAt.toISOString(),
        };
    }
  }

  return {
    id: blob.pathname,
    fullName: data.fullName || "",
    email: data.email || "",
    mainInterest: data.mainInterest || "",
    consentToContact: Boolean(data.consentToContact),
    consentTimestamp: data.consentTimestamp || "",
    policyVersion: data.policyVersion || "",
    signupDate: data.signupDate || blob.uploadedAt.toISOString(),
    storedAt: blob.uploadedAt.toISOString(),
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return res.status(500).json({ error: "Admin access is not configured" });
  }

  const providedToken = getAuthToken(req);
  if (!tokensMatch(providedToken, adminToken)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const limitParam = parseInt(req.query && req.query.limit ? req.query.limit : "", 10);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const cursor = req.query && req.query.cursor ? String(req.query.cursor) : undefined;
  const emailFilter = req.query && req.query.email ? normalizeEmail(req.query.email) : "";

  if (emailFilter && !isValidEmail(emailFilter)) {
    return res.status(400).json({ error: "Valid email filter is required" });
  }

  try {
    const { blobs, cursor: nextCursor, hasMore } = await list({
      prefix: emailFilter ? `signups/${hashEmail(emailFilter)}_` : "signups/",
      limit,
      cursor,
    });

    const results = await Promise.allSettled(blobs.map((blob) => fetchSignup(blob)));
    const signups = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value)
      .sort((a, b) => new Date(b.signupDate) - new Date(a.signupDate));

    return res.status(200).json({
      signups,
      cursor: nextCursor || null,
      hasMore: Boolean(hasMore),
    });
  } catch (error) {
    console.error("Admin list error:", error);
    return res.status(500).json({ error: "Unable to load signups" });
  }
};
