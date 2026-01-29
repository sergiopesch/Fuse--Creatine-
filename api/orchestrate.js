/**
 * FUSE Team Orchestration API
 * Real AI-powered team coordination using Claude
 *
 * Features:
 * - Per-team orchestration state (paused/running)
 * - Manual start/stop controls
 * - Multi-team and company-wide orchestration
 * - World state modes (manual, paused, semi_auto, autonomous)
 * - Minimal token usage for efficiency
 * - Real activity tracking
 *
 * @version 2.0.0
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
const { buildStateContext, syncFromAgentLoop, TEAM_PROMPTS: SHARED_TEAM_PROMPTS } = require('./_lib/agent-state');
const { checkCreditLimits } = require('./_lib/world-controller');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    RATE_LIMIT_READ: 60,
    RATE_LIMIT_WRITE: 20, // Increased for batch operations
    MAX_TOKENS_PER_CALL: 400, // Slightly increased for better responses
    MODEL: 'claude-3-5-haiku-latest', // Fast and cost-effective
    PARALLEL_EXECUTION_LIMIT: 3, // Max teams to execute in parallel
    EXECUTION_DELAY_MS: 500, // Delay between sequential executions
};

// ============================================================================
// PER-TEAM PROVIDER / MODEL CONFIGURATION
// ============================================================================

const TEAM_PROVIDERS = {
    developer:      { provider: 'openai',    model: 'gpt-5.2-2025-12-11' },
    design:         { provider: 'anthropic',  model: 'claude-3-5-haiku-latest' },
    communications: { provider: 'anthropic',  model: 'claude-3-5-haiku-latest' },
    legal:          { provider: 'anthropic',  model: 'claude-3-5-haiku-latest' },
    marketing:      { provider: 'anthropic',  model: 'claude-3-5-haiku-latest' },
    gtm:            { provider: 'anthropic',  model: 'claude-3-5-haiku-latest' },
    sales:          { provider: 'anthropic',  model: 'claude-3-5-haiku-latest' },
};

/**
 * Resolve the API key for a given provider.
 * @param {string} provider - 'anthropic' or 'openai'
 * @returns {string|undefined} The trimmed API key
 */
function resolveApiKey(provider) {
    switch (provider) {
        case 'openai':
            return process.env.OPENAI_API_KEY?.trim();
        case 'anthropic':
        default:
            return process.env.ANTHROPIC_API_KEY?.trim();
    }
}

/**
 * Get provider config for a team, with fallback to anthropic defaults.
 * @param {string} teamId
 * @returns {{ provider: string, model: string }}
 */
function getTeamProviderConfig(teamId) {
    return TEAM_PROVIDERS[teamId] || { provider: 'anthropic', model: CONFIG.MODEL };
}

// ============================================================================
// WORLD STATES
// ============================================================================

const WORLD_STATES = {
    MANUAL: 'manual', // User must manually trigger each action
    PAUSED: 'paused', // All orchestration stopped
    SEMI_AUTO: 'semi_auto', // Agents propose, user approves
    AUTONOMOUS: 'autonomous', // Agents act independently
};

// ============================================================================
// TEAM DEFINITIONS WITH SPECIALIZED PROMPTS
// ============================================================================

