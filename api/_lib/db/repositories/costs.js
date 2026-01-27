/**
 * Cost Tracking Repository
 * ========================
 *
 * Persistent storage for API usage and cost tracking.
 * Replaces in-memory cost tracker for serverless persistence.
 */

const db = require('../client');

// =============================================================================
// PRICING (kept in sync with cost-tracker.js)
// =============================================================================

const PRICING = {
    anthropic: {
        'claude-3-5-haiku-latest': { inputPer1K: 0.0008, outputPer1K: 0.004 },
        'claude-3-5-sonnet-latest': { inputPer1K: 0.003, outputPer1K: 0.015 },
        'claude-3-opus-latest': { inputPer1K: 0.015, outputPer1K: 0.075 },
    },
    openai: {
        'gpt-4-turbo': { inputPer1K: 0.01, outputPer1K: 0.03 },
        'gpt-4o': { inputPer1K: 0.005, outputPer1K: 0.015 },
        'gpt-4o-mini': { inputPer1K: 0.00015, outputPer1K: 0.0006 },
        'gpt-3.5-turbo': { inputPer1K: 0.0005, outputPer1K: 0.0015 },
    },
    gemini: {
        'gemini-pro': { inputPer1K: 0.00025, outputPer1K: 0.0005 },
        'gemini-1.5-pro': { inputPer1K: 0.00125, outputPer1K: 0.005 },
    },
};

// Default budgets
const DEFAULT_DAILY_BUDGET = parseFloat(process.env.DAILY_BUDGET_LIMIT) || 50.0;
const DEFAULT_MONTHLY_BUDGET = parseFloat(process.env.MONTHLY_BUDGET_LIMIT) || 500.0;

// =============================================================================
// COST RECORDS
// =============================================================================

/**
 * Record an API usage event
 */
async function recordUsage({
    provider,
    model,
    endpoint,
    inputTokens,
    outputTokens,
    teamId,
    agentId,
    taskId,
    clientIp,
    success,
    latencyMs,
    errorCode,
}) {
    const now = db.timestamp();
    const recordId = db.uuid();
    const date = db.dateKey();

    // Calculate cost
    const pricing = PRICING[provider]?.[model];
    let cost = 0;
    let breakdown = null;

    if (pricing) {
        const inputCost = (inputTokens / 1000) * pricing.inputPer1K;
        const outputCost = (outputTokens / 1000) * pricing.outputPer1K;
        cost = inputCost + outputCost;

        breakdown = {
            inputCost,
            outputCost,
            inputPer1K: pricing.inputPer1K,
            outputPer1K: pricing.outputPer1K,
        };
    }

    const item = {
        // Keys
        PK: db.pk('COST', date),
        SK: db.sk(now, recordId),

        // GSI1: By provider
        gsi1pk: db.pk('COST_PROVIDER', provider),
        gsi1sk: db.sk(now, recordId),

        // GSI2: By team (if provided)
        gsi2pk: teamId ? db.pk('COST_TEAM', teamId) : null,
        gsi2sk: teamId ? db.sk(now, recordId) : null,

        // Data
        recordId,
        provider,
        model,
        endpoint,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost,
        breakdown,
        teamId: teamId || null,
        agentId: agentId || null,
        taskId: taskId || null,
        clientIp: maskIp(clientIp),
        success,
        latencyMs,
        errorCode: errorCode || null,
        timestamp: now,

        // TTL: Keep 90 days (archive to S3 for longer retention)
        ttl: db.TTL.THREE_MONTHS(),

        _entityType: 'COST_RECORD',
    };

    await db.putItem(item);

    // Update daily and monthly summaries
    await Promise.all([updateDailySummary(date, item), updateMonthlySummary(db.monthKey(), item)]);

    return item;
}

/**
 * Get cost records for a date
 */
async function getRecordsByDate(date, options = {}) {
    const { limit = 100 } = options;

    const result = await db.query({
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
            ':pk': db.pk('COST', date),
        },
        ScanIndexForward: false,
        Limit: limit,
    });

    return result.items;
}

/**
 * Get cost records by provider
 */
async function getRecordsByProvider(provider, startDate, endDate, limit = 100) {
    const result = await db.queryGSI1({
        KeyConditionExpression: 'gsi1pk = :provider AND gsi1sk BETWEEN :start AND :end',
        ExpressionAttributeValues: {
            ':provider': db.pk('COST_PROVIDER', provider),
            ':start': startDate,
            ':end': endDate,
        },
        ScanIndexForward: false,
        Limit: limit,
    });

    return result.items;
}

/**
 * Get cost records by team
 */
