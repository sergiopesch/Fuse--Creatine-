/**
 * FUSE Security Middleware Library
 * Provides authentication, rate limiting, request validation, and audit logging
 *
 * @version 2.0.0
 * @security-critical - Do not modify without thorough review
 */

const crypto = require('crypto');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Rate limiting defaults
    RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
    RATE_LIMIT_MAX_REQUESTS: 100,
    RATE_LIMIT_MAX_ENTRIES: 5000,

    // Request size limits
    MAX_REQUEST_BODY_SIZE: 10 * 1024, // 10KB
    MAX_STRING_LENGTH: 2000,
    MAX_ARRAY_LENGTH: 100,

    // Token configuration
    MIN_TOKEN_LENGTH: 32,

    // Audit log retention
    MAX_AUDIT_ENTRIES: 1000,
};

// ============================================================================
// IN-MEMORY STORES (Consider Redis/KV for production)
// ============================================================================

const rateLimitStore = new Map();
const auditLog = [];

// ============================================================================
// ALLOWED ORIGINS
// ============================================================================

const ALLOWED_ORIGINS = [
    'https://fuse-creatine.vercel.app',
    'https://www.fusecreatine.com',
    'https://fusecreatine.com',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get header value (handles array or string)
 */
function getHeaderValue(value) {
    if (Array.isArray(value)) return value[0] || '';
    if (typeof value === 'string') return value;
    return '';
}

/**
 * Get client IP from request
 */
function getClientIp(req) {
    const forwarded = getHeaderValue(req.headers['x-forwarded-for']);
    if (forwarded) return forwarded.split(',')[0].trim();
    const realIp = getHeaderValue(req.headers['x-real-ip']);
    if (realIp) return realIp.trim();
    const remote = req.socket?.remoteAddress || req.connection?.remoteAddress;
    return remote || 'unknown';
}

/**
 * Get authorization token from request
 */
function getAuthToken(req) {
    const authHeader = getHeaderValue(req.headers.authorization);
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }
    // Also check X-Admin-Token header for flexibility
    const altHeader = getHeaderValue(req.headers['x-admin-token']);
    if (altHeader) return altHeader.trim();
    return null;
}

/**
 * Timing-safe token comparison
 */