const TEAM_PROMPTS = {
    developer: {
        name: 'Developer Team',
        systemPrompt: `You are the Developer Team lead coordinating Architect, Coder, and QA Engineer agents for FUSE.
Your focus: platform development, code quality, system architecture.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
        agents: ['Architect', 'Coder', 'QA Engineer'],
    },
    design: {
        name: 'Design Team',
        systemPrompt: `You are the Design Team lead coordinating UX Lead, Visual Designer, and Motion Designer for FUSE.
Your focus: user experience, visual design, animations, brand consistency.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
        agents: ['UX Lead', 'Visual Designer', 'Motion Designer'],
    },
    communications: {
        name: 'Communications Team',
        systemPrompt: `You are the Communications Team lead coordinating Content Strategist, Copywriter, and Social Manager for FUSE.
Your focus: content strategy, brand voice, social media engagement.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
        agents: ['Content Strategist', 'Copywriter', 'Social Manager'],
    },
    legal: {
        name: 'Legal Team',
        systemPrompt: `You are the Legal Team lead coordinating Compliance Officer, Contract Analyst, and IP Counsel for FUSE.
Your focus: regulatory compliance, contracts, intellectual property protection.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
        agents: ['Compliance Officer', 'Contract Analyst', 'IP Counsel'],
    },
    marketing: {
        name: 'Marketing Team',
        systemPrompt: `You are the Marketing Team lead coordinating Growth Lead, Brand Strategist, and Analytics Expert for FUSE.
Your focus: user acquisition, brand positioning, growth metrics.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
        agents: ['Growth Lead', 'Brand Strategist', 'Analytics Expert'],
    },
    gtm: {
        name: 'Go-to-Market Team',
        systemPrompt: `You are the GTM Team lead coordinating Launch Coordinator, Partnership Manager, and Market Researcher for FUSE.
Your focus: product launch, strategic partnerships, market intelligence.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
        agents: ['Launch Coordinator', 'Partnership Manager', 'Market Researcher'],
    },
    sales: {
        name: 'Sales Team',
        systemPrompt: `You are the Sales Team lead coordinating Sales Director, Account Executive, SDR Lead, Solutions Consultant, and Customer Success for FUSE.
Your focus: revenue growth, pipeline management, customer relationships.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
        agents: [
            'Sales Director',
            'Account Executive',
            'SDR Lead',
            'Solutions Consultant',
            'Customer Success',
        ],
    },
};

// ============================================================================
// ORCHESTRATION STATE (Per-team status)
// ============================================================================

const orchestrationState = {
    teams: {
        developer: {
            status: 'paused',
            lastRun: null,
            runCount: 0,
            activities: [],
            pendingActions: [],
        },
        design: {
            status: 'paused',
            lastRun: null,
            runCount: 0,
            activities: [],
            pendingActions: [],
        },
        communications: {
            status: 'paused',
            lastRun: null,
            runCount: 0,
            activities: [],
            pendingActions: [],
        },
        legal: { status: 'paused', lastRun: null, runCount: 0, activities: [], pendingActions: [] },
        marketing: {
            status: 'paused',
            lastRun: null,
            runCount: 0,
            activities: [],
            pendingActions: [],
        },
        gtm: { status: 'paused', lastRun: null, runCount: 0, activities: [], pendingActions: [] },
        sales: { status: 'paused', lastRun: null, runCount: 0, activities: [], pendingActions: [] },
    },
    worldState: WORLD_STATES.PAUSED, // Current world state
    globalMode: 'manual', // Legacy - maps to worldState
    lastActivity: null,
    totalOrchestrations: 0,
    executionInProgress: false,
    lastExecutionTime: null,
    autonomousInterval: null, // For autonomous mode timer
};

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
        isReal: true, // Flag to indicate this is from actual orchestration
    };

    if (!orchestrationState.teams[teamId]) {
        orchestrationState.teams[teamId] = {
            status: 'paused',
            lastRun: null,
            runCount: 0,
            activities: [],
        };
    }

    orchestrationState.teams[teamId].activities.unshift(activity);

    // Keep only last 50 activities per team
    if (orchestrationState.teams[teamId].activities.length > 50) {
        orchestrationState.teams[teamId].activities.length = 50;
    }

    orchestrationState.lastActivity = activity;
    return activity;
}

function parseAgentResponses(response, teamId) {
    const team = TEAM_PROMPTS[teamId];
    if (!team) return [];

    const activities = [];
    const lines = response.split('\n').filter(line => line.trim());

    for (const line of lines) {
        // Try to parse [AGENT_NAME]: message format
        const match = line.match(/^\[?([A-Za-z\s]+)\]?:\s*(.+)$/);
        if (match) {
            const agentName = match[1].trim();
            const message = match[2].trim();

            // Verify agent belongs to team
            const isValidAgent = team.agents.some(
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

    // If no structured response, create a team-level activity
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
    const team = TEAM_PROMPTS[teamId];
    if (!team) {
        throw new Error(`Unknown team: ${teamId}`);
    }

    // Resolve provider/model/key for this team
    const { provider, model } = getTeamProviderConfig(teamId);
    const apiKey = resolveApiKey(provider);
    if (!apiKey) {
        throw new Error(`API key not configured for provider: ${provider}`);
    }

    // Enhanced prompt with context
    let userPrompt = task
        ? `Current task: ${task}\n\nProvide brief status updates from each agent.`
        : `Provide brief status updates from each agent on current priorities.`;

    // Add collaboration context if orchestrating with other teams
    if (context.collaboratingTeams && context.collaboratingTeams.length > 0) {
        userPrompt += `\n\nNote: This is a coordinated orchestration with: ${context.collaboratingTeams.join(', ')}. Consider cross-team dependencies.`;
    }

    const requestStartTime = Date.now();

    try {
        let data;

        if (provider === 'openai') {
            // OpenAI Responses API
            const response = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    instructions: team.systemPrompt,
                    input: userPrompt,
                    max_output_tokens: CONFIG.MAX_TOKENS_PER_CALL,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Orchestrate] OpenAI API error:', response.status, errorText);
                throw new Error(`API error: ${response.status}`);
            }

            const raw = await response.json();
            // Normalize to Anthropic-like shape for downstream code
            const outputText = (raw.output || [])
                .filter(item => item.type === 'message')
                .flatMap(item => (item.content || []).filter(c => c.type === 'output_text').map(c => c.text))
                .join('\n') || (typeof raw.output === 'string' ? raw.output : '');

            data = {
                content: [{ type: 'text', text: outputText }],
                usage: {
                    input_tokens: raw.usage?.input_tokens || 0,
                    output_tokens: raw.usage?.output_tokens || 0,
                },
            };
        } else {
            // Anthropic Messages API (default)
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model,
                    max_tokens: CONFIG.MAX_TOKENS_PER_CALL,
                    system: team.systemPrompt,
                    messages: [{ role: 'user', content: userPrompt }],
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Orchestrate] Anthropic API error:', response.status, errorText);
                throw new Error(`API error: ${response.status}`);
            }

            data = await response.json();
        }

        const latencyMs = Date.now() - requestStartTime;

        // Record usage
        const inputTokens =
            data.usage?.input_tokens || estimateTokens(team.systemPrompt + userPrompt);
        const outputTokens = data.usage?.output_tokens || 50;

        recordUsage({
            provider,
            model,
            inputTokens,
            outputTokens,
            endpoint: '/api/orchestrate',
            clientIp,
            success: true,
            latencyMs,
        });

        // Parse response
        const assistantMessage = data.content?.[0]?.text || '';
        const activities = parseAgentResponses(assistantMessage, teamId);

        // Update team state
        orchestrationState.teams[teamId].lastRun = new Date().toISOString();
        orchestrationState.teams[teamId].runCount++;
        orchestrationState.totalOrchestrations++;
        orchestrationState.lastExecutionTime = new Date().toISOString();

        return {
            success: true,
            teamId,
            teamName: team.name,
            activities,
            rawResponse: assistantMessage,
            usage: {
                inputTokens,
                outputTokens,
                latencyMs,
            },
        };
    } catch (error) {
        console.error('[Orchestrate] Execution error:', error);

        // Record failed usage
        recordUsage({
            provider,
            model,
            inputTokens: estimateTokens(team.systemPrompt + (task || '')),
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

/**
 * Execute orchestration for multiple teams (sequential with optional parallel batching)
 */
async function executeMultipleTeams(teamIds, task, clientIp, options = {}) {
    const { parallel = false } = options;
    const results = {
        success: true,
        executed: [],
        failed: [],
        totalActivities: [],
        usage: { inputTokens: 0, outputTokens: 0, totalLatencyMs: 0 },
    };

    // Filter to only valid, running teams
    const validTeamIds = teamIds.filter(id => {
        const teamState = orchestrationState.teams[id];
        return teamState && teamState.status === 'running' && TEAM_PROMPTS[id];
    });

    if (validTeamIds.length === 0) {
        return {
            success: false,
            error: 'No valid running teams to execute',
            executed: [],
            failed: teamIds,
        };
    }

    // Get team names for collaboration context
    const collaboratingTeamNames = validTeamIds.map(id => TEAM_PROMPTS[id].name);

    if (parallel && validTeamIds.length > 1) {
        // Parallel execution in batches
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

            // Small delay between batches to avoid rate limiting
            if (batches.indexOf(batch) < batches.length - 1) {
                await sleep(CONFIG.EXECUTION_DELAY_MS);
            }
        }
    } else {
        // Sequential execution
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

                // Small delay between teams
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

/**
 * Execute orchestration for ALL teams
 */
async function executeAllTeams(task, clientIp, options = {}) {
    const allTeamIds = Object.keys(TEAM_PROMPTS);
    return executeMultipleTeams(allTeamIds, task, clientIp, options);
}

/**
 * Helper function to sleep
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// WORLD STATE MANAGEMENT
// ============================================================================

function setWorldState(newState, _source = 'api') {
    const validStates = Object.values(WORLD_STATES);
    if (!validStates.includes(newState)) {
        return { success: false, error: `Invalid state. Valid states: ${validStates.join(', ')}` };
    }

    const previousState = orchestrationState.worldState;
    orchestrationState.worldState = newState;
    orchestrationState.globalMode = newState; // Keep legacy compatibility

    // Handle state transitions
    switch (newState) {
        case WORLD_STATES.PAUSED:
            // Pause all teams
            Object.keys(orchestrationState.teams).forEach(teamId => {
                orchestrationState.teams[teamId].status = 'paused';
            });
            // Clear any autonomous interval
            if (orchestrationState.autonomousInterval) {
                clearInterval(orchestrationState.autonomousInterval);
                orchestrationState.autonomousInterval = null;
            }
            break;

        case WORLD_STATES.MANUAL:
            // Keep team states as-is, but stop autonomous execution
            if (orchestrationState.autonomousInterval) {
                clearInterval(orchestrationState.autonomousInterval);
                orchestrationState.autonomousInterval = null;
            }
            break;

        case WORLD_STATES.SEMI_AUTO:
            // Enable all teams for semi-auto mode
            Object.keys(orchestrationState.teams).forEach(teamId => {
                orchestrationState.teams[teamId].status = 'running';
            });
            break;

        case WORLD_STATES.AUTONOMOUS:
            // Enable all teams for autonomous mode
            Object.keys(orchestrationState.teams).forEach(teamId => {
                orchestrationState.teams[teamId].status = 'running';
            });
            break;
    }

    // Add system activity
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
        teamsAffected: Object.keys(orchestrationState.teams).length,
    };
}

function getWorldState() {
    return {
        worldState: orchestrationState.worldState,
        globalMode: orchestrationState.globalMode,
        teams: Object.fromEntries(
            Object.entries(orchestrationState.teams).map(([id, team]) => [
                id,
                {
                    name: TEAM_PROMPTS[id]?.name,
                    status: team.status,
                    lastRun: team.lastRun,
                    runCount: team.runCount,
                    recentActivityCount: team.activities.length,
                    pendingActionsCount: team.pendingActions?.length || 0,
                },
            ])
        ),
        totalOrchestrations: orchestrationState.totalOrchestrations,
        lastExecutionTime: orchestrationState.lastExecutionTime,
        executionInProgress: orchestrationState.executionInProgress,
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

    // Validate origin
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
// GET HANDLER - Status queries (public with rate limiting)
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

    // Get specific team status
    if (teamId && teamId !== 'all') {
        const teamState = orchestrationState.teams[teamId];
        if (!teamState) {
            return res.status(404).json({ error: 'Team not found' });
        }

        return res.status(200).json({
            success: true,
            data: {
                teamId,
                teamName: TEAM_PROMPTS[teamId]?.name || teamId,
                ...teamState,
                agents: TEAM_PROMPTS[teamId]?.agents || [],
            },
        });
    }

    // Get all teams status
    if (action === 'status' || !action) {
        const teamsStatus = {};
        Object.entries(orchestrationState.teams).forEach(([id, state]) => {
            teamsStatus[id] = {
                name: TEAM_PROMPTS[id]?.name || id,
                status: state.status,
                lastRun: state.lastRun,
                runCount: state.runCount,
                recentActivities: state.activities.slice(0, 5),
                pendingActionsCount: state.pendingActions?.length || 0,
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                worldState: orchestrationState.worldState,
                globalMode: orchestrationState.globalMode,
                totalOrchestrations: orchestrationState.totalOrchestrations,
                lastActivity: orchestrationState.lastActivity,
                lastExecutionTime: orchestrationState.lastExecutionTime,
                executionInProgress: orchestrationState.executionInProgress,
                teams: teamsStatus,
            },
        });
    }

    // Get full world state
    if (action === 'worldState') {
        return res.status(200).json({
            success: true,
            data: getWorldState(),
        });
    }

    // Get recent activities across all teams
    if (action === 'activities') {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const allActivities = [];

        Object.entries(orchestrationState.teams).forEach(([teamId, state]) => {
            state.activities.forEach(activity => {
                allActivities.push({ ...activity, teamId });
            });
        });

        // Sort by timestamp descending
        allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return res.status(200).json({
            success: true,
            data: allActivities.slice(0, limit),
        });
    }

    return res.status(400).json({ error: 'Unknown action' });
}

// ============================================================================
// POST HANDLER - Orchestration commands (authenticated)
// ============================================================================

async function handlePost(req, res, clientIp) {
    // Authenticate
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

    // Rate limit
    const rateLimit = await checkRateLimit(
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

    // Actions that don't require a specific teamId
    const globalActions = [
        'setMode', 'setWorldState', 'startAll', 'stopAll',
        'executeAll', 'executeMultiple', 'getWorldState',
        'execute-agentic-all'
    ];

    // Validate teamId for team-specific actions
    if (!globalActions.includes(action)) {
        if (!teamId || !TEAM_PROMPTS[teamId]) {
            return res.status(400).json({
                error: 'Invalid or missing teamId',
                validTeams: Object.keys(TEAM_PROMPTS),
            });
        }
    }

    switch (action) {
        case 'start':
            // Start team orchestration
            orchestrationState.teams[teamId].status = 'running';
            addTeamActivity(
                teamId,
                'System',
                `Orchestration started for ${TEAM_PROMPTS[teamId].name}`,
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
                    message: `${TEAM_PROMPTS[teamId].name} orchestration started`,
                },
            });

        case 'stop':
            // Stop team orchestration
            orchestrationState.teams[teamId].status = 'paused';
            addTeamActivity(
                teamId,
                'System',
                `Orchestration paused for ${TEAM_PROMPTS[teamId].name}`,
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
                    message: `${TEAM_PROMPTS[teamId].name} orchestration paused`,
                },
            });

        case 'execute':
            // Execute single orchestration cycle (uses Claude API)
            // Auto-start team if not running (improved UX)
            if (orchestrationState.teams[teamId].status !== 'running') {
                orchestrationState.teams[teamId].status = 'running';
                addTeamActivity(teamId, 'System', `Auto-started for execution`, 'Auto-Start');
            }

            orchestrationState.executionInProgress = true;
            try {
                const result = await executeOrchestration(teamId, task, clientIp);
                orchestrationState.executionInProgress = false;

                addAuditEntry({
                    action: 'ORCHESTRATION_EXECUTED',
                    ip: clientIp,
                    success: true,
                    teamId,
                    activitiesGenerated: result.activities.length,
                });

                return res.status(200).json({
                    success: true,
                    data: result,
                });
            } catch (error) {
                orchestrationState.executionInProgress = false;
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

        case 'execute-agentic': {
            // ================================================================
            // AGENTIC EXECUTION - Full tool-use loop with observe/act/evaluate
            // This is the agent-native mode. The agent gets tools, iterates
            // in a loop, and signals completion when done.
            // ================================================================

            // Auto-start team if not running
            if (orchestrationState.teams[teamId].status !== 'running') {
                orchestrationState.teams[teamId].status = 'running';
                addTeamActivity(teamId, 'System', 'Auto-started for agentic execution', 'Auto-Start');
            }

            orchestrationState.executionInProgress = true;

            try {
                // Resolve provider/model/key for this team
                const agenticProviderConfig = getTeamProviderConfig(teamId);
                const agenticProvider = agenticProviderConfig.provider;
                const agenticModel = req.body?.model || agenticProviderConfig.model;
                const agenticApiKey = resolveApiKey(agenticProvider);

                if (!agenticApiKey) {
                    return res.status(503).json({
                        error: `API key not configured for provider: ${agenticProvider}`,
                        code: 'NOT_CONFIGURED'
                    });
                }

                // Build state context for the agent loop
                let agenticCreditStatus = { status: 'ok', message: 'Within limits' };
                try {
                    agenticCreditStatus = checkCreditLimits();
                } catch (_e) { /* credit check failure shouldn't block */ }

                const stateContext = buildStateContext(agenticCreditStatus);

                // Get team prompt config
                const agenticTeamPrompt = TEAM_PROMPTS[teamId] || SHARED_TEAM_PROMPTS[teamId];
                if (!agenticTeamPrompt) {
                    return res.status(400).json({
                        error: `No prompt config for team: ${teamId}`,
                        code: 'INVALID_TEAM'
                    });
                }

                // Run the agent loop
                const loopResult = await runAgentLoop(
                    teamId,
                    task || 'Assess current priorities and take appropriate action for your team.',
                    agenticTeamPrompt,
                    stateContext,
                    {
                        apiKey: agenticApiKey,
                        provider: agenticProvider,
                        model: agenticModel,
                        maxIterations: Math.min(req.body?.maxIterations || 6, 10),
                        clientIp,
                    }
                );

                // Sync agent loop results back to unified state
                syncFromAgentLoop(loopResult, stateContext);

                // Also sync activities to orchestration state for backward compat
                for (const activity of loopResult.activities || []) {
                    addTeamActivity(teamId, activity.agent, activity.message, activity.tag);
                }

                // Update orchestration tracking
                orchestrationState.executionInProgress = false;
                orchestrationState.teams[teamId].lastRun = new Date().toISOString();
                orchestrationState.teams[teamId].runCount++;
                orchestrationState.totalOrchestrations++;
                orchestrationState.lastExecutionTime = new Date().toISOString();

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
                orchestrationState.executionInProgress = false;

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
            // ================================================================
            // AGENTIC EXECUTION FOR ALL TEAMS
            // Runs each team through the agentic loop sequentially
            // ================================================================
            orchestrationState.executionInProgress = true;

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

            const allTeamIds = Object.keys(TEAM_PROMPTS);

            for (const tid of allTeamIds) {
                // Auto-start team
                if (orchestrationState.teams[tid] && orchestrationState.teams[tid].status !== 'running') {
                    orchestrationState.teams[tid].status = 'running';
                    addTeamActivity(tid, 'System', 'Auto-started for company-wide agentic execution', 'Auto-Start');
                }

                try {
                    let tidCreditStatus = { status: 'ok', message: 'Within limits' };
                    try { tidCreditStatus = checkCreditLimits(); } catch (_e) { /* */ }

                    const tidStateContext = buildStateContext(tidCreditStatus);
                    const tidTeamPrompt = TEAM_PROMPTS[tid] || SHARED_TEAM_PROMPTS[tid];

                    if (!tidTeamPrompt) continue;

                    // Resolve provider/model/key per team
                    const tidProviderConfig = getTeamProviderConfig(tid);
                    const tidProvider = tidProviderConfig.provider;
                    const tidModel = req.body?.model || tidProviderConfig.model;
                    const tidApiKey = resolveApiKey(tidProvider);

                    if (!tidApiKey) {
                        allTeamsResults.teams.push({
                            teamId: tid,
                            success: false,
                            error: `API key not configured for provider: ${tidProvider}`,
                        });
                        allTeamsResults.failed = (allTeamsResults.failed || 0) + 1;
                        continue;
                    }

                    const tidResult = await runAgentLoop(
                        tid,
                        task || 'Assess current priorities and take appropriate action for your team.',
                        tidTeamPrompt,
                        tidStateContext,
                        {
                            apiKey: tidApiKey,
                            provider: tidProvider,
                            model: tidModel,
                            maxIterations: Math.min(req.body?.maxIterations || 4, 6),
                            clientIp,
                        }
                    );

                    syncFromAgentLoop(tidResult, tidStateContext);

                    for (const activity of tidResult.activities || []) {
                        addTeamActivity(tid, activity.agent, activity.message, activity.tag);
                    }

                    orchestrationState.teams[tid].lastRun = new Date().toISOString();
                    orchestrationState.teams[tid].runCount++;
                    orchestrationState.totalOrchestrations++;

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

            orchestrationState.executionInProgress = false;
            orchestrationState.lastExecutionTime = new Date().toISOString();

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

        case 'executeMultiple':
            // Execute multiple teams at once
            const { teamIds: multiTeamIds, parallel } = req.body || {};

            if (!multiTeamIds || !Array.isArray(multiTeamIds) || multiTeamIds.length === 0) {
                return res.status(400).json({
                    error: 'teamIds array is required',
                    code: 'VALIDATION_ERROR',
                });
            }

            // Auto-start all specified teams
            multiTeamIds.forEach(tid => {
                if (
                    orchestrationState.teams[tid] &&
                    orchestrationState.teams[tid].status !== 'running'
                ) {
                    orchestrationState.teams[tid].status = 'running';
                    addTeamActivity(
                        tid,
                        'System',
                        'Auto-started for multi-team execution',
                        'Auto-Start'
                    );
                }
            });

            orchestrationState.executionInProgress = true;
            try {
                const multiResult = await executeMultipleTeams(multiTeamIds, task, clientIp, {
                    parallel: !!parallel,
                });
                orchestrationState.executionInProgress = false;

                addAuditEntry({
                    action: 'MULTI_TEAM_ORCHESTRATION_EXECUTED',
                    ip: clientIp,
                    success: multiResult.success,
                    teamsExecuted: multiResult.executed.length,
                    teamsFailed: multiResult.failed.length,
                });

                return res.status(200).json({
                    success: true,
                    data: multiResult,
                });
            } catch (error) {
                orchestrationState.executionInProgress = false;
                return res.status(500).json({
                    error: 'Multi-team orchestration failed',
                    code: 'EXECUTION_ERROR',
                    details: error.message,
                });
            }
        }

        case 'executeAll':
            // Execute ALL teams (company-wide orchestration)
            orchestrationState.executionInProgress = true;

            // Auto-start all teams
            Object.keys(orchestrationState.teams).forEach(tid => {
                if (orchestrationState.teams[tid].status !== 'running') {
                    orchestrationState.teams[tid].status = 'running';
                    addTeamActivity(
                        tid,
                        'System',
                        'Auto-started for company-wide execution',
                        'Auto-Start'
                    );
                }
            });

            try {
                const allResult = await executeAllTeams(task, clientIp, {
                    parallel: req.body?.parallel,
                });
                orchestrationState.executionInProgress = false;

                addAuditEntry({
                    action: 'ALL_TEAMS_ORCHESTRATION_EXECUTED',
                    ip: clientIp,
                    success: allResult.success,
                    teamsExecuted: allResult.executed.length,
                    teamsFailed: allResult.failed.length,
                    totalActivities: allResult.totalActivities.length,
                });

                return res.status(200).json({
                    success: true,
                    data: allResult,
                });
            } catch (error) {
                orchestrationState.executionInProgress = false;
                return res.status(500).json({
                    error: 'Company-wide orchestration failed',
                    code: 'EXECUTION_ERROR',
                    details: error.message,
                });
            }

        case 'setWorldState': {
            // Set world state (paused, manual, semi_auto, autonomous)
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

            return res.status(200).json({
                success: true,
                data: worldStateResult,
            });
        }

        case 'setMode': {
            // Legacy: Set global orchestration mode (maps to world state)
            let mappedMode = mode;

            // Map legacy 'supervised' to 'semi_auto'
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
                    worldState: orchestrationState.worldState,
                    message: `Orchestration mode set to ${mappedMode}`,
                },
            });
        }

        case 'startAll':
            // Start all teams
            Object.keys(orchestrationState.teams).forEach(id => {
                orchestrationState.teams[id].status = 'running';
                addTeamActivity(id, 'System', 'Orchestration started (batch)', 'Started');
            });

            // Update world state if it was paused
            if (orchestrationState.worldState === WORLD_STATES.PAUSED) {
                orchestrationState.worldState = WORLD_STATES.MANUAL;
                orchestrationState.globalMode = WORLD_STATES.MANUAL;
            }

            return res.status(200).json({
                success: true,
                data: {
                    message: 'All teams started',
                    worldState: orchestrationState.worldState,
                    teamsStarted: Object.keys(orchestrationState.teams).length,
                },
            });

        case 'stopAll':
            // Stop all teams
            Object.keys(orchestrationState.teams).forEach(id => {
                orchestrationState.teams[id].status = 'paused';
                addTeamActivity(id, 'System', 'Orchestration paused (batch)', 'Paused');
            });

            // Update world state to paused
            orchestrationState.worldState = WORLD_STATES.PAUSED;
            orchestrationState.globalMode = WORLD_STATES.PAUSED;

            return res.status(200).json({
                success: true,
                data: {
                    message: 'All teams paused',
                    worldState: orchestrationState.worldState,
                    teamsPaused: Object.keys(orchestrationState.teams).length,
                },
            });

        case 'getWorldState':
            // Get current world state (also available via GET)
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
