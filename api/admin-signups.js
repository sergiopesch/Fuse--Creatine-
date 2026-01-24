const { list } = require("@vercel/blob");
const crypto = require("crypto");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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

  const data = await response.json();
  return {
    id: blob.pathname,
    fullName: data.fullName || "",
    email: data.email || "",
    mainInterest: data.mainInterest || "",
    signupDate: data.signupDate || blob.uploadedAt.toISOString(),
    storedAt: blob.uploadedAt.toISOString(),
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");

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

  try {
    const { blobs, cursor: nextCursor, hasMore } = await list({
      prefix: "signups/",
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