function tokensMatch(provided, expected) {
    if (!provided || !expected) return false;
    if (provided.length < CONFIG.MIN_TOKEN_LENGTH) return false;

    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);

    if (providedBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Prune old entries from rate limit store
 */
function pruneRateLimitStore(now) {
    if (rateLimitStore.size <= CONFIG.RATE_LIMIT_MAX_ENTRIES) return;

    for (const [key, entry] of rateLimitStore.entries()) {
        if (!entry || !entry.lastSeen || now - entry.lastSeen > CONFIG.RATE_LIMIT_WINDOW_MS) {
            rateLimitStore.delete(key);
        }
        if (rateLimitStore.size <= CONFIG.RATE_LIMIT_MAX_ENTRIES) break;
    }
}

// ============================================================================
// CORS HANDLING
// ============================================================================

/**
 * Get appropriate CORS origin
 */
function getCorsOrigin(requestOrigin) {
    if (!requestOrigin) return ALLOWED_ORIGINS[0];
    if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
    // Allow Vercel preview deployments
    if (requestOrigin.endsWith('.vercel.app')) return requestOrigin;
    return null; // Reject unknown origins
}

/**
 * Set security headers on response
 */
function setSecurityHeaders(res, origin, methods = 'GET, POST, PUT, DELETE, OPTIONS') {
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, X-Request-ID');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Authenticate request using Bearer token
 * @param {object} req - Request object
 * @param {string} expectedToken - Expected token from environment
 * @returns {{ authenticated: boolean, error?: string }}
 */
function authenticate(req, expectedToken) {
    if (!expectedToken) {
        return { authenticated: false, error: 'Authentication not configured' };
    }

    const providedToken = getAuthToken(req);

    if (!providedToken) {
        return { authenticated: false, error: 'Authorization token required' };
    }

    if (!tokensMatch(providedToken, expectedToken)) {
        return { authenticated: false, error: 'Invalid authorization token' };
    }

    return { authenticated: true };
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Check rate limit for a given key
 * @param {string} key - Rate limit key (e.g., 'ip:192.168.1.1' or 'user:admin')
 * @param {number} limit - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ limited: boolean, remaining: number, retryAfterMs?: number }}
 */
function checkRateLimit(key, limit = CONFIG.RATE_LIMIT_MAX_REQUESTS, windowMs = CONFIG.RATE_LIMIT_WINDOW_MS) {
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    const timestamps = entry ? entry.timestamps : [];
    const cutoff = now - windowMs;
    const recent = timestamps.filter(ts => ts > cutoff);

    if (recent.length >= limit) {
        rateLimitStore.set(key, { timestamps: recent, lastSeen: now });
        pruneRateLimitStore(now);
        const retryAfterMs = recent[0] + windowMs - now;
        return {
            limited: true,
            remaining: 0,
            retryAfterMs,
            resetAt: new Date(recent[0] + windowMs).toISOString()
        };
    }

    recent.push(now);
    rateLimitStore.set(key, { timestamps: recent, lastSeen: now });
    pruneRateLimitStore(now);

    return {
        limited: false,
        remaining: limit - recent.length,
        resetAt: new Date(now + windowMs).toISOString()
    };
}

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

/**
 * Validate request body size and structure
 * @param {object} body - Request body
 * @param {object} schema - Validation schema
 * @returns {{ valid: boolean, error?: string, sanitized?: object }}
 */
function validateRequestBody(body, schema = {}) {
    // Check if body exists
    if (!body || typeof body !== 'object') {
        return { valid: false, error: 'Request body must be a JSON object' };
    }

    // Check body size (rough estimate)
    const bodyString = JSON.stringify(body);
    if (bodyString.length > CONFIG.MAX_REQUEST_BODY_SIZE) {
        return { valid: false, error: `Request body too large (max ${CONFIG.MAX_REQUEST_BODY_SIZE} bytes)` };
    }

    const sanitized = {};

    // Validate against schema
    for (const [field, rules] of Object.entries(schema)) {
        const value = body[field];

        // Required check
        if (rules.required && (value === undefined || value === null || value === '')) {
            return { valid: false, error: `${field} is required` };
        }

        // Skip validation if not present and not required
        if (value === undefined || value === null) {
            if (rules.default !== undefined) {
                sanitized[field] = rules.default;
            }
            continue;
        }

        // Type validation
        if (rules.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== rules.type) {
                return { valid: false, error: `${field} must be of type ${rules.type}` };
            }
        }

        // String length validation
        if (rules.type === 'string' && typeof value === 'string') {
            if (rules.maxLength && value.length > rules.maxLength) {
                return { valid: false, error: `${field} exceeds maximum length of ${rules.maxLength}` };
            }
            if (rules.minLength && value.length < rules.minLength) {
                return { valid: false, error: `${field} must be at least ${rules.minLength} characters` };
            }
            // Sanitize string
            sanitized[field] = sanitizeString(value, rules.maxLength || CONFIG.MAX_STRING_LENGTH);
        }

        // Array validation
        if (rules.type === 'array' && Array.isArray(value)) {
            if (rules.maxItems && value.length > rules.maxItems) {
                return { valid: false, error: `${field} exceeds maximum items of ${rules.maxItems}` };
            }
            sanitized[field] = value.slice(0, rules.maxItems || CONFIG.MAX_ARRAY_LENGTH);
        }

        // Enum validation
        if (rules.enum && !rules.enum.includes(value)) {
            return { valid: false, error: `${field} must be one of: ${rules.enum.join(', ')}` };
        }

        // Copy value if not already sanitized
        if (sanitized[field] === undefined) {
            sanitized[field] = value;
        }
    }

    return { valid: true, sanitized };
}

/**
 * Sanitize string input
 */
function sanitizeString(input, maxLength = CONFIG.MAX_STRING_LENGTH) {
    if (typeof input !== 'string') return '';

    let sanitized = input;

    // Remove zero-width and invisible characters
    sanitized = sanitized.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '');

    // Remove control characters (keep newlines and tabs)
    sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');

    // Trim and limit length
    sanitized = sanitized.trim().slice(0, maxLength);

    return sanitized;
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Add entry to audit log
 * @param {object} entry - Audit log entry
 */
function addAuditEntry(entry) {
    const auditEntry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        ...entry
    };

    auditLog.unshift(auditEntry);

    // Keep only recent entries
    if (auditLog.length > CONFIG.MAX_AUDIT_ENTRIES) {
        auditLog.length = CONFIG.MAX_AUDIT_ENTRIES;
    }

    // Log to console for serverless function logs
    console.log('[Audit]', JSON.stringify({
        action: entry.action,
        ip: entry.ip,
        success: entry.success,
        endpoint: entry.endpoint
    }));

    return auditEntry;
}

/**
 * Get recent audit entries
 * @param {number} limit - Maximum entries to return
 * @param {object} filters - Optional filters
 * @returns {array} Filtered audit entries
 */
function getAuditLog(limit = 50, filters = {}) {
    let entries = [...auditLog];

    if (filters.action) {
        entries = entries.filter(e => e.action === filters.action);
    }
    if (filters.ip) {
        entries = entries.filter(e => e.ip === filters.ip);
    }
    if (filters.success !== undefined) {
        entries = entries.filter(e => e.success === filters.success);
    }

    return entries.slice(0, limit);
}

