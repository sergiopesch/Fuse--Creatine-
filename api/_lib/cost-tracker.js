/**
 * FUSE Cost Tracking & Metering System
 * Provides transparent API usage tracking, cost estimation, and budget alerts
 *
 * @version 1.0.0
 */

// ============================================================================
// PRICING MODELS (as of January 2025)
// ============================================================================

const PRICING = {
    anthropic: {
        'claude-3-5-haiku-latest': {
            inputPer1K: 0.0008, // $0.80 per 1M input tokens
            outputPer1K: 0.004, // $4.00 per 1M output tokens
            name: 'Claude 3.5 Haiku',
        },
        'claude-3-5-sonnet-latest': {
            inputPer1K: 0.003, // $3.00 per 1M input tokens
            outputPer1K: 0.015, // $15.00 per 1M output tokens
            name: 'Claude 3.5 Sonnet',
        },
        'claude-3-opus-latest': {
            inputPer1K: 0.015, // $15.00 per 1M input tokens
            outputPer1K: 0.075, // $75.00 per 1M output tokens
            name: 'Claude 3 Opus',
        },
    },
    openai: {
        'gpt-4-turbo': {
            inputPer1K: 0.01,
            outputPer1K: 0.03,
            name: 'GPT-4 Turbo',
        },
        'gpt-4o': {
            inputPer1K: 0.005,
            outputPer1K: 0.015,
            name: 'GPT-4o',
        },
        'gpt-4o-mini': {
            inputPer1K: 0.00015,
            outputPer1K: 0.0006,
            name: 'GPT-4o Mini',
        },
        'gpt-3.5-turbo': {
            inputPer1K: 0.0005,
            outputPer1K: 0.0015,
            name: 'GPT-3.5 Turbo',
        },
    },
    gemini: {
        'gemini-pro': {
            inputPer1K: 0.00025,
            outputPer1K: 0.0005,
            name: 'Gemini Pro',
        },
        'gemini-1.5-pro': {
            inputPer1K: 0.00125,
            outputPer1K: 0.005,
            name: 'Gemini 1.5 Pro',
        },
    },
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Default budget limits (can be overridden via env vars)
    DEFAULT_DAILY_BUDGET: 50.0, // $50/day
    DEFAULT_MONTHLY_BUDGET: 500.0, // $500/month

    // Alert thresholds (percentage of budget)
    ALERT_THRESHOLDS: [50, 75, 90, 100],

    // Usage retention
    MAX_USAGE_ENTRIES: 10000,

    // Token estimation (characters per token, rough estimate)
    CHARS_PER_TOKEN: 4,
};

// ============================================================================
// IN-MEMORY USAGE STORE
// ============================================================================

