/**
 * CEO Briefing API
 * Aggregates key company data into a single response for quick CEO consumption.
 * Designed for integration with Molt (personal AI assistant via messaging).
 *
 * GET /api/ceo-briefing                → Full briefing (requires admin auth)
 * GET /api/ceo-briefing?section=costs  → Costs only
 * GET /api/ceo-briefing?section=agents → Agent status only
 * GET /api/ceo-briefing?section=health → Health only
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
    addAuditEntry
} = require('./_lib/security');

const {
    getUsageSummary,
    checkBudgetStatus,
    getBudgetLimits,
    formatCurrency
} = require('./_lib/cost-tracker');

const {
    getTeams,
    getTasks,
    getDecisions,
    getActivities,
    getOrchestrationState,
    countTotalAgents,
    countActiveAgents
} = require('./_lib/agent-state');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    RATE_LIMIT_REQUESTS: 20,
    RATE_LIMIT_WINDOW_MS: 60000,
    VALID_SECTIONS: ['full', 'costs', 'agents', 'health', 'tasks', 'summary']
};

// ============================================================================
// SECTION BUILDERS
// ============================================================================

function buildCostSection() {
    const budget = checkBudgetStatus();
    const limits = getBudgetLimits();

    return {
        daily: {
            spent: formatCurrency(budget.daily.used),
            limit: formatCurrency(limits.daily),
            remaining: formatCurrency(budget.daily.remaining),
            percentUsed: budget.daily.percentage
        },
        monthly: {
            spent: formatCurrency(budget.monthly.used),
            limit: formatCurrency(limits.monthly),
            remaining: formatCurrency(budget.monthly.remaining),
            percentUsed: budget.monthly.percentage
        },
        budgetExceeded: budget.exceeded,
        alert: budget.exceeded
            ? 'Budget exceeded — orchestration auto-paused'
            : budget.daily.percentage >= 75
                ? `Daily spend at ${budget.daily.percentage}% — monitor closely`
                : null
    };
}

function buildAgentSection() {
    const teams = getTeams();
    const orchestration = getOrchestrationState();
    const totalAgents = countTotalAgents();
    const activeAgents = countActiveAgents();

    const teamSummaries = {};
    for (const [teamId, team] of Object.entries(teams)) {
        const orchStatus = orchestration.teamStatuses[teamId];
        const workingAgents = team.agents.filter(a => a.status === 'working').length;
        teamSummaries[teamId] = {
            name: team.name,
            status: orchStatus?.status || 'paused',
            agents: `${workingAgents}/${team.agents.length} active`,
            runCount: orchStatus?.runCount || 0,
            lastRun: orchStatus?.lastRun || 'never'
        };
    }

    return {
        totalAgents,
        activeAgents,
        idleAgents: totalAgents - activeAgents,
        worldState: orchestration.worldState,
        totalOrchestrations: orchestration.totalOrchestrations,
        teams: teamSummaries
    };
}

function buildTaskSection() {
    const tasks = getTasks();
    const decisions = getDecisions();

    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;

    const pendingDecisions = decisions.filter(d => d.status === 'pending');

    return {
        total: tasks.length,
        pending: pendingTasks,
        inProgress: inProgressTasks,
        completed: completedTasks,
        pendingDecisions: pendingDecisions.length,
        urgentDecisions: pendingDecisions
            .filter(d => d.priority === 'critical' || d.priority === 'high')
            .map(d => ({
                id: d.id,
                title: d.title,
                priority: d.priority,
                team: d.teamId
            })),
        recentTasks: tasks.slice(0, 5).map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            team: t.teamId,
            priority: t.priority
        }))
    };
}

function buildHealthSection() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const trimmedKey = apiKey?.trim();

    const issues = [];
    if (!trimmedKey) issues.push('Anthropic API key not configured');
    if (!process.env.BLOB_READ_WRITE_TOKEN) issues.push('Blob storage not configured');
    if (!process.env.ENCRYPTION_KEY) issues.push('Encryption key not configured');
    if (!process.env.ADMIN_TOKEN) issues.push('Admin token not configured');

    return {
        status: issues.length === 0 ? 'healthy' : 'degraded',
        issues,
        services: {
            anthropicApi: !!trimmedKey,
            blobStorage: !!process.env.BLOB_READ_WRITE_TOKEN,
            encryption: !!process.env.ENCRYPTION_KEY,
            redis: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
        },
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'
    };
}

function buildSummarySection() {
    const budget = checkBudgetStatus();
    const totalAgents = countTotalAgents();
    const activeAgents = countActiveAgents();
    const tasks = getTasks();
    const decisions = getDecisions();
    const orchestration = getOrchestrationState();
    const activities = getActivities({ limit: 5 });

    const pendingDecisions = decisions.filter(d => d.status === 'pending').length;
    const activeTasks = tasks.filter(t => t.status === 'in_progress').length;

    // Build a human-readable one-liner
    const lines = [];
    lines.push(`Agents: ${activeAgents}/${totalAgents} active | World: ${orchestration.worldState}`);
    lines.push(`Tasks: ${activeTasks} in-progress, ${pendingDecisions} decisions pending`);
    lines.push(`Spend: ${formatCurrency(budget.daily.used)} today (${budget.daily.percentage}% of daily limit)`);

    if (budget.exceeded) lines.push('ALERT: Budget exceeded');
    if (pendingDecisions > 0) lines.push(`ACTION NEEDED: ${pendingDecisions} decision(s) awaiting approval`);

    return {
        oneLiner: lines.join('\n'),
        recentActivity: activities.map(a => ({
            type: a.type,
            message: a.message || a.description,
            team: a.teamId,
            time: a.timestamp
        }))
    };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

module.exports = async (req, res) => {
    const clientIp = getClientIp(req);
    const origin = getCorsOrigin(req.headers.origin, getRequestHost(req));

    setSecurityHeaders(res, origin, 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(
        `ceo-briefing:${clientIp}`,
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
            retryAfter: Math.ceil(rateLimit.retryAfterMs / 1000)
        });
    }

    // Authentication required
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
        return res.status(503).json({
            error: 'CEO Briefing not configured',
            code: 'NOT_CONFIGURED',
            hint: 'Set ADMIN_TOKEN environment variable'
        });
    }

    const authResult = authenticate(req, adminToken);
    if (!authResult.authenticated) {
        addAuditEntry({
            action: 'CEO_BRIEFING_AUTH_FAILED',
            ip: clientIp,
            success: false,
            reason: authResult.error
        });
        return res.status(401).json({
            error: authResult.error,
            code: 'UNAUTHORIZED'
        });
    }

    try {
        const section = req.query.section || 'full';

        if (!CONFIG.VALID_SECTIONS.includes(section)) {
            return res.status(400).json({
                error: 'Invalid section',
                code: 'INVALID_SECTION',
                validSections: CONFIG.VALID_SECTIONS
            });
        }

        let data;

        switch (section) {
            case 'costs':
                data = { costs: buildCostSection() };
                break;
            case 'agents':
                data = { agents: buildAgentSection() };
                break;
            case 'health':
                data = { health: buildHealthSection() };
                break;
            case 'tasks':
                data = { tasks: buildTaskSection() };
                break;
            case 'summary':
                data = { summary: buildSummarySection() };
                break;
            case 'full':
            default:
                data = {
                    summary: buildSummarySection(),
                    costs: buildCostSection(),
                    agents: buildAgentSection(),
                    tasks: buildTaskSection(),
                    health: buildHealthSection()
                };
                break;
        }

        addAuditEntry({
            action: 'CEO_BRIEFING_VIEWED',
            ip: clientIp,
            success: true,
            section
        });

        return res.status(200).json({
            success: true,
            briefing: data,
            generatedAt: new Date().toISOString(),
            section
        });

    } catch (error) {
        console.error('[CEO Briefing] Error:', error);
        addAuditEntry({
            action: 'CEO_BRIEFING_ERROR',
            ip: clientIp,
            success: false,
            error: error.message
        });
        return res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};
