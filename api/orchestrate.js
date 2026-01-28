/**
 * FUSE Team Orchestration API
 * Real AI-powered team coordination using Claude
 *
 * Features:
 * - Per-team orchestration state via unified agent-state.js
 * - Manual start/stop controls
 * - Multi-team and company-wide orchestration
 * - World state modes (manual, paused, semi_auto, autonomous)
 * - Agentic tool-use loop via agent-loop.js
 * - Minimal token usage for efficiency
 * - Real activity tracking
 *
 * REFACTORED: Removed local orchestrationState and TEAM_PROMPTS.
 * All state now flows through agent-state.js (single source of truth).
 *
 * @version 3.0.0
 */

const {
    authenticate,
    checkRateLimit,
    setSecurityHeaders,
    getCorsOrigin,
    getClientIp,
    getRequestHost,
    addAuditEntry,
    sanitizeString,
} = require('./_lib/security');

const { recordUsage, estimateTokens } = require('./_lib/cost-tracker');
const { runAgentLoop } = require('./_lib/agent-loop');
const { checkCreditLimits } = require('./_lib/world-controller');

// Single source of truth
const agentState = require('./_lib/agent-state');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    RATE_LIMIT_READ: 60,
    RATE_LIMIT_WRITE: 20,
    MAX_TOKENS_PER_CALL: 400,
    MODEL: 'claude-3-5-haiku-latest',
    PARALLEL_EXECUTION_LIMIT: 3,
    EXECUTION_DELAY_MS: 500,
};

// ============================================================================
// WORLD STATES (re-exported for backward compat)
// ============================================================================

const WORLD_STATES = agentState.WORLD_STATES;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function addTeamActivity(teamId, agent, message, tag) {
    const activity = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        agent: sanitizeString(agent, 100),
        teamId,
        message: sanitizeString(message, 500),
        tag: sanitizeString(tag, 50),
        timestamp: new Date().toISOString(),
        isReal: true,
    };

    // Write to unified state
    agentState.addActivity(activity);

    // Also update orchestration lastActivity
    agentState.setOrchestrationFlag('lastActivity', activity);

    return activity;
}

function parseAgentResponses(response, teamId) {
    const teamPrompt = agentState.getTeamPrompt(teamId);
    if (!teamPrompt) return [];

    const activities = [];
    const lines = response.split('\n').filter(line => line.trim());

    for (const line of lines) {
        const match = line.match(/^\[?([A-Za-z\s]+)\]?:\s*(.+)$/);
        if (match) {
            const agentName = match[1].trim();
            const message = match[2].trim();

            const isValidAgent = teamPrompt.agents.some(
                a =>
                    a.toLowerCase() === agentName.toLowerCase() ||
                    agentName.toLowerCase().includes(a.toLowerCase().split(' ')[0])
            );

            if (isValidAgent && message.length > 5) {
                const activity = addTeamActivity(teamId, agentName, message, 'Orchestration');
                activities.push(activity);
            }
        }
    }

    if (activities.length === 0 && response.length > 10) {
        const activity = addTeamActivity(teamId, 'Team Lead', response.substring(0, 200), 'Status');
        activities.push(activity);
    }

    return activities;
}

// ============================================================================
// ORCHESTRATION ENGINE
// ============================================================================