// ============================================================================
// MIDDLEWARE WRAPPER
// ============================================================================

/**
 * Create a secured handler with authentication, rate limiting, and validation
 * @param {object} options - Configuration options
 * @param {function} handler - The actual request handler
 * @returns {function} Secured handler function
 */
function createSecuredHandler(options, handler) {
    const {
        requireAuth = true,
        authTokenEnvVar = 'ADMIN_TOKEN',
        rateLimit = { limit: 100, windowMs: 60000 },
        allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        validationSchema = null,
    } = options;

    return async (req, res) => {
        const clientIp = getClientIp(req);
        const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
        const startTime = Date.now();

        // Set security headers
        const origin = getCorsOrigin(req.headers.origin);
        setSecurityHeaders(res, origin, allowedMethods.join(', '));

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        // Validate origin
        if (req.headers.origin && !origin) {
            addAuditEntry({
                action: 'CORS_REJECTED',
                ip: clientIp,
                origin: req.headers.origin,
                success: false,
                endpoint: req.url
            });
            return res.status(403).json({
                error: 'Origin not allowed',
                code: 'CORS_ERROR'
            });
        }

        // Method validation
        if (!allowedMethods.includes(req.method)) {
            return res.status(405).json({
                error: 'Method not allowed',
                code: 'METHOD_NOT_ALLOWED'
            });
        }

        // Rate limiting
        if (rateLimit) {
            const rateLimitResult = checkRateLimit(
                `${req.url}:${clientIp}`,
                rateLimit.limit,
                rateLimit.windowMs
            );

            // Add rate limit headers
            res.setHeader('X-RateLimit-Limit', rateLimit.limit);
            res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining);
            res.setHeader('X-RateLimit-Reset', rateLimitResult.resetAt);

            if (rateLimitResult.limited) {
                res.setHeader('Retry-After', Math.ceil(rateLimitResult.retryAfterMs / 1000));

                addAuditEntry({
                    action: 'RATE_LIMITED',
                    ip: clientIp,
                    success: false,
                    endpoint: req.url,
                    method: req.method
                });

                return res.status(429).json({
                    error: 'Too many requests. Please slow down.',
                    code: 'RATE_LIMITED',
                    retryAfter: Math.ceil(rateLimitResult.retryAfterMs / 1000)
                });
            }
        }

        // Authentication
        if (requireAuth) {
            const expectedToken = process.env[authTokenEnvVar];
            const authResult = authenticate(req, expectedToken);

            if (!authResult.authenticated) {
                addAuditEntry({
                    action: 'AUTH_FAILED',
                    ip: clientIp,
                    success: false,
                    endpoint: req.url,
                    method: req.method,
                    reason: authResult.error
                });

                return res.status(401).json({
                    error: authResult.error,
                    code: 'UNAUTHORIZED'
                });
            }
        }

        // Request body validation for POST/PUT
        let validatedBody = null;
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && validationSchema) {
            const validation = validateRequestBody(req.body, validationSchema);

            if (!validation.valid) {
                addAuditEntry({
                    action: 'VALIDATION_FAILED',
                    ip: clientIp,
                    success: false,
                    endpoint: req.url,
                    method: req.method,
                    reason: validation.error
                });

                return res.status(400).json({
                    error: validation.error,
                    code: 'VALIDATION_ERROR'
                });
            }

            validatedBody = validation.sanitized;
        }

        // Call the actual handler
        try {
            const result = await handler(req, res, {
                clientIp,
                requestId,
                validatedBody: validatedBody || req.body
            });

            // Log successful request
            addAuditEntry({
                action: 'REQUEST_SUCCESS',
                ip: clientIp,
                success: true,
                endpoint: req.url,
                method: req.method,
                duration: Date.now() - startTime
            });

            return result;
        } catch (error) {
            console.error('[Security] Handler error:', error);

            addAuditEntry({
                action: 'REQUEST_ERROR',
                ip: clientIp,
                success: false,
                endpoint: req.url,
                method: req.method,
                error: error.message
            });

            return res.status(500).json({
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Configuration
    CONFIG,
    ALLOWED_ORIGINS,

    // Helper functions
    getHeaderValue,
    getClientIp,
    getAuthToken,
    tokensMatch,

    // CORS
    getCorsOrigin,
    setSecurityHeaders,

    // Authentication
    authenticate,

    // Rate limiting
    checkRateLimit,
    rateLimitStore, // Exposed for testing

    // Validation
    validateRequestBody,
    sanitizeString,

    // Audit logging
    addAuditEntry,
    getAuditLog,
    auditLog, // Exposed for testing

    // Middleware
    createSecuredHandler
};