let usageStore = {
    requests: [], // Individual request records
    dailyTotals: {}, // Aggregated daily totals
    monthlyTotals: {}, // Aggregated monthly totals
    alerts: [], // Budget alerts
    lastReset: new Date().toISOString(),
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get current date keys for aggregation
 */
function getDateKeys() {
    const now = new Date();
    return {
        day: now.toISOString().split('T')[0], // YYYY-MM-DD
        month: now.toISOString().slice(0, 7), // YYYY-MM
        timestamp: now.toISOString(),
    };
}

/**
 * Estimate token count from text
 * @param {string} text - Input text
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    return Math.ceil(text.length / CONFIG.CHARS_PER_TOKEN);
}

/**
 * Calculate cost for a request
 * @param {string} provider - API provider (anthropic, openai, gemini)
 * @param {string} model - Model identifier
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {{ cost: number, breakdown: object }}
 */
function calculateCost(provider, model, inputTokens, outputTokens) {
    const pricing = PRICING[provider]?.[model];

    if (!pricing) {
        // Default to zero if model not found
        return {
            cost: 0,
            breakdown: {
                inputCost: 0,
                outputCost: 0,
                model: 'Unknown',
                warning: `Pricing not found for ${provider}/${model}`,
            },
        };
    }

    const inputCost = (inputTokens / 1000) * pricing.inputPer1K;
    const outputCost = (outputTokens / 1000) * pricing.outputPer1K;

    return {
        cost: inputCost + outputCost,
        breakdown: {
            inputTokens,
            outputTokens,
            inputCost,
            outputCost,
            model: pricing.name,
            inputPer1K: pricing.inputPer1K,
            outputPer1K: pricing.outputPer1K,
        },
    };
}

/**
 * Format currency for display
 */
function formatCurrency(amount) {
    return `$${amount.toFixed(4)}`;
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * Record API usage
 * @param {object} params - Usage parameters
 * @returns {object} Usage record with cost information
 */
function recordUsage({
    provider,
    model,
    inputTokens = 0,
    outputTokens = 0,
    inputText = null,
    outputText = null,
    endpoint = 'unknown',
    clientIp = 'unknown',
    success = true,
    latencyMs = 0,
}) {
    const { day, month, timestamp } = getDateKeys();

    // Estimate tokens from text if not provided
    if (!inputTokens && inputText) {
        inputTokens = estimateTokens(inputText);
    }
    if (!outputTokens && outputText) {
        outputTokens = estimateTokens(outputText);
    }

    // Calculate cost
    const { cost, breakdown } = calculateCost(provider, model, inputTokens, outputTokens);

    // Create usage record
    const record = {
        id: `usage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
        provider,
        model,
        inputTokens,
        outputTokens,
        cost,
        breakdown,
        endpoint,
        clientIp: clientIp.substring(0, clientIp.indexOf('.') + 4) + 'xxx', // Partial IP for privacy
        success,
        latencyMs,
    };

    // Add to usage store
    usageStore.requests.unshift(record);

    // Prune old entries
    if (usageStore.requests.length > CONFIG.MAX_USAGE_ENTRIES) {
        usageStore.requests.length = CONFIG.MAX_USAGE_ENTRIES;
    }

    // Update daily totals
    if (!usageStore.dailyTotals[day]) {
        usageStore.dailyTotals[day] = {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            cost: 0,
            successCount: 0,
            errorCount: 0,
        };
    }
    usageStore.dailyTotals[day].requests++;
    usageStore.dailyTotals[day].inputTokens += inputTokens;
    usageStore.dailyTotals[day].outputTokens += outputTokens;
    usageStore.dailyTotals[day].cost += cost;
    if (success) {
        usageStore.dailyTotals[day].successCount++;
    } else {
        usageStore.dailyTotals[day].errorCount++;
    }

    // Update monthly totals
    if (!usageStore.monthlyTotals[month]) {
        usageStore.monthlyTotals[month] = {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            cost: 0,
            successCount: 0,
            errorCount: 0,
        };
    }
    usageStore.monthlyTotals[month].requests++;
    usageStore.monthlyTotals[month].inputTokens += inputTokens;
    usageStore.monthlyTotals[month].outputTokens += outputTokens;
    usageStore.monthlyTotals[month].cost += cost;
    if (success) {
        usageStore.monthlyTotals[month].successCount++;
    } else {
        usageStore.monthlyTotals[month].errorCount++;
    }

    // Check budget alerts
    checkBudgetAlerts(day, month);

    return record;
}

// ============================================================================
// BUDGET MANAGEMENT
// ============================================================================

/**
 * Get budget limits from environment or defaults
 */
function getBudgetLimits() {
    return {
        daily: parseFloat(process.env.DAILY_BUDGET_LIMIT) || CONFIG.DEFAULT_DAILY_BUDGET,
        monthly: parseFloat(process.env.MONTHLY_BUDGET_LIMIT) || CONFIG.DEFAULT_MONTHLY_BUDGET,
    };
}

/**
 * Check and generate budget alerts
 */
function checkBudgetAlerts(day, month) {
    const limits = getBudgetLimits();
    const dailyUsage = usageStore.dailyTotals[day]?.cost || 0;
    const monthlyUsage = usageStore.monthlyTotals[month]?.cost || 0;

    const dailyPercentage = (dailyUsage / limits.daily) * 100;
    const monthlyPercentage = (monthlyUsage / limits.monthly) * 100;

    // Check daily thresholds
    for (const threshold of CONFIG.ALERT_THRESHOLDS) {
        if (dailyPercentage >= threshold) {
            const alertKey = `daily-${day}-${threshold}`;
            if (!usageStore.alerts.find(a => a.key === alertKey)) {
                usageStore.alerts.push({
                    key: alertKey,
                    type: 'daily',
                    threshold,
                    percentage: dailyPercentage,
                    currentCost: dailyUsage,
                    limit: limits.daily,
                    timestamp: new Date().toISOString(),
                    message: `Daily budget ${threshold}% threshold reached: ${formatCurrency(dailyUsage)} of ${formatCurrency(limits.daily)}`,
                });
            }
        }
    }

    // Check monthly thresholds
    for (const threshold of CONFIG.ALERT_THRESHOLDS) {
        if (monthlyPercentage >= threshold) {
            const alertKey = `monthly-${month}-${threshold}`;
            if (!usageStore.alerts.find(a => a.key === alertKey)) {
                usageStore.alerts.push({
                    key: alertKey,
                    type: 'monthly',
                    threshold,
                    percentage: monthlyPercentage,
                    currentCost: monthlyUsage,
                    limit: limits.monthly,
                    timestamp: new Date().toISOString(),
                    message: `Monthly budget ${threshold}% threshold reached: ${formatCurrency(monthlyUsage)} of ${formatCurrency(limits.monthly)}`,
                });
            }
        }
    }

    // Keep only recent alerts
    if (usageStore.alerts.length > 100) {
        usageStore.alerts = usageStore.alerts.slice(-100);
    }
}

/**
 * Check if budget is exceeded
 * @returns {{ exceeded: boolean, daily: object, monthly: object }}
 */
function checkBudgetStatus() {
    const { day, month } = getDateKeys();
    const limits = getBudgetLimits();

    const dailyUsage = usageStore.dailyTotals[day]?.cost || 0;
    const monthlyUsage = usageStore.monthlyTotals[month]?.cost || 0;

    return {
        exceeded: dailyUsage >= limits.daily || monthlyUsage >= limits.monthly,
        daily: {
            used: dailyUsage,
            limit: limits.daily,
            remaining: Math.max(0, limits.daily - dailyUsage),
            percentage: Math.round((dailyUsage / limits.daily) * 100),
        },
        monthly: {
            used: monthlyUsage,
            limit: limits.monthly,
            remaining: Math.max(0, limits.monthly - monthlyUsage),
            percentage: Math.round((monthlyUsage / limits.monthly) * 100),
        },
    };
}

// ============================================================================
// REPORTING
// ============================================================================

/**
 * Get usage summary
 * @param {string} period - 'today', 'week', 'month', 'all'
 * @returns {object} Usage summary
 */
function getUsageSummary(period = 'today') {
    const { day, month } = getDateKeys();

    const summary = {
        period,
        generatedAt: new Date().toISOString(),
        budgetStatus: checkBudgetStatus(),
        pricing: PRICING,
    };

    switch (period) {
        case 'today':
            summary.usage = usageStore.dailyTotals[day] || {
                requests: 0,
                inputTokens: 0,
                outputTokens: 0,
                cost: 0,
                successCount: 0,
                errorCount: 0,
            };
            summary.recentRequests = usageStore.requests
                .filter(r => r.timestamp.startsWith(day))
                .slice(0, 50);
            break;

        case 'week': {
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const weekDays = [];
            for (let d = new Date(weekAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
                weekDays.push(d.toISOString().split('T')[0]);
            }
            summary.dailyBreakdown = weekDays.map(d => ({
                date: d,
                ...(usageStore.dailyTotals[d] || { requests: 0, cost: 0 }),
            }));
            summary.usage = {
                requests: summary.dailyBreakdown.reduce((sum, d) => sum + d.requests, 0),
                cost: summary.dailyBreakdown.reduce((sum, d) => sum + d.cost, 0),
                inputTokens: summary.dailyBreakdown.reduce(
                    (sum, d) => sum + (d.inputTokens || 0),
                    0
                ),
                outputTokens: summary.dailyBreakdown.reduce(
                    (sum, d) => sum + (d.outputTokens || 0),
                    0
                ),
            };
            break;
        }

        case 'month': {
            summary.usage = usageStore.monthlyTotals[month] || {
                requests: 0,
                inputTokens: 0,
                outputTokens: 0,
                cost: 0,
                successCount: 0,
                errorCount: 0,
            };
            // Get daily breakdown for current month
            const monthDays = Object.entries(usageStore.dailyTotals)
                .filter(([d]) => d.startsWith(month))
                .map(([date, data]) => ({ date, ...data }))
                .sort((a, b) => a.date.localeCompare(b.date));
            summary.dailyBreakdown = monthDays;
            break;
        }

        case 'all':
            summary.monthlyBreakdown = Object.entries(usageStore.monthlyTotals)
                .map(([month, data]) => ({ month, ...data }))
                .sort((a, b) => a.month.localeCompare(b.month));
            summary.usage = {
                requests: summary.monthlyBreakdown.reduce((sum, m) => sum + m.requests, 0),
                cost: summary.monthlyBreakdown.reduce((sum, m) => sum + m.cost, 0),
                inputTokens: summary.monthlyBreakdown.reduce(
                    (sum, m) => sum + (m.inputTokens || 0),
                    0
                ),
                outputTokens: summary.monthlyBreakdown.reduce(
                    (sum, m) => sum + (m.outputTokens || 0),
                    0
                ),
            };
            break;
    }

    // Add cost breakdown by provider/model
    const providerBreakdown = {};
    for (const record of usageStore.requests) {
        const key = `${record.provider}/${record.model}`;
        if (!providerBreakdown[key]) {
            providerBreakdown[key] = {
                provider: record.provider,
                model: record.model,
                requests: 0,
                cost: 0,
                inputTokens: 0,
                outputTokens: 0,
            };
        }
        providerBreakdown[key].requests++;
        providerBreakdown[key].cost += record.cost;
        providerBreakdown[key].inputTokens += record.inputTokens;
        providerBreakdown[key].outputTokens += record.outputTokens;
    }
    summary.providerBreakdown = Object.values(providerBreakdown);

    // Add recent alerts
    summary.alerts = usageStore.alerts.slice(-10);

    return summary;
}

/**
 * Get cost estimate for a planned request
 * @param {string} provider - API provider
 * @param {string} model - Model identifier
 * @param {number} estimatedInputTokens - Expected input tokens
 * @param {number} estimatedOutputTokens - Expected output tokens
 * @returns {object} Cost estimate
 */
function getEstimate(provider, model, estimatedInputTokens, estimatedOutputTokens) {
    const { cost, breakdown } = calculateCost(
        provider,
        model,
        estimatedInputTokens,
        estimatedOutputTokens
    );

    return {
        provider,
        model,
        estimatedInputTokens,
        estimatedOutputTokens,
        estimatedCost: cost,
        formattedCost: formatCurrency(cost),
        breakdown,
        note: 'Actual costs may vary based on token counting differences between systems',
    };
}

// ============================================================================
// RESET & MAINTENANCE
// ============================================================================

/**
 * Reset usage store (for testing or manual reset)
 */
function resetUsageStore() {
    usageStore = {
        requests: [],
        dailyTotals: {},
        monthlyTotals: {},
        alerts: [],
        lastReset: new Date().toISOString(),
    };
}

/**
 * Get raw usage store (for debugging)
 */
function getRawUsageStore() {
    return { ...usageStore };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Configuration
    PRICING,
    CONFIG,

    // Core functions
    recordUsage,
    calculateCost,
    estimateTokens,

    // Budget management
    getBudgetLimits,
    checkBudgetStatus,
    checkBudgetAlerts,

    // Reporting
    getUsageSummary,
    getEstimate,
    formatCurrency,

    // Maintenance
    resetUsageStore,
    getRawUsageStore,
    usageStore, // Exposed for testing
};
