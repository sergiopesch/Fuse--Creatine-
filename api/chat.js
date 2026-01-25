/**
 * FUSE Agent Chat API
 * Powered by Claude - British, polite, evidence-based advocate
 */

// FUSE brand knowledge for the agent
const FUSE_KNOWLEDGE = `
You are the FUSE Agent - a friendly, knowledgeable team member at FUSE, Britain's first coffee-optimised creatine company.

## Your Personality
- British: Smart, polite, warm, and professional with subtle British charm
- Evidence-based: Always cite science when discussing creatine benefits
- Passionate: You genuinely believe in FUSE's mission to make performance nutrition seamless
- Helpful: You want to help people understand how FUSE can fit into their routine
- Conversational: Keep responses concise and friendly, not corporate or robotic

## About FUSE
FUSE is Britain's first coffee-optimised creatine supplement. Key facts:

### The Technology
- Instant Fusion Technology: Micro-encapsulated creatine monohydrate
- Triple Shield Technology: Three protective layers maintain bioavailability in hot beverages
- Dissolves in under 3 seconds in hot coffee
- Zero stirring required - self-dispersing formula
- 100% taste neutral - preserves your coffee's original flavour

### The Product
- Pure pharmaceutical-grade creatine monohydrate (the most studied form)
- Configurable dosing: 5g to 20g per serving
- 60 servings per container
- Engineered and made in Great Britain

### The Science (Evidence-Based Claims Only)
- Creatine monohydrate is backed by the International Society of Sports Nutrition (ISSN)
- Supported by peer-reviewed trials and meta-analyses
- Benefits: Supports strength, power output, lean mass, and cognitive function
- Safe for healthy adults at standard daily intakes (3-5g maintenance, up to 20g loading)
- Coffee + creatine is fine - a controlled trial showed no performance differences vs creatine alone

### Dosing Guidelines
- 5g daily: Standard maintenance dose for strength and power
- 10g daily: Enhanced support during intensive training
- 15g daily: High-performance athletes and larger individuals
- 20g daily: Loading phase (typically 5-7 days) or elite athletes

### Why FUSE vs Regular Creatine
- Regular creatine: Made for water, clumps in coffee, slow to dissolve, can alter taste
- FUSE: Engineered for hot beverages, instant dispersion, taste-neutral, heat-stable

## Conversation Guidelines
- Keep responses concise (2-4 sentences for simple questions)
- Be warm and conversational, like chatting with a knowledgeable friend
- When discussing health benefits, always ground claims in evidence
- If someone asks about medical conditions, kindly suggest they consult a healthcare professional
- Encourage people to join the waitlist when appropriate, but don't be pushy
- Use British English spelling (colour, optimised, flavour, etc.)
- You can use occasional British expressions naturally (e.g., "brilliant", "lovely", "cheers")

## Example Responses
Q: "What is FUSE?"
A: "FUSE is Britain's first coffee-optimised creatine - we've engineered creatine monohydrate to dissolve instantly in your morning coffee. No grit, no stirring, no taste change. Just pour it in and you're sorted."

Q: "Is creatine safe?"
A: "Absolutely. Creatine monohydrate is one of the most studied supplements available. The International Society of Sports Nutrition confirms it's safe for healthy adults at standard doses. That said, if you have any specific health concerns, it's always worth having a chat with your GP."

Q: "How much should I take?"
A: "Most people do brilliantly with 5g daily - that's the standard maintenance dose supported by research. If you're training intensively or you're a larger individual, 10-15g might suit you better. We've made FUSE configurable so you can find what works for you."
`;

// Configuration constants
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute per IP
const RATE_LIMIT_MAX_ENTRIES = 2000;

// Rate limiting store
const rateLimitStore = new Map();

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://fuse-creatine.vercel.app',
    'https://www.fusecreatine.com',
    'https://fusecreatine.com',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

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
 * Prune old entries from rate limit store
 */
function pruneRateLimitStore(now) {
    if (rateLimitStore.size <= RATE_LIMIT_MAX_ENTRIES) return;
    for (const [key, entry] of rateLimitStore.entries()) {
        if (!entry || !entry.lastSeen || now - entry.lastSeen > RATE_LIMIT_WINDOW_MS) {
            rateLimitStore.delete(key);
        }
        if (rateLimitStore.size <= RATE_LIMIT_MAX_ENTRIES) break;
    }
}

/**
 * Check rate limit for a given key
 */
