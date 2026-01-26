/**
 * FUSE Team Orchestration API
 * Real AI-powered team coordination using Claude
 *
 * Features:
 * - Per-team orchestration state (paused/running)
 * - Manual start/stop controls
 * - Minimal token usage for efficiency
 * - Real activity tracking
 *
 * @version 1.0.0
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
    ALLOWED_ORIGINS
} = require('./_lib/security');

const { recordUsage, estimateTokens } = require('./_lib/cost-tracker');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    RATE_LIMIT_READ: 60,
    RATE_LIMIT_WRITE: 10,
    MAX_TOKENS_PER_CALL: 300,  // Minimal tokens for efficiency
    MODEL: 'claude-3-5-haiku-latest'  // Fast and cost-effective
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
        agents: ['Architect', 'Coder', 'QA Engineer']
    },
    design: {
        name: 'Design Team',
        systemPrompt: `You are the Design Team lead coordinating UX Lead, Visual Designer, and Motion Designer for FUSE.
Your focus: user experience, visual design, animations, brand consistency.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
        agents: ['UX Lead', 'Visual Designer', 'Motion Designer']
    },
    communications: {
        name: 'Communications Team',
        systemPrompt: `You are the Communications Team lead coordinating Content Strategist, Copywriter, and Social Manager for FUSE.
Your focus: content strategy, brand voice, social media engagement.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
        agents: ['Content Strategist', 'Copywriter', 'Social Manager']
    },
    legal: {
        name: 'Legal Team',
        systemPrompt: `You are the Legal Team lead coordinating Compliance Officer, Contract Analyst, and IP Counsel for FUSE.
Your focus: regulatory compliance, contracts, intellectual property protection.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
        agents: ['Compliance Officer', 'Contract Analyst', 'IP Counsel']
    },
    marketing: {
        name: 'Marketing Team',
        systemPrompt: `You are the Marketing Team lead coordinating Growth Lead, Brand Strategist, and Analytics Expert for FUSE.
Your focus: user acquisition, brand positioning, growth metrics.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
        agents: ['Growth Lead', 'Brand Strategist', 'Analytics Expert']
    },
    gtm: {
        name: 'Go-to-Market Team',
        systemPrompt: `You are the GTM Team lead coordinating Launch Coordinator, Partnership Manager, and Market Researcher for FUSE.
Your focus: product launch, strategic partnerships, market intelligence.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
        agents: ['Launch Coordinator', 'Partnership Manager', 'Market Researcher']
    },
    sales: {
        name: 'Sales Team',
        systemPrompt: `You are the Sales Team lead coordinating Sales Director, Account Executive, SDR Lead, Solutions Consultant, and Customer Success for FUSE.
Your focus: revenue growth, pipeline management, customer relationships.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
        agents: ['Sales Director', 'Account Executive', 'SDR Lead', 'Solutions Consultant', 'Customer Success']
    }
};

// ============================================================================
// ORCHESTRATION STATE (Per-team status)
// ============================================================================

const orchestrationState = {
    teams: {
        developer: { status: 'paused', lastRun: null, runCount: 0, activities: [] },
        design: { status: 'paused', lastRun: null, runCount: 0, activities: [] },
        communications: { status: 'paused', lastRun: null, runCount: 0, activities: [] },
        legal: { status: 'paused', lastRun: null, runCount: 0, activities: [] },
        marketing: { status: 'paused', lastRun: null, runCount: 0, activities: [] },
        gtm: { status: 'paused', lastRun: null, runCount: 0, activities: [] },
        sales: { status: 'paused', lastRun: null, runCount: 0, activities: [] }
    },
    globalMode: 'manual',  // manual | supervised | autonomous
    lastActivity: null,
    totalOrchestrations: 0
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
        isReal: true  // Flag to indicate this is from actual orchestration
    };

    if (!orchestrationState.teams[teamId]) {
        orchestrationState.teams[teamId] = { status: 'paused', lastRun: null, runCount: 0, activities: [] };
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
            const isValidAgent = team.agents.some(a =>
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

async function executeOrchestration(teamId, task, clientIp) {
    const team = TEAM_PROMPTS[teamId];
    if (!team) {
        throw new Error(`Unknown team: ${teamId}`);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
        throw new Error('Anthropic API key not configured');
    }

    const userPrompt = task
        ? `Current task: ${task}\n\nProvide brief status updates from each agent.`
        : `Provide brief status updates from each agent on current priorities.`;

    const requestStartTime = Date.now();

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: CONFIG.MODEL,
                max_tokens: CONFIG.MAX_TOKENS_PER_CALL,
                system: team.systemPrompt,
                messages: [{ role: 'user', content: userPrompt }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Orchestrate] API error:', response.status, errorText);
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const latencyMs = Date.now() - requestStartTime;

        // Record usage
        const inputTokens = data.usage?.input_tokens || estimateTokens(team.systemPrompt + userPrompt);
        const outputTokens = data.usage?.output_tokens || 50;

        recordUsage({
            provider: 'anthropic',
            model: CONFIG.MODEL,
            inputTokens,
            outputTokens,
            endpoint: '/api/orchestrate',
            clientIp,
            success: true,
            latencyMs
        });

        // Parse response
        const assistantMessage = data.content?.[0]?.text || '';
        const activities = parseAgentResponses(assistantMessage, teamId);

        // Update team state
        orchestrationState.teams[teamId].lastRun = new Date().toISOString();
        orchestrationState.teams[teamId].runCount++;
        orchestrationState.totalOrchestrations++;

        return {
            success: true,
            teamId,
            teamName: team.name,
            activities,
            rawResponse: assistantMessage,
            usage: {
                inputTokens,
                outputTokens,
                latencyMs
            }
        };

    } catch (error) {
        console.error('[Orchestrate] Execution error:', error);

        // Record failed usage
        recordUsage({
            provider: 'anthropic',
            model: CONFIG.MODEL,
            inputTokens: estimateTokens(team.systemPrompt + (task || '')),
            outputTokens: 0,
            endpoint: '/api/orchestrate',
            clientIp,
            success: false,
            latencyMs: Date.now() - requestStartTime
        });

        throw error;
    }
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
    const rateLimit = await checkRateLimit(`orchestrate:get:${clientIp}`, CONFIG.RATE_LIMIT_READ, 60000);

    res.setHeader('X-RateLimit-Limit', CONFIG.RATE_LIMIT_READ);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

    if (rateLimit.limited) {
        return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMITED',
            retryAfter: Math.ceil(rateLimit.retryAfterMs / 1000)
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
                agents: TEAM_PROMPTS[teamId]?.agents || []
            }
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
                recentActivities: state.activities.slice(0, 5)
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                globalMode: orchestrationState.globalMode,
                totalOrchestrations: orchestrationState.totalOrchestrations,
                lastActivity: orchestrationState.lastActivity,
                teams: teamsStatus
            }
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
            data: allActivities.slice(0, limit)
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
        return res.status(503).json({ error: 'Orchestration not configured', code: 'NOT_CONFIGURED' });
    }

    const authResult = authenticate(req, adminToken);
    if (!authResult.authenticated) {
        addAuditEntry({
            action: 'ORCHESTRATE_AUTH_FAILED',
            ip: clientIp,
            success: false,
            reason: authResult.error
        });
        return res.status(401).json({ error: authResult.error, code: 'UNAUTHORIZED' });
    }

    // Rate limit
    const rateLimit = checkRateLimit(`orchestrate:post:${clientIp}`, CONFIG.RATE_LIMIT_WRITE, 60000);
    if (rateLimit.limited) {
        return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMITED',
            retryAfter: Math.ceil(rateLimit.retryAfterMs / 1000)
        });
    }

    const { teamId, action, task, mode } = req.body || {};

    // Validate teamId for team-specific actions
    if (action !== 'setMode' && action !== 'startAll' && action !== 'stopAll') {
        if (!teamId || !TEAM_PROMPTS[teamId]) {
            return res.status(400).json({ error: 'Invalid or missing teamId' });
        }
    }

    switch (action) {
        case 'start':
            // Start team orchestration
            orchestrationState.teams[teamId].status = 'running';
            addTeamActivity(teamId, 'System', `Orchestration started for ${TEAM_PROMPTS[teamId].name}`, 'Started');

            addAuditEntry({
                action: 'ORCHESTRATION_STARTED',
                ip: clientIp,
                success: true,
                teamId
            });

            return res.status(200).json({
                success: true,
                data: {
                    teamId,
                    status: 'running',
                    message: `${TEAM_PROMPTS[teamId].name} orchestration started`
                }
            });

        case 'stop':
            // Stop team orchestration
            orchestrationState.teams[teamId].status = 'paused';
            addTeamActivity(teamId, 'System', `Orchestration paused for ${TEAM_PROMPTS[teamId].name}`, 'Paused');

            addAuditEntry({
                action: 'ORCHESTRATION_STOPPED',
                ip: clientIp,
                success: true,
                teamId
            });

            return res.status(200).json({
                success: true,
                data: {
                    teamId,
                    status: 'paused',
                    message: `${TEAM_PROMPTS[teamId].name} orchestration paused`
                }
            });

        case 'execute':
            // Execute single orchestration cycle (uses Claude API)
            if (orchestrationState.teams[teamId].status !== 'running') {
                return res.status(400).json({
                    error: 'Team orchestration is not running. Start it first.',
                    code: 'NOT_RUNNING'
                });
            }

            try {
                const result = await executeOrchestration(teamId, task, clientIp);

                addAuditEntry({
                    action: 'ORCHESTRATION_EXECUTED',
                    ip: clientIp,
                    success: true,
                    teamId,
                    activitiesGenerated: result.activities.length
                });

                return res.status(200).json({
                    success: true,
                    data: result
                });

            } catch (error) {
                addAuditEntry({
                    action: 'ORCHESTRATION_FAILED',
                    ip: clientIp,
                    success: false,
                    teamId,
                    error: error.message
                });

                return res.status(500).json({
                    error: 'Orchestration failed',
                    code: 'EXECUTION_ERROR',
                    details: error.message
                });
            }

        case 'setMode':
            // Set global orchestration mode
            const validModes = ['manual', 'supervised', 'autonomous'];
            if (!mode || !validModes.includes(mode)) {
                return res.status(400).json({ error: 'Invalid mode. Use: manual, supervised, autonomous' });
            }

            orchestrationState.globalMode = mode;

            addAuditEntry({
                action: 'ORCHESTRATION_MODE_CHANGED',
                ip: clientIp,
                success: true,
                mode
            });

            return res.status(200).json({
                success: true,
                data: {
                    globalMode: mode,
                    message: `Global orchestration mode set to ${mode}`
                }
            });

        case 'startAll':
            // Start all teams
            Object.keys(orchestrationState.teams).forEach(id => {
                orchestrationState.teams[id].status = 'running';
                addTeamActivity(id, 'System', 'Orchestration started (batch)', 'Started');
            });

            return res.status(200).json({
                success: true,
                data: { message: 'All teams started' }
            });

        case 'stopAll':
            // Stop all teams
            Object.keys(orchestrationState.teams).forEach(id => {
                orchestrationState.teams[id].status = 'paused';
                addTeamActivity(id, 'System', 'Orchestration paused (batch)', 'Paused');
            });

            return res.status(200).json({
                success: true,
                data: { message: 'All teams paused' }
            });

        default:
            return res.status(400).json({ error: 'Unknown action. Use: start, stop, execute, setMode, startAll, stopAll' });
    }
}