async function executeOrchestration(teamId, task, clientIp, context = {}) {
    const teamPrompt = agentState.getTeamPrompt(teamId);
    if (!teamPrompt) {
        throw new Error(`Unknown team: ${teamId}`);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
        throw new Error('Anthropic API key not configured');
    }

    let userPrompt = task
        ? `Current task: ${task}\n\nProvide brief status updates from each agent.`
        : `Provide brief status updates from each agent on current priorities.`;

    if (context.collaboratingTeams && context.collaboratingTeams.length > 0) {
        userPrompt += `\n\nNote: This is a coordinated orchestration with: ${context.collaboratingTeams.join(', ')}. Consider cross-team dependencies.`;
    }

    const requestStartTime = Date.now();

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: CONFIG.MODEL,
                max_tokens: CONFIG.MAX_TOKENS_PER_CALL,
                system: teamPrompt.systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Orchestrate] API error:', response.status, errorText);
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const latencyMs = Date.now() - requestStartTime;

        const inputTokens =
            data.usage?.input_tokens || estimateTokens(teamPrompt.systemPrompt + userPrompt);
        const outputTokens = data.usage?.output_tokens || 50;

        recordUsage({
            provider: 'anthropic',
            model: CONFIG.MODEL,
            inputTokens,
            outputTokens,
            endpoint: '/api/orchestrate',
            clientIp,
            success: true,
            latencyMs,
        });

        const assistantMessage = data.content?.[0]?.text || '';
        const activities = parseAgentResponses(assistantMessage, teamId);

        // Update orchestration tracking through agent-state
        agentState.setTeamOrchestrationStatus(teamId, {
            status: 'running',
            lastRun: new Date().toISOString(),
            runCount: (agentState.getTeamOrchestrationStatus(teamId)?.runCount || 0) + 1,
        });
        agentState.setOrchestrationFlag('totalOrchestrations',
            (agentState.getOrchestrationState().totalOrchestrations || 0) + 1);
        agentState.setOrchestrationFlag('lastExecutionTime', new Date().toISOString());

        return {
            success: true,
            teamId,
            teamName: teamPrompt.name,
            activities,
            rawResponse: assistantMessage,
            usage: { inputTokens, outputTokens, latencyMs },
        };
    } catch (error) {
        console.error('[Orchestrate] Execution error:', error);

        recordUsage({
            provider: 'anthropic',
            model: CONFIG.MODEL,
            inputTokens: estimateTokens(teamPrompt.systemPrompt + (task || '')),
            outputTokens: 0,
            endpoint: '/api/orchestrate',
            clientIp,
            success: false,
            latencyMs: Date.now() - requestStartTime,
        });

        throw error;
    }
}

// ============================================================================
// MULTI-TEAM ORCHESTRATION
// ============================================================================

async function executeMultipleTeams(teamIds, task, clientIp, options = {}) {
    const { parallel = false } = options;
    const results = {
        success: true,
        executed: [],
        failed: [],
        totalActivities: [],
        usage: { inputTokens: 0, outputTokens: 0, totalLatencyMs: 0 },
    };

    const allTeamPrompts = agentState.getAllTeamPrompts();

    const validTeamIds = teamIds.filter(id => {
        const orchStatus = agentState.getTeamOrchestrationStatus(id);
        return orchStatus && orchStatus.status === 'running' && allTeamPrompts[id];
    });

    if (validTeamIds.length === 0) {
        return {
            success: false,
            error: 'No valid running teams to execute',
            executed: [],
            failed: teamIds,
        };
    }

    const collaboratingTeamNames = validTeamIds.map(id => allTeamPrompts[id].name);

    if (parallel && validTeamIds.length > 1) {
        const batches = [];
        for (let i = 0; i < validTeamIds.length; i += CONFIG.PARALLEL_EXECUTION_LIMIT) {
            batches.push(validTeamIds.slice(i, i + CONFIG.PARALLEL_EXECUTION_LIMIT));
        }

        for (const batch of batches) {
            const batchPromises = batch.map(teamId =>
                executeOrchestration(teamId, task, clientIp, {
                    collaboratingTeams: collaboratingTeamNames,
                })
                    .then(result => ({ teamId, result, success: true }))
                    .catch(error => ({ teamId, error: error.message, success: false }))
            );

            const batchResults = await Promise.all(batchPromises);

            for (const br of batchResults) {
                if (br.success) {
                    results.executed.push(br.teamId);
                    results.totalActivities.push(...br.result.activities);
                    results.usage.inputTokens += br.result.usage?.inputTokens || 0;
                    results.usage.outputTokens += br.result.usage?.outputTokens || 0;
                    results.usage.totalLatencyMs += br.result.usage?.latencyMs || 0;
                } else {
                    results.failed.push({ teamId: br.teamId, error: br.error });
                }
            }

            if (batches.indexOf(batch) < batches.length - 1) {
                await sleep(CONFIG.EXECUTION_DELAY_MS);
            }
        }
    } else {
        for (const teamId of validTeamIds) {
            try {
                const result = await executeOrchestration(teamId, task, clientIp, {
                    collaboratingTeams: collaboratingTeamNames,
                });
                results.executed.push(teamId);
                results.totalActivities.push(...result.activities);
                results.usage.inputTokens += result.usage?.inputTokens || 0;
                results.usage.outputTokens += result.usage?.outputTokens || 0;
                results.usage.totalLatencyMs += result.usage?.latencyMs || 0;

                if (validTeamIds.indexOf(teamId) < validTeamIds.length - 1) {
                    await sleep(CONFIG.EXECUTION_DELAY_MS);
                }
            } catch (error) {
                results.failed.push({ teamId, error: error.message });
            }
        }
    }

    results.success = results.executed.length > 0;
    return results;
}