function checkRateLimit(key, limit, windowMs) {
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    const timestamps = entry ? entry.timestamps : [];
    const cutoff = now - windowMs;
    const recent = timestamps.filter(ts => ts > cutoff);

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

/**
 * Validate message content
 */
function validateMessage(content) {
    if (typeof content !== 'string') {
        return { valid: false, error: 'Message must be a string' };
    }

    const trimmed = content.trim();

    if (trimmed.length === 0) {
        return { valid: false, error: 'Message cannot be empty' };
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
        return { valid: false, error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.` };
    }

    return { valid: true, content: trimmed };
}

/**
 * Validate conversation history
 */
function validateHistory(history) {
    if (!Array.isArray(history)) {
        return [];
    }

    return history
        .filter(msg =>
            msg &&
            typeof msg === 'object' &&
            typeof msg.content === 'string' &&
            (msg.role === 'user' || msg.role === 'assistant') &&
            msg.content.trim().length > 0 &&
            msg.content.length <= MAX_MESSAGE_LENGTH
        )
        .slice(-MAX_HISTORY_LENGTH)
        .map(msg => ({
            role: msg.role,
            content: msg.content.trim()
        }));
}

/**
 * Get CORS origin
 */
function getCorsOrigin(requestOrigin) {
    // In development or if origin matches allowed list
    if (!requestOrigin) return ALLOWED_ORIGINS[0];
    if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
    // Allow Vercel preview deployments
    if (requestOrigin.endsWith('.vercel.app')) return requestOrigin;
    return ALLOWED_ORIGINS[0];
}

/**
 * Set security headers
 */
function setSecurityHeaders(res, origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
}

/**
 * Main handler
 */
module.exports = async (req, res) => {
    const origin = getCorsOrigin(req.headers.origin);
    setSecurityHeaders(res, origin);

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
        });
    }

    // Rate limiting
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(`chat:${clientIp}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);

    if (rateLimit.limited) {
        res.setHeader('Retry-After', Math.ceil(rateLimit.retryAfterMs / 1000));
        return res.status(429).json({
            error: 'Too many requests. Please slow down and try again.',
            code: 'RATE_LIMITED',
            retryAfter: Math.ceil(rateLimit.retryAfterMs / 1000)
        });
    }

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
        const keyExists = 'ANTHROPIC_API_KEY' in process.env;
        const rawValue = process.env.ANTHROPIC_API_KEY;
        console.error('[Chat API] ANTHROPIC_API_KEY configuration issue:', {
            exists: keyExists,
            isEmpty: rawValue === '',
            isWhitespaceOnly: rawValue?.trim() === '' && rawValue?.length > 0,
            rawLength: rawValue?.length || 0
        });
        return res.status(503).json({
            error: 'Chat service is temporarily unavailable. Please try again later.',
            code: 'SERVICE_UNAVAILABLE'
        });
    }

    // Validate API key format
    if (!apiKey.startsWith('sk-ant-')) {
        console.error('[Chat API] Invalid API key format. Expected sk-ant-* prefix.');
        return res.status(503).json({
            error: 'Chat service configuration error. Please contact support.',
            code: 'CONFIG_ERROR'
        });
    }

    try {
        const { messages, conversationHistory = [] } = req.body || {};

        // Validate messages array
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: 'Messages array is required',
                code: 'INVALID_REQUEST'
            });
        }

        // Validate current message
        const currentMessage = messages[messages.length - 1];
        if (!currentMessage || !currentMessage.content) {
            return res.status(400).json({
                error: 'Message content is required',
                code: 'INVALID_MESSAGE'
            });
        }

        const validation = validateMessage(currentMessage.content);
        if (!validation.valid) {
            return res.status(400).json({
                error: validation.error,
                code: 'VALIDATION_ERROR'
            });
        }

        // Build conversation with validated history
        const validatedHistory = validateHistory(conversationHistory);
        const formattedMessages = [
            ...validatedHistory,
            { role: 'user', content: validation.content }
        ];

        // Call Claude API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                system: FUSE_KNOWLEDGE,
                messages: formattedMessages
            })
        });

        // Handle API errors
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { raw: errorText };
            }

            console.error('[Chat API] Anthropic API error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData,
                keyPrefix: apiKey.substring(0, 10) + '...'
            });

            // Map status codes to user-friendly errors
            switch (response.status) {
                case 401:
                    return res.status(503).json({
                        error: 'Chat service authentication failed. Please contact support.',
                        code: 'AUTH_FAILED'
                    });
                case 400:
                    return res.status(400).json({
                        error: 'Invalid request. Please try rephrasing your message.',
                        code: 'BAD_REQUEST'
                    });
                case 429:
                    return res.status(429).json({
                        error: 'Service is busy. Please try again in a moment.',
                        code: 'API_RATE_LIMITED'
                    });
                case 500:
                case 502:
                case 503:
                    return res.status(503).json({
                        error: 'Chat service is temporarily unavailable. Please try again later.',
                        code: 'API_UNAVAILABLE'
                    });
                default:
                    return res.status(503).json({
                        error: 'An unexpected error occurred. Please try again.',
                        code: 'UNKNOWN_ERROR'
                    });
            }
        }

        // Parse and validate response
        const data = await response.json();

        // Validate response structure
        if (!data || !data.content || !Array.isArray(data.content) || data.content.length === 0) {
            console.error('[Chat API] Invalid response structure:', {
                hasData: !!data,
                hasContent: !!data?.content,
                isArray: Array.isArray(data?.content),
                length: data?.content?.length
            });
            return res.status(503).json({
                error: 'Received an invalid response. Please try again.',
                code: 'INVALID_RESPONSE'
            });
        }

        const firstContent = data.content[0];
        if (!firstContent || firstContent.type !== 'text' || typeof firstContent.text !== 'string') {
            console.error('[Chat API] Invalid content block:', firstContent);
            return res.status(503).json({
                error: 'Received an invalid response format. Please try again.',
                code: 'INVALID_CONTENT'
            });
        }

        const assistantMessage = firstContent.text;

        return res.status(200).json({
            message: assistantMessage,
            role: 'assistant'
        });

    } catch (error) {
        console.error('[Chat API] Unexpected error:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });

        // Check for network/fetch errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return res.status(503).json({
                error: 'Unable to connect to chat service. Please try again.',
                code: 'NETWORK_ERROR'
            });
        }

        return res.status(500).json({
            error: 'Something went wrong. Please try again in a moment.',
            code: 'INTERNAL_ERROR'
        });
    }
};
