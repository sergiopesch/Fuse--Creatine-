const { put } = require("@vercel/blob");
const crypto = require("crypto");

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_INTEREST_LENGTH = 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseBody(req);
  if (body === null) {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  const fullName = normalizeString(body.fullName);
  const email = normalizeEmail(body.email);
  const mainInterest = normalizeString(body.mainInterest);

  if (!fullName) {
    return res.status(400).json({ error: "Full name is required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  if (!mainInterest) {
    return res.status(400).json({ error: "Main interest is required" });
  }

  if (mainInterest.length > MAX_INTEREST_LENGTH) {
    return res.status(400).json({ error: "Main interest is too long" });
  }

  const signupData = {
    email,
    fullName: fullName.slice(0, MAX_NAME_LENGTH),
    mainInterest: mainInterest.slice(0, MAX_INTEREST_LENGTH),
    signupDate: new Date().toISOString(),
  };

  try {
    const safeId = hashEmail(email);
    const filename = `signups/${safeId}_${Date.now()}.json`;

    await put(filename, JSON.stringify(signupData), {
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