async function executeAllTeams(task, clientIp, options = {}) {
    const allTeamIds = Object.keys(agentState.getAllTeamPrompts());
    return executeMultipleTeams(allTeamIds, task, clientIp, options);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// WORLD STATE MANAGEMENT (delegates to agent-state)
// ============================================================================

function setWorldState(newState, _source = 'api') {
    const validStates = Object.values(WORLD_STATES);
    if (!validStates.includes(newState)) {
        return { success: false, error: `Invalid state. Valid states: ${validStates.join(', ')}` };
    }

    const orchestration = agentState.getOrchestrationState();
    const previousState = orchestration.worldState;

    agentState.setWorldState(newState);

    // Handle team status transitions
    const allTeamIds = Object.keys(agentState.getAllTeamPrompts());

    switch (newState) {
        case WORLD_STATES.PAUSED:
            allTeamIds.forEach(teamId => {
                agentState.setTeamOrchestrationStatus(teamId, { status: 'paused' });
            });
            break;

        case WORLD_STATES.SEMI_AUTO:
        case WORLD_STATES.AUTONOMOUS:
            allTeamIds.forEach(teamId => {
                agentState.setTeamOrchestrationStatus(teamId, { status: 'running' });
            });
            break;
    }

    addTeamActivity(
        'system',
        'System',
        `World state changed: ${previousState} → ${newState}`,
        'State Change'
    );

    return {
        success: true,
        previousState,
        currentState: newState,
        teamsAffected: allTeamIds.length,
    };
}

function getWorldState() {
    const orchestration = agentState.getOrchestrationState();
    const allTeamPrompts = agentState.getAllTeamPrompts();

    return {
        worldState: orchestration.worldState,
        globalMode: orchestration.worldState,
        teams: Object.fromEntries(
            Object.keys(allTeamPrompts).map(id => {
                const orchStatus = agentState.getTeamOrchestrationStatus(id);
                return [
                    id,
                    {
                        name: allTeamPrompts[id]?.name,
                        status: orchStatus?.status || 'paused',
                        lastRun: orchStatus?.lastRun || null,
                        runCount: orchStatus?.runCount || 0,
                        recentActivityCount: orchStatus?.lastActivities?.length || 0,
                        pendingActionsCount: 0,
                    },
                ];
            })
        ),
        totalOrchestrations: orchestration.totalOrchestrations || 0,
        lastExecutionTime: orchestration.lastExecutionTime || null,
        executionInProgress: orchestration.executionInProgress || false,
    };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

module.exports = async (req, res) => {
    const clientIp = getClientIp(req);
    const origin = getCorsOrigin(req.headers.origin, getRequestHost(req));

    setSecurityHeaders(res, origin, 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.headers.origin && !origin) {
        return res.status(403).json({ error: 'Origin not allowed', code: 'CORS_ERROR' });
    }

    try {
        switch (req.method) {
            case 'GET':
                return await handleGet(req, res, clientIp);
            case 'POST':
                return await handlePost(req, res, clientIp);
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('[Orchestrate] Error:', error);
        return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
};

// ============================================================================
// GET HANDLER
// ============================================================================

async function handleGet(req, res, clientIp) {
    const rateLimit = await checkRateLimit(
        `orchestrate:get:${clientIp}`,
        CONFIG.RATE_LIMIT_READ,
        60000
    );

    res.setHeader('X-RateLimit-Limit', CONFIG.RATE_LIMIT_READ);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

    if (rateLimit.limited) {
        return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMITED',
            retryAfter: Math.ceil(rateLimit.retryAfterMs / 1000),
        });
    }

    const { teamId, action } = req.query;
    const allTeamPrompts = agentState.getAllTeamPrompts();

    if (teamId && teamId !== 'all') {
        const orchStatus = agentState.getTeamOrchestrationStatus(teamId);
        if (!orchStatus) {
            return res.status(404).json({ error: 'Team not found' });
        }

        return res.status(200).json({
            success: true,
            data: {
                teamId,
                teamName: allTeamPrompts[teamId]?.name || teamId,
                ...orchStatus,
                agents: allTeamPrompts[teamId]?.agents || [],
            },
        });
    }

    if (action === 'status' || !action) {
        const orchestration = agentState.getOrchestrationState();
        const teamsStatus = {};

        Object.keys(allTeamPrompts).forEach(id => {
            const orchStatus = agentState.getTeamOrchestrationStatus(id);
            teamsStatus[id] = {
                name: allTeamPrompts[id]?.name || id,
                status: orchStatus?.status || 'paused',
                lastRun: orchStatus?.lastRun || null,
                runCount: orchStatus?.runCount || 0,
                recentActivities: agentState.getActivities({ teamId: id, limit: 5 }),
                pendingActionsCount: 0,
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                worldState: orchestration.worldState,
                globalMode: orchestration.worldState,
                totalOrchestrations: orchestration.totalOrchestrations || 0,
                lastActivity: orchestration.lastActivity || null,
                lastExecutionTime: orchestration.lastExecutionTime || null,
                executionInProgress: orchestration.executionInProgress || false,
                teams: teamsStatus,
            },
        });
    }

    if (action === 'worldState') {
        return res.status(200).json({
            success: true,
            data: getWorldState(),
        });
    }

    if (action === 'activities') {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const activities = agentState.getActivities({ limit });

        return res.status(200).json({
            success: true,
            data: activities,
        });
    }

    return res.status(400).json({ error: 'Unknown action' });
}

// ============================================================================
// POST HANDLER
// ============================================================================

async function handlePost(req, res, clientIp) {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
        return res
            .status(503)
            .json({ error: 'Orchestration not configured', code: 'NOT_CONFIGURED' });
    }

    const authResult = authenticate(req, adminToken);
    if (!authResult.authenticated) {
        addAuditEntry({
            action: 'ORCHESTRATE_AUTH_FAILED',
            ip: clientIp,
            success: false,
            reason: authResult.error,
        });
        return res.status(401).json({ error: authResult.error, code: 'UNAUTHORIZED' });
    }

    const rateLimit = checkRateLimit(
        `orchestrate:post:${clientIp}`,
        CONFIG.RATE_LIMIT_WRITE,
        60000
    );
    if (rateLimit.limited) {
        return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMITED',
            retryAfter: Math.ceil(rateLimit.retryAfterMs / 1000),
        });
    }

    const { teamId, action, task, mode } = req.body || {};
    const allTeamPrompts = agentState.getAllTeamPrompts();

    const globalActions = [
        'setMode', 'setWorldState', 'startAll', 'stopAll',
        'executeAll', 'executeMultiple', 'getWorldState',
        'execute-agentic-all'
    ];

    if (!globalActions.includes(action)) {
        if (!teamId || !allTeamPrompts[teamId]) {
            return res.status(400).json({
                error: 'Invalid or missing teamId',
                validTeams: Object.keys(allTeamPrompts),
            });
        }
    }

    switch (action) {
        case 'start':
            agentState.setTeamOrchestrationStatus(teamId, { status: 'running' });
            addTeamActivity(
                teamId,
                'System',
                `Orchestration started for ${allTeamPrompts[teamId].name}`,
                'Started'
            );

            addAuditEntry({
                action: 'ORCHESTRATION_STARTED',
                ip: clientIp,
                success: true,
                teamId,
            });

            return res.status(200).json({
                success: true,
                data: {
                    teamId,
                    status: 'running',
                    message: `${allTeamPrompts[teamId].name} orchestration started`,
                },
            });

        case 'stop':
            agentState.setTeamOrchestrationStatus(teamId, { status: 'paused' });
            addTeamActivity(
                teamId,
                'System',
                `Orchestration paused for ${allTeamPrompts[teamId].name}`,
                'Paused'
            );

            addAuditEntry({
                action: 'ORCHESTRATION_STOPPED',
                ip: clientIp,
                success: true,
                teamId,
            });

            return res.status(200).json({
                success: true,
                data: {
                    teamId,
                    status: 'paused',
                    message: `${allTeamPrompts[teamId].name} orchestration paused`,
                },
            });

        case 'execute': {
            // Single-shot orchestration (non-agentic, legacy path)
            const orchStatus = agentState.getTeamOrchestrationStatus(teamId);
            if (orchStatus?.status !== 'running') {
                agentState.setTeamOrchestrationStatus(teamId, { status: 'running' });
                addTeamActivity(teamId, 'System', 'Auto-started for execution', 'Auto-Start');
            }

            agentState.setOrchestrationFlag('executionInProgress', true);
            try {
                const result = await executeOrchestration(teamId, task, clientIp);
                agentState.setOrchestrationFlag('executionInProgress', false);

                addAuditEntry({
                    action: 'ORCHESTRATION_EXECUTED',
                    ip: clientIp,
                    success: true,
                    teamId,
                    activitiesGenerated: result.activities.length,
                });

                return res.status(200).json({ success: true, data: result });
            } catch (error) {
                agentState.setOrchestrationFlag('executionInProgress', false);
                addAuditEntry({
                    action: 'ORCHESTRATION_FAILED',
                    ip: clientIp,
                    success: false,
                    teamId,
                    error: error.message,
                });

                return res.status(500).json({
                    error: 'Orchestration failed',
                    code: 'EXECUTION_ERROR',
                    details: error.message,
                });
            }
        }

        case 'execute-agentic': {
            const agenticOrchStatus = agentState.getTeamOrchestrationStatus(teamId);
            if (agenticOrchStatus?.status !== 'running') {
                agentState.setTeamOrchestrationStatus(teamId, { status: 'running' });
                addTeamActivity(teamId, 'System', 'Auto-started for agentic execution', 'Auto-Start');
            }

            agentState.setOrchestrationFlag('executionInProgress', true);

            try {
                const agenticApiKey = process.env.ANTHROPIC_API_KEY?.trim();
                if (!agenticApiKey || !agenticApiKey.startsWith('sk-ant-')) {
                    return res.status(503).json({
                        error: 'Anthropic API key not configured',
                        code: 'NOT_CONFIGURED'
                    });
                }

                let agenticCreditStatus = { status: 'ok', message: 'Within limits' };
                try { agenticCreditStatus = checkCreditLimits(); } catch (_e) { /* */ }

                const stateContext = agentState.buildStateContext(agenticCreditStatus);

                const agenticTeamPrompt = allTeamPrompts[teamId];
                if (!agenticTeamPrompt) {
                    return res.status(400).json({
                        error: `No prompt config for team: ${teamId}`,
                        code: 'INVALID_TEAM'
                    });
                }

                const loopResult = await runAgentLoop(
                    teamId,
                    task || 'Assess current priorities and take appropriate action for your team.',
                    agenticTeamPrompt,
                    stateContext,
                    {
                        apiKey: agenticApiKey,
                        model: req.body?.model || CONFIG.MODEL,
                        maxIterations: Math.min(req.body?.maxIterations || 6, 10),
                        clientIp,
                    }
                );

                agentState.syncFromAgentLoop(loopResult, stateContext);

                for (const activity of loopResult.activities || []) {
                    addTeamActivity(teamId, activity.agent, activity.message, activity.tag);
                }

                agentState.setOrchestrationFlag('executionInProgress', false);
                agentState.setTeamOrchestrationStatus(teamId, {
                    lastRun: new Date().toISOString(),
                    runCount: (agentState.getTeamOrchestrationStatus(teamId)?.runCount || 0) + 1,
                });
                agentState.setOrchestrationFlag('totalOrchestrations',
                    (agentState.getOrchestrationState().totalOrchestrations || 0) + 1);
                agentState.setOrchestrationFlag('lastExecutionTime', new Date().toISOString());

                addAuditEntry({
                    action: 'AGENTIC_ORCHESTRATION_EXECUTED',
                    ip: clientIp,
                    success: loopResult.success,
                    teamId,
                    iterations: loopResult.iterations,
                    toolCalls: loopResult.toolCalls.length,
                    tasksCreated: loopResult.tasksCreated.length,
                    decisionsCreated: loopResult.decisionsCreated.length,
                    completed: loopResult.completed,
                });

                return res.status(200).json({
                    success: true,
                    data: {
                        teamId,
                        teamName: agenticTeamPrompt.name,
                        mode: 'agentic',
                        completed: loopResult.completed,
                        iterations: loopResult.iterations,
                        completionSummary: loopResult.completionSummary,
                        activities: loopResult.activities,
                        tasksCreated: loopResult.tasksCreated,
                        decisionsCreated: loopResult.decisionsCreated,
                        messagesSent: loopResult.messagesSent,
                        toolCalls: loopResult.toolCalls.map(tc => ({
                            tool: tc.tool,
                            input: tc.input,
                            success: tc.output?.success,
                            iteration: tc.iteration,
                        })),
                        textResponses: loopResult.textResponses,
                        usage: loopResult.usage,
                    }
                });
            } catch (error) {
                agentState.setOrchestrationFlag('executionInProgress', false);

                addAuditEntry({
                    action: 'AGENTIC_ORCHESTRATION_FAILED',
                    ip: clientIp,
                    success: false,
                    teamId,
                    error: error.message,
                });

                return res.status(500).json({
                    error: 'Agentic orchestration failed',
                    code: 'AGENTIC_EXECUTION_ERROR',
                    details: error.message,
                });
            }
        }

        case 'execute-agentic-all': {
            agentState.setOrchestrationFlag('executionInProgress', true);

            const agenticAllApiKey = process.env.ANTHROPIC_API_KEY?.trim();
            if (!agenticAllApiKey || !agenticAllApiKey.startsWith('sk-ant-')) {
                agentState.setOrchestrationFlag('executionInProgress', false);
                return res.status(503).json({
                    error: 'Anthropic API key not configured',
                    code: 'NOT_CONFIGURED'
                });
            }

            const allTeamsResults = {
                success: true,
                mode: 'agentic',
                teams: [],
                totalIterations: 0,
                totalToolCalls: 0,
                totalTasksCreated: 0,
                totalDecisionsCreated: 0,
                usage: { inputTokens: 0, outputTokens: 0, apiCalls: 0 },
            };

            const allTeamIds = Object.keys(allTeamPrompts);

            for (const tid of allTeamIds) {
                const tidOrchStatus = agentState.getTeamOrchestrationStatus(tid);
                if (tidOrchStatus?.status !== 'running') {
                    agentState.setTeamOrchestrationStatus(tid, { status: 'running' });
                    addTeamActivity(tid, 'System', 'Auto-started for company-wide agentic execution', 'Auto-Start');
                }

                try {
                    let tidCreditStatus = { status: 'ok', message: 'Within limits' };
                    try { tidCreditStatus = checkCreditLimits(); } catch (_e) { /* */ }

                    const tidStateContext = agentState.buildStateContext(tidCreditStatus);
                    const tidTeamPrompt = allTeamPrompts[tid];

                    if (!tidTeamPrompt) continue;

                    const tidResult = await runAgentLoop(
                        tid,
                        task || 'Assess current priorities and take appropriate action for your team.',
                        tidTeamPrompt,
                        tidStateContext,
                        {
                            apiKey: agenticAllApiKey,
                            model: req.body?.model || CONFIG.MODEL,
                            maxIterations: Math.min(req.body?.maxIterations || 4, 6),
                            clientIp,
                        }
                    );

                    agentState.syncFromAgentLoop(tidResult, tidStateContext);

                    for (const activity of tidResult.activities || []) {
                        addTeamActivity(tid, activity.agent, activity.message, activity.tag);
                    }

                    agentState.setTeamOrchestrationStatus(tid, {
                        lastRun: new Date().toISOString(),
                        runCount: (agentState.getTeamOrchestrationStatus(tid)?.runCount || 0) + 1,
                    });
                    agentState.setOrchestrationFlag('totalOrchestrations',
                        (agentState.getOrchestrationState().totalOrchestrations || 0) + 1);

                    allTeamsResults.teams.push({
                        teamId: tid,
                        teamName: tidTeamPrompt.name,
                        completed: tidResult.completed,
                        iterations: tidResult.iterations,
                        summary: tidResult.completionSummary,
                        toolCalls: tidResult.toolCalls.length,
                        tasksCreated: tidResult.tasksCreated.length,
                        decisionsCreated: tidResult.decisionsCreated.length,
                    });

                    allTeamsResults.totalIterations += tidResult.iterations;
                    allTeamsResults.totalToolCalls += tidResult.toolCalls.length;
                    allTeamsResults.totalTasksCreated += tidResult.tasksCreated.length;
                    allTeamsResults.totalDecisionsCreated += tidResult.decisionsCreated.length;
                    allTeamsResults.usage.inputTokens += tidResult.usage.inputTokens;
                    allTeamsResults.usage.outputTokens += tidResult.usage.outputTokens;
                    allTeamsResults.usage.apiCalls += tidResult.usage.apiCalls;
                } catch (error) {
                    allTeamsResults.teams.push({
                        teamId: tid,
                        error: error.message,
                        completed: false,
                    });
                }
            }

            agentState.setOrchestrationFlag('executionInProgress', false);
            agentState.setOrchestrationFlag('lastExecutionTime', new Date().toISOString());

            addAuditEntry({
                action: 'AGENTIC_ALL_TEAMS_EXECUTED',
                ip: clientIp,
                success: true,
                teamsRun: allTeamsResults.teams.length,
                totalToolCalls: allTeamsResults.totalToolCalls,
            });

            return res.status(200).json({
                success: true,
                data: allTeamsResults,
            });
        }

        case 'executeMultiple': {
            const { teamIds: multiTeamIds, parallel } = req.body || {};

            if (!multiTeamIds || !Array.isArray(multiTeamIds) || multiTeamIds.length === 0) {
                return res.status(400).json({
                    error: 'teamIds array is required',
                    code: 'VALIDATION_ERROR',
                });
            }

            multiTeamIds.forEach(tid => {
                const orchStatus = agentState.getTeamOrchestrationStatus(tid);
                if (orchStatus && orchStatus.status !== 'running') {
                    agentState.setTeamOrchestrationStatus(tid, { status: 'running' });
                    addTeamActivity(tid, 'System', 'Auto-started for multi-team execution', 'Auto-Start');
                }
            });

            agentState.setOrchestrationFlag('executionInProgress', true);
            try {
                const multiResult = await executeMultipleTeams(multiTeamIds, task, clientIp, {
                    parallel: !!parallel,
                });
                agentState.setOrchestrationFlag('executionInProgress', false);

                addAuditEntry({
                    action: 'MULTI_TEAM_ORCHESTRATION_EXECUTED',
                    ip: clientIp,
                    success: multiResult.success,
                    teamsExecuted: multiResult.executed.length,
                    teamsFailed: multiResult.failed.length,
                });

                return res.status(200).json({ success: true, data: multiResult });
            } catch (error) {
                agentState.setOrchestrationFlag('executionInProgress', false);
                return res.status(500).json({
                    error: 'Multi-team orchestration failed',
                    code: 'EXECUTION_ERROR',
                    details: error.message,
                });
            }
        }

        case 'executeAll': {
            agentState.setOrchestrationFlag('executionInProgress', true);

            const allIds = Object.keys(allTeamPrompts);
            allIds.forEach(tid => {
                const orchStatus = agentState.getTeamOrchestrationStatus(tid);
                if (orchStatus?.status !== 'running') {
                    agentState.setTeamOrchestrationStatus(tid, { status: 'running' });
                    addTeamActivity(tid, 'System', 'Auto-started for company-wide execution', 'Auto-Start');
                }
            });

            try {
                const allResult = await executeAllTeams(task, clientIp, {
                    parallel: req.body?.parallel,
                });
                agentState.setOrchestrationFlag('executionInProgress', false);

                addAuditEntry({
                    action: 'ALL_TEAMS_ORCHESTRATION_EXECUTED',
                    ip: clientIp,
                    success: allResult.success,
                    teamsExecuted: allResult.executed.length,
                    teamsFailed: allResult.failed.length,
                    totalActivities: allResult.totalActivities.length,
                });

                return res.status(200).json({ success: true, data: allResult });
            } catch (error) {
                agentState.setOrchestrationFlag('executionInProgress', false);
                return res.status(500).json({
                    error: 'Company-wide orchestration failed',
                    code: 'EXECUTION_ERROR',
                    details: error.message,
                });
            }
        }

        case 'setWorldState': {
            const newWorldState = req.body?.state;
            if (!newWorldState) {
                return res.status(400).json({
                    error: 'state is required',
                    code: 'VALIDATION_ERROR',
                    validStates: Object.values(WORLD_STATES),
                });
            }

            const worldStateResult = setWorldState(newWorldState, 'api');

            addAuditEntry({
                action: 'WORLD_STATE_CHANGED',
                ip: clientIp,
                success: worldStateResult.success,
                previousState: worldStateResult.previousState,
                newState: newWorldState,
            });

            if (!worldStateResult.success) {
                return res.status(400).json({
                    error: worldStateResult.error,
                    code: 'INVALID_STATE',
                });
            }

            return res.status(200).json({ success: true, data: worldStateResult });
        }

        case 'setMode': {
            let mappedMode = mode;
            if (mode === 'supervised') mappedMode = 'semi_auto';

            if (!mappedMode || !Object.values(WORLD_STATES).includes(mappedMode)) {
                return res.status(400).json({
                    error: `Invalid mode. Use: ${Object.values(WORLD_STATES).join(', ')}`,
                    code: 'VALIDATION_ERROR',
                });
            }

            const modeResult = setWorldState(mappedMode, 'api');

            addAuditEntry({
                action: 'ORCHESTRATION_MODE_CHANGED',
                ip: clientIp,
                success: modeResult.success,
                mode: mappedMode,
            });

            return res.status(200).json({
                success: true,
                data: {
                    globalMode: mappedMode,
                    worldState: agentState.getOrchestrationState().worldState,
                    message: `Orchestration mode set to ${mappedMode}`,
                },
            });
        }

        case 'startAll': {
            const startAllIds = Object.keys(allTeamPrompts);
            startAllIds.forEach(id => {
                agentState.setTeamOrchestrationStatus(id, { status: 'running' });
                addTeamActivity(id, 'System', 'Orchestration started (batch)', 'Started');
            });

            const orch = agentState.getOrchestrationState();
            if (orch.worldState === WORLD_STATES.PAUSED) {
                agentState.setWorldState(WORLD_STATES.MANUAL);
            }

            return res.status(200).json({
                success: true,
                data: {
                    message: 'All teams started',
                    worldState: agentState.getOrchestrationState().worldState,
                    teamsStarted: startAllIds.length,
                },
            });
        }

        case 'stopAll': {
            const stopAllIds = Object.keys(allTeamPrompts);
            stopAllIds.forEach(id => {
                agentState.setTeamOrchestrationStatus(id, { status: 'paused' });
                addTeamActivity(id, 'System', 'Orchestration paused (batch)', 'Paused');
            });

            agentState.setWorldState(WORLD_STATES.PAUSED);

            return res.status(200).json({
                success: true,
                data: {
                    message: 'All teams paused',
                    worldState: WORLD_STATES.PAUSED,
                    teamsPaused: stopAllIds.length,
                },
            });
        }

        case 'getWorldState':
            return res.status(200).json({
                success: true,
                data: getWorldState(),
            });

        default:
            return res.status(400).json({
                error: 'Unknown action',
                code: 'INVALID_ACTION',
                validActions: [
                    'start', 'stop', 'execute', 'execute-agentic',
                    'executeMultiple', 'executeAll', 'execute-agentic-all',
                    'setMode', 'setWorldState',
                    'startAll', 'stopAll', 'getWorldState'
                ]
            });
    }
}
