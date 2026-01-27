/**
 * FUSE Cost Transparency API
 * Provides detailed API usage metrics, cost tracking, and budget management
 *
 * This endpoint offers full transparency into API costs for administrators
 * and allows setting budget limits and alerts.
 *
 * @version 1.0.0
 */

const {
    authenticate,
    setSecurityHeaders,
    getCorsOrigin,
    getRequestHost,
    getClientIp,
    checkRateLimit,
    addAuditEntry,
    validateRequestBody,
} = require('./_lib/security');

const {
    getUsageSummary,
    checkBudgetStatus,
    getEstimate,
    getBudgetLimits,
    PRICING,
    recordUsage,
} = require('./_lib/cost-tracker');

const { getAllCircuitsStatus } = require('./_lib/circuit-breaker');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    RATE_LIMIT_REQUESTS: 30, // 30 requests per minute
    RATE_LIMIT_WINDOW_MS: 60000,
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

module.exports = async (req, res) => {
    const clientIp = getClientIp(req);
    const origin = getCorsOrigin(req.headers.origin, getRequestHost(req));

    // Set security headers
    setSecurityHeaders(res, origin, 'GET, POST, OPTIONS');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Validate origin
    if (req.headers.origin && !origin) {
        return res.status(403).json({
            error: 'Origin not allowed',
            code: 'CORS_ERROR',
        });
    }

    // Only allow GET and POST
    if (!['GET', 'POST'].includes(req.method)) {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limiting
    const rateLimit = checkRateLimit(
        `costs:${clientIp}`,
        CONFIG.RATE_LIMIT_REQUESTS,
        CONFIG.RATE_LIMIT_WINDOW_MS
    );

    res.setHeader('X-RateLimit-Limit', CONFIG.RATE_LIMIT_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

    if (rateLimit.limited) {
        res.setHeader('Retry-After', Math.ceil(rateLimit.retryAfterMs / 1000));
        return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMITED',
            retryAfter: Math.ceil(rateLimit.retryAfterMs / 1000),
        });
    }

    const { query } = req;
    const action = query.action || 'summary';

    try {
        // Public endpoints (no auth required)
        if (req.method === 'GET') {
            switch (action) {
                case 'pricing':
                    // Return current pricing information (public)
                    return res.status(200).json({
                        success: true,
                        data: {
                            pricing: PRICING,
                            note: 'Prices are per 1,000 tokens. Input and output tokens are priced separately.',
                            lastUpdated: '2025-01-01',
                            currency: 'USD',
                        },
                    });

                case 'estimate': {
                    // Cost estimate (public)
                    const provider = query.provider || 'anthropic';
                    const model = query.model || 'claude-3-5-haiku-latest';
                    const inputTokens = parseInt(query.inputTokens) || 1000;
                    const outputTokens = parseInt(query.outputTokens) || 500;

                    const estimate = getEstimate(provider, model, inputTokens, outputTokens);

                    return res.status(200).json({
                        success: true,
                        data: estimate,
                    });
                }

                case 'health':
                    // System health including circuit breakers (public)
                    return res.status(200).json({
                        success: true,
                        data: {
                            status: 'operational',
                            circuits: getAllCircuitsStatus(),
                            timestamp: new Date().toISOString(),
                        },
                    });

                case 'summary':
                case 'usage':
                    // These require authentication
                    break;

                default:
                    // Unknown action
                    return res.status(400).json({
                        error: 'Unknown action',
                        code: 'INVALID_ACTION',
                        availableActions: ['pricing', 'estimate', 'health', 'summary', 'usage'],
                    });
            }
        }

        // Authenticated endpoints
        const adminToken = process.env.ADMIN_TOKEN;

        if (!adminToken) {
            return res.status(503).json({
                error: 'Cost tracking not configured',
                code: 'NOT_CONFIGURED',
                hint: 'Set ADMIN_TOKEN environment variable',
            });
        }

        const authResult = authenticate(req, adminToken);
        if (!authResult.authenticated) {
            addAuditEntry({
                action: 'COSTS_AUTH_FAILED',
                ip: clientIp,
                success: false,
                reason: authResult.error,
            });
            return res.status(401).json({
                error: authResult.error,
                code: 'UNAUTHORIZED',
            });
        }

        // Authenticated GET endpoints
        if (req.method === 'GET') {
            switch (action) {
                case 'summary':
                case 'usage': {
                    const period = query.period || 'today';
                    const validPeriods = ['today', 'week', 'month', 'all'];

                    if (!validPeriods.includes(period)) {
                        return res.status(400).json({
                            error: 'Invalid period',
                            code: 'VALIDATION_ERROR',
                            validPeriods,
                        });
                    }

                    const summary = getUsageSummary(period);

                    addAuditEntry({
                        action: 'COSTS_VIEWED',
                        ip: clientIp,
                        success: true,
                        period,
                    });

                    return res.status(200).json({
                        success: true,
                        data: summary,
                    });
                }

                case 'budget': {
                    const budgetStatus = checkBudgetStatus();
                    const limits = getBudgetLimits();

                    return res.status(200).json({
                        success: true,
                        data: {
                            ...budgetStatus,
                            limits,
                            alerts: budgetStatus.exceeded
                                ? [
                                      {
                                          level: 'critical',
                                          message:
                                              'Budget exceeded! Consider reviewing usage or increasing limits.',
                                      },
                                  ]
                                : [],
                        },
                    });
                }

                default:
                    return res.status(400).json({
                        error: 'Unknown action',
                        code: 'INVALID_ACTION',
                    });
            }
        }

        // Authenticated POST endpoints
        if (req.method === 'POST') {
            switch (action) {
                case 'record': {
                    // Manually record usage (for external integrations)
                    const validation = validateRequestBody(req.body, {
                        provider: {
                            type: 'string',
                            required: true,
                            enum: ['anthropic', 'openai', 'gemini'],
                        },
                        model: { type: 'string', required: true, maxLength: 100 },
                        inputTokens: { type: 'number' },
                        outputTokens: { type: 'number' },
                        endpoint: { type: 'string', maxLength: 200 },
                        success: { type: 'boolean' },
                    });

                    if (!validation.valid) {
                        return res.status(400).json({
                            error: validation.error,
                            code: 'VALIDATION_ERROR',
                        });
                    }

                    const record = recordUsage({
                        provider: validation.sanitized.provider,
                        model: validation.sanitized.model,
                        inputTokens: req.body.inputTokens || 0,
                        outputTokens: req.body.outputTokens || 0,
                        endpoint: validation.sanitized.endpoint || 'manual',
                        clientIp,
                        success: req.body.success !== false,
                    });

                    addAuditEntry({
                        action: 'USAGE_RECORDED',
                        ip: clientIp,
                        success: true,
                        recordId: record.id,
                    });

                    return res.status(201).json({
                        success: true,
                        data: record,
                    });
                }

                default:
                    return res.status(400).json({
                        error: 'Unknown action',
                        code: 'INVALID_ACTION',
                    });
            }
        }
    } catch (error) {
        console.error('[Costs API] Error:', error);
        addAuditEntry({
            action: 'COSTS_ERROR',
            ip: clientIp,
            success: false,
            error: error.message,
        });
        return res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
        });
    }
};