async function getRecordsByTeam(teamId, startDate, endDate, limit = 100) {
    const result = await db.queryGSI2({
        KeyConditionExpression: 'gsi2pk = :team AND gsi2sk BETWEEN :start AND :end',
        ExpressionAttributeValues: {
            ':team': db.pk('COST_TEAM', teamId),
            ':start': startDate,
            ':end': endDate,
        },
        ScanIndexForward: false,
        Limit: limit,
    });

    return result.items;
}

// =============================================================================
// DAILY SUMMARIES
// =============================================================================

/**
 * Update daily usage summary (atomic increment)
 */
async function updateDailySummary(date, record) {
    const now = db.timestamp();

    try {
        await db.updateItem(
            {
                PK: 'USAGE#DAILY',
                SK: date,
            },
            {
                // Use expression for atomic updates
            },
            {
                UpdateExpression: `
          SET requests = if_not_exists(requests, :zero) + :one,
              inputTokens = if_not_exists(inputTokens, :zero) + :inputTokens,
              outputTokens = if_not_exists(outputTokens, :zero) + :outputTokens,
              totalCost = if_not_exists(totalCost, :zero) + :cost,
              successCount = if_not_exists(successCount, :zero) + :success,
              errorCount = if_not_exists(errorCount, :zero) + :error,
              updatedAt = :now,
              #date = :date
        `,
                ExpressionAttributeNames: {
                    '#date': 'date',
                },
                ExpressionAttributeValues: {
                    ':zero': 0,
                    ':one': 1,
                    ':inputTokens': record.inputTokens,
                    ':outputTokens': record.outputTokens,
                    ':cost': record.cost,
                    ':success': record.success ? 1 : 0,
                    ':error': record.success ? 0 : 1,
                    ':now': now,
                    ':date': date,
                },
            }
        );
    } catch (error) {
        // If update fails, try to create the record
        if (error.code === 'ValidationException') {
            await db.putItem({
                PK: 'USAGE#DAILY',
                SK: date,
                date,
                requests: 1,
                inputTokens: record.inputTokens,
                outputTokens: record.outputTokens,
                totalCost: record.cost,
                successCount: record.success ? 1 : 0,
                errorCount: record.success ? 0 : 1,
                byProvider: {},
                byTeam: {},
                updatedAt: now,
                _entityType: 'DAILY_USAGE_SUMMARY',
            });
        }
    }
}

/**
 * Get daily summary
 */
async function getDailySummary(date) {
    return db.getItem({
        PK: 'USAGE#DAILY',
        SK: date,
    });
}

/**
 * Get daily summaries for a range
 */
async function getDailySummaries(startDate, endDate) {
    const result = await db.query({
        KeyConditionExpression: 'PK = :pk AND SK BETWEEN :start AND :end',
        ExpressionAttributeValues: {
            ':pk': 'USAGE#DAILY',
            ':start': startDate,
            ':end': endDate,
        },
    });

    return result.items;
}

// =============================================================================
// MONTHLY SUMMARIES
// =============================================================================

/**
 * Update monthly usage summary
 */
async function updateMonthlySummary(month, record) {
    const now = db.timestamp();

    try {
        await db.updateItem(
            {
                PK: 'USAGE#MONTHLY',
                SK: month,
            },
            {},
            {
                UpdateExpression: `
          SET requests = if_not_exists(requests, :zero) + :one,
              inputTokens = if_not_exists(inputTokens, :zero) + :inputTokens,
              outputTokens = if_not_exists(outputTokens, :zero) + :outputTokens,
              totalCost = if_not_exists(totalCost, :zero) + :cost,
              successCount = if_not_exists(successCount, :zero) + :success,
              errorCount = if_not_exists(errorCount, :zero) + :error,
              updatedAt = :now,
              #month = :month
        `,
                ExpressionAttributeNames: {
                    '#month': 'month',
                },
                ExpressionAttributeValues: {
                    ':zero': 0,
                    ':one': 1,
                    ':inputTokens': record.inputTokens,
                    ':outputTokens': record.outputTokens,
                    ':cost': record.cost,
                    ':success': record.success ? 1 : 0,
                    ':error': record.success ? 0 : 1,
                    ':now': now,
                    ':month': month,
                },
            }
        );
    } catch (error) {
        if (error.code === 'ValidationException') {
            await db.putItem({
                PK: 'USAGE#MONTHLY',
                SK: month,
                month,
                requests: 1,
                inputTokens: record.inputTokens,
                outputTokens: record.outputTokens,
                totalCost: record.cost,
                successCount: record.success ? 1 : 0,
                errorCount: record.success ? 0 : 1,
                byProvider: {},
                byTeam: {},
                updatedAt: now,
                _entityType: 'MONTHLY_USAGE_SUMMARY',
            });
        }
    }
}

/**
 * Get monthly summary
 */
async function getMonthlySummary(month) {
    return db.getItem({
        PK: 'USAGE#MONTHLY',
        SK: month,
    });
}

// =============================================================================
// BUDGET MANAGEMENT
// =============================================================================

/**
 * Get current budget status
 */
async function getBudgetStatus() {
    const today = db.dateKey();
    const month = db.monthKey();

    const [daily, monthly] = await Promise.all([getDailySummary(today), getMonthlySummary(month)]);

    const dailyUsed = daily?.totalCost || 0;
    const monthlyUsed = monthly?.totalCost || 0;

    const dailyLimit = DEFAULT_DAILY_BUDGET;
    const monthlyLimit = DEFAULT_MONTHLY_BUDGET;

    const dailyRatio = dailyUsed / dailyLimit;
    const monthlyRatio = monthlyUsed / monthlyLimit;

    // Determine status
    let status = 'ok';
    let canProceed = true;
    let message = 'Budget within limits';

    if (dailyRatio >= 1.0 || monthlyRatio >= 1.0) {
        status = 'hard_stop';
        canProceed = false;
        message = 'Budget exceeded - operations paused';
    } else if (dailyRatio >= 0.9 || monthlyRatio >= 0.9) {
        status = 'critical';
        message = 'Budget at 90% - consider pausing';
    } else if (dailyRatio >= 0.75 || monthlyRatio >= 0.75) {
        status = 'warning';
        message = 'Budget at 75%';
    } else if (dailyRatio >= 0.5 || monthlyRatio >= 0.5) {
        status = 'caution';
        message = 'Budget at 50%';
    }

    return {
        status,
        canProceed,
        message,
        daily: {
            used: dailyUsed,
            limit: dailyLimit,
            remaining: Math.max(0, dailyLimit - dailyUsed),
            usageRatio: dailyRatio,
        },
        monthly: {
            used: monthlyUsed,
            limit: monthlyLimit,
            remaining: Math.max(0, monthlyLimit - monthlyUsed),
            usageRatio: monthlyRatio,
        },
    };
}

/**
 * Check if operation should proceed based on budget
 */
async function canProceed(estimatedCost = 0) {
    const status = await getBudgetStatus();

    if (!status.canProceed) {
        return { allowed: false, reason: status.message, status };
    }

    // Check if estimated cost would exceed budget
    if (status.daily.remaining < estimatedCost) {
        return {
            allowed: false,
            reason: 'Estimated cost exceeds daily budget',
            status,
        };
    }

    return { allowed: true, status };
}

// =============================================================================
// REPORTS
// =============================================================================

/**
 * Generate cost report for a period
 */
async function generateCostReport(startDate, endDate) {
    const summaries = await getDailySummaries(startDate, endDate);

    const report = {
        period: { startDate, endDate },
        generatedAt: db.timestamp(),
        totals: {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalCost: 0,
            successCount: 0,
            errorCount: 0,
        },
        dailyBreakdown: [],
        averageDailyCost: 0,
        peakDay: null,
        peakDayCost: 0,
    };

    for (const day of summaries) {
        report.totals.requests += day.requests || 0;
        report.totals.inputTokens += day.inputTokens || 0;
        report.totals.outputTokens += day.outputTokens || 0;
        report.totals.totalCost += day.totalCost || 0;
        report.totals.successCount += day.successCount || 0;
        report.totals.errorCount += day.errorCount || 0;

        report.dailyBreakdown.push({
            date: day.date,
            cost: day.totalCost || 0,
            requests: day.requests || 0,
            tokens: (day.inputTokens || 0) + (day.outputTokens || 0),
        });

        if ((day.totalCost || 0) > report.peakDayCost) {
            report.peakDayCost = day.totalCost;
            report.peakDay = day.date;
        }
    }

    if (summaries.length > 0) {
        report.averageDailyCost = report.totals.totalCost / summaries.length;
    }

    return report;
}

// =============================================================================
// HELPERS
// =============================================================================

function maskIp(ip) {
    if (!ip) return null;
    const parts = ip.split('.');
    if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return ip.substring(0, ip.length / 2) + '***';
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    // Constants
    PRICING,
    DEFAULT_DAILY_BUDGET,
    DEFAULT_MONTHLY_BUDGET,

    // Recording
    recordUsage,
    getRecordsByDate,
    getRecordsByProvider,
    getRecordsByTeam,

    // Summaries
    getDailySummary,
    getDailySummaries,
    getMonthlySummary,

    // Budget
    getBudgetStatus,
    canProceed,

    // Reports
    generateCostReport,
};
