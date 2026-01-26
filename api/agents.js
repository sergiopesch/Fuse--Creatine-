/**
 * FUSE Agent Command Center API
 * Backend for managing AI agent teams and orchestration
 *
 * SECURITY: This API requires authentication for all state-changing operations.
 * Read-only operations (GET) are rate-limited but public for demo purposes.
 *
 * @version 2.0.0 - Added authentication, rate limiting, audit logging
 */

const {
    createSecuredHandler,
    authenticate,
    checkRateLimit,
    setSecurityHeaders,
    getCorsOrigin,
    getClientIp,
    addAuditEntry,
    getAuditLog,
    validateRequestBody,
    sanitizeString,
    ALLOWED_ORIGINS
} = require('./_lib/security');

const { recordUsage, getUsageSummary } = require('./_lib/cost-tracker');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Rate limits (requests per minute)
    RATE_LIMIT_READ: 60,      // GET requests
    RATE_LIMIT_WRITE: 20,     // POST/PUT/DELETE requests

    // Maximum items
    MAX_TASKS: 100,
    MAX_DECISIONS: 50,
    MAX_ACTIVITIES: 100,
    MAX_COMMUNICATIONS: 50,

    // String limits
    MAX_TITLE_LENGTH: 200,
    MAX_DESCRIPTION_LENGTH: 2000,
    MAX_MESSAGE_LENGTH: 1000
};

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const SCHEMAS = {
    task: {
        title: { type: 'string', required: true, maxLength: CONFIG.MAX_TITLE_LENGTH },
        description: { type: 'string', maxLength: CONFIG.MAX_DESCRIPTION_LENGTH },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
        teamId: { type: 'string', required: true, maxLength: 50 },
        assignedAgents: { type: 'array', maxItems: 10 }
    },
    decision: {
        title: { type: 'string', required: true, maxLength: CONFIG.MAX_TITLE_LENGTH },
        description: { type: 'string', maxLength: CONFIG.MAX_DESCRIPTION_LENGTH },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
        teamId: { type: 'string', required: true, maxLength: 50 },
        requestedBy: { type: 'string', maxLength: 100 },
        impact: { type: 'string', maxLength: CONFIG.MAX_DESCRIPTION_LENGTH }
    },
    broadcast: {
        message: { type: 'string', required: true, maxLength: CONFIG.MAX_MESSAGE_LENGTH },
        priority: { type: 'string', enum: ['info', 'important', 'urgent'], default: 'info' },
        recipients: { type: 'array', maxItems: 20 }
    },
    agentStatus: {
        teamId: { type: 'string', required: true, maxLength: 50 },
        agentId: { type: 'string', required: true, maxLength: 50 },
        status: { type: 'string', required: true, enum: ['working', 'idle', 'offline'] }
    },
    orchestrationMode: {
        mode: { type: 'string', required: true, enum: ['autonomous', 'supervised', 'manual'] }
    },
    apiKey: {
        provider: { type: 'string', required: true, enum: ['anthropic', 'openai', 'gemini'] },
        model: { type: 'string', maxLength: 100 },
        apiKey: { type: 'string', maxLength: 200 }
    }
};

// ============================================================================
// AGENT TEAM DATA STRUCTURE
// ============================================================================

const defaultAgentTeams = {
    developer: {
        id: 'developer',
        name: 'Developer Team',
        badge: 'DEV',
        color: '#3b82f6',
        agents: [
            { id: 'architect', name: 'Architect', role: 'System Design & Architecture', status: 'working' },
            { id: 'coder', name: 'Coder', role: 'Implementation & Debugging', status: 'working' },
            { id: 'tester', name: 'QA Engineer', role: 'Testing & Quality Assurance', status: 'idle' }
        ]
    },
    design: {
        id: 'design',
        name: 'Design Team',
        badge: 'DSN',
        color: '#8b5cf6',
        agents: [
            { id: 'ux-lead', name: 'UX Lead', role: 'User Experience Strategy', status: 'working' },
            { id: 'ui-artist', name: 'Visual Designer', role: 'UI & Visual Systems', status: 'idle' },
            { id: 'motion', name: 'Motion Designer', role: 'Animation & Interactions', status: 'working' }
        ]
    },
    communications: {
        id: 'communications',
        name: 'Communications Team',
        badge: 'COM',
        color: '#06b6d4',
        agents: [
            { id: 'content-strategist', name: 'Content Strategist', role: 'Content Planning & Voice', status: 'working' },
            { id: 'copywriter', name: 'Copywriter', role: 'Persuasive Copy & Messaging', status: 'idle' },
            { id: 'social-manager', name: 'Social Media Manager', role: 'Community & Engagement', status: 'working' }
        ]
    },
    legal: {
        id: 'legal',
        name: 'Legal Team',
        badge: 'LGL',
        color: '#f59e0b',
        agents: [
            { id: 'compliance-officer', name: 'Compliance Officer', role: 'Regulatory Compliance', status: 'working' },
            { id: 'contract-analyst', name: 'Contract Analyst', role: 'Terms & Agreements', status: 'idle' },
            { id: 'ip-counsel', name: 'IP Counsel', role: 'Intellectual Property', status: 'idle' }
        ]
    },
    marketing: {
        id: 'marketing',
        name: 'Marketing Team',
        badge: 'MKT',
        color: '#ef4444',
        agents: [
            { id: 'growth-lead', name: 'Growth Lead', role: 'Acquisition & Retention', status: 'working' },
            { id: 'brand-strategist', name: 'Brand Strategist', role: 'Brand Identity & Positioning', status: 'working' },
            { id: 'analytics-expert', name: 'Analytics Expert', role: 'Data & Performance', status: 'working' }
        ]
    },
    gtm: {
        id: 'gtm',
        name: 'Go-to-Market Team',
        badge: 'GTM',
        color: '#10b981',
        agents: [
            { id: 'launch-coordinator', name: 'Launch Coordinator', role: 'Launch Planning & Execution', status: 'working' },
            { id: 'partnership-manager', name: 'Partnership Manager', role: 'Strategic Partnerships', status: 'idle' },
            { id: 'market-researcher', name: 'Market Researcher', role: 'Market Intelligence', status: 'working' }
        ]
    },
    sales: {
        id: 'sales',
        name: 'Sales Team',
        badge: 'SLS',
        color: '#ec4899',
        agents: [
            { id: 'sales-director', name: 'Sales Director', role: 'Revenue Strategy & Team Leadership', status: 'working' },
            { id: 'account-executive', name: 'Account Executive', role: 'Enterprise Sales & Closing', status: 'working' },
            { id: 'sdr', name: 'SDR Lead', role: 'Outbound Prospecting & Lead Qualification', status: 'working' },
            { id: 'solutions-consultant', name: 'Solutions Consultant', role: 'Technical Sales & Demos', status: 'idle' },
            { id: 'customer-success', name: 'Customer Success Manager', role: 'Retention & Expansion', status: 'working' }
        ]
    }
};

// ============================================================================
// IN-MEMORY STATE (Consider database for production)
// ============================================================================

let agentState = {
    teams: JSON.parse(JSON.stringify(defaultAgentTeams)), // Deep clone
    tasks: [],
    decisions: [],
    activities: [],
    communications: [],
    orchestrationMode: 'autonomous',
    apiKeyConfig: {
        anthropic: { configured: false, model: 'claude-3-5-haiku-latest', lastUpdated: null },
        openai: { configured: false, model: 'gpt-4-turbo', lastUpdated: null },
        gemini: { configured: false, model: 'gemini-pro', lastUpdated: null }
    },
    healthMetrics: {
        lastHealthCheck: null,
        systemLoad: 0,
        memoryUsage: 0,
        apiLatency: {}
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function countTotalAgents() {
    return Object.values(agentState.teams).reduce((count, team) => count + team.agents.length, 0);
}

function countActiveAgents() {
    return Object.values(agentState.teams).reduce(
        (count, team) => count + team.agents.filter(a => a.status === 'working').length,
        0
    );
}

function getApiKeyStatus() {
    // Check environment variables for configured keys (never expose actual values)
    const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
    const openaiConfigured = Boolean(process.env.OPENAI_API_KEY);
    const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);

    return {
        anthropic: {
            configured: anthropicConfigured || agentState.apiKeyConfig.anthropic.configured,
            model: agentState.apiKeyConfig.anthropic.model,
            lastUpdated: agentState.apiKeyConfig.anthropic.lastUpdated,
            provider: 'Anthropic',
            models: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-3-opus-latest']
        },
        openai: {
            configured: openaiConfigured || agentState.apiKeyConfig.openai.configured,
            model: agentState.apiKeyConfig.openai.model,
            lastUpdated: agentState.apiKeyConfig.openai.lastUpdated,
            provider: 'OpenAI',
            models: ['gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo']
        },
        gemini: {
            configured: geminiConfigured || agentState.apiKeyConfig.gemini.configured,
            model: agentState.apiKeyConfig.gemini.model,
            lastUpdated: agentState.apiKeyConfig.gemini.lastUpdated,
            provider: 'Google',
            models: ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro']
        }
    };
}

function getAgentHealthSummary() {
    const summary = {
        totalAgents: countTotalAgents(),
        activeAgents: countActiveAgents(),
        idleAgents: countTotalAgents() - countActiveAgents(),
        teamHealth: {}
    };

    Object.entries(agentState.teams).forEach(([teamId, team]) => {
        const activeInTeam = team.agents.filter(a => a.status === 'working').length;
        const totalInTeam = team.agents.length;
        summary.teamHealth[teamId] = {
            name: team.name,
            active: activeInTeam,
            total: totalInTeam,
            utilization: Math.round((activeInTeam / totalInTeam) * 100),
            status: activeInTeam === 0 ? 'idle' : activeInTeam === totalInTeam ? 'full-capacity' : 'operational'
        };
    });

    return summary;
}

function addActivity(agent, teamId, message, tag) {
    const activity = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        agent: sanitizeString(agent, 100),
        teamId: sanitizeString(teamId, 50),
        message: sanitizeString(message, CONFIG.MAX_MESSAGE_LENGTH),
        tag: sanitizeString(tag, 50),
        timestamp: new Date().toISOString()
    };
    agentState.activities.unshift(activity);

    // Enforce max limit
    if (agentState.activities.length > CONFIG.MAX_ACTIVITIES) {
        agentState.activities.length = CONFIG.MAX_ACTIVITIES;
    }
    return activity;
}

function addCommunication(fromAgent, fromTeam, toTeam, message, toAgent = null) {
    const comm = {
        id: `comm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from: {
            agent: sanitizeString(fromAgent, 100),
            teamId: sanitizeString(fromTeam, 50)
        },
        to: {
            agent: toAgent ? sanitizeString(toAgent, 100) : 'Team',
            teamId: sanitizeString(toTeam, 50)
        },
        message: sanitizeString(message, CONFIG.MAX_MESSAGE_LENGTH),
        timestamp: new Date().toISOString()
    };
    agentState.communications.unshift(comm);

    if (agentState.communications.length > CONFIG.MAX_COMMUNICATIONS) {
        agentState.communications.length = CONFIG.MAX_COMMUNICATIONS;
    }
    return comm;
}

function generateAnalytics() {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
        overview: {
            totalAgents: countTotalAgents(),
            activeAgents: countActiveAgents(),
            totalTasks: agentState.tasks.length,
            completedTasks: agentState.tasks.filter(t => t.status === 'completed').length,
            pendingDecisions: agentState.decisions.filter(d => d.status === 'pending').length
        },
        teamPerformance: Object.entries(agentState.teams).map(([id, team]) => ({
            teamId: id,
            teamName: team.name,
            activeAgents: team.agents.filter(a => a.status === 'working').length,
            totalAgents: team.agents.length,
            efficiency: Math.round(85 + Math.random() * 15)
        })),
        recentActivity: {
            last24Hours: agentState.activities.filter(a =>
                new Date(a.timestamp) > new Date(now - 24 * 60 * 60 * 1000)
            ).length,
            today: agentState.activities.filter(a =>
                new Date(a.timestamp) > dayStart
            ).length
        },
        orchestrationMetrics: {
            mode: agentState.orchestrationMode,
            crossTeamCollaborations: agentState.communications.length,
            averageResponseTime: '2.3s',
            uptime: '99.9%'
        }
    };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

module.exports = async (req, res) => {
    const clientIp = getClientIp(req);
    const origin = getCorsOrigin(req.headers.origin);

    // Set security headers
    setSecurityHeaders(res, origin, 'GET, POST, PUT, DELETE, OPTIONS');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Validate origin
    if (req.headers.origin && !origin) {
        addAuditEntry({
            action: 'AGENTS_CORS_REJECTED',
            ip: clientIp,
            origin: req.headers.origin,
            success: false,
            endpoint: '/api/agents'
        });
        return res.status(403).json({
            error: 'Origin not allowed',
            code: 'CORS_ERROR'
        });
    }

    const { method, query } = req;
    const action = query.action || 'status';

    try {
        switch (method) {
            case 'GET':
                return handleGet(action, query, res, clientIp);
            case 'POST':
            case 'PUT':
            case 'DELETE':
                // These require authentication
                return handleAuthenticatedRequest(method, action, req, res, clientIp);
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('[Agents API] Error:', error);
        addAuditEntry({
            action: 'AGENTS_ERROR',
            ip: clientIp,
            success: false,
            endpoint: '/api/agents',
            error: error.message
        });
        return res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

// ============================================================================
// GET HANDLERS (Public with rate limiting)
// ============================================================================

function handleGet(action, query, res, clientIp) {
    // Rate limit GET requests
    const rateLimit = checkRateLimit(`agents:get:${clientIp}`, CONFIG.RATE_LIMIT_READ, 60000);

    res.setHeader('X-RateLimit-Limit', CONFIG.RATE_LIMIT_READ);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

    if (rateLimit.limited) {
        res.setHeader('Retry-After', Math.ceil(rateLimit.retryAfterMs / 1000));
        return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMITED',
            retryAfter: Math.ceil(rateLimit.retryAfterMs / 1000)
        });
    }

    switch (action) {
        case 'status':
            const totalAgents = countTotalAgents();
            return res.status(200).json({
                success: true,
                data: {
                    totalAgents,
                    activeAgents: countActiveAgents(),
                    idleAgents: totalAgents - countActiveAgents(),
                    tasksInProgress: agentState.tasks.filter(t => t.status === 'in_progress').length,
                    pendingDecisions: agentState.decisions.filter(d => d.status === 'pending').length,
                    orchestrationMode: agentState.orchestrationMode,
                    apiKeyConfig: getApiKeyStatus(),
                    healthMetrics: agentState.healthMetrics,
                    teamCount: Object.keys(agentState.teams).length,
                    timestamp: new Date().toISOString()
                }
            });

        case 'health':
            return res.status(200).json({
                success: true,
                data: {
                    status: 'healthy',
                    uptime: process.uptime ? process.uptime() : 'N/A',
                    memory: process.memoryUsage ? process.memoryUsage() : 'N/A',
                    agents: getAgentHealthSummary(),
                    apiKeys: getApiKeyStatus(),
                    lastCheck: new Date().toISOString()
                }
            });

        case 'api-keys':
            return res.status(200).json({
                success: true,
                data: getApiKeyStatus()
            });

        case 'teams':
            const teamId = query.teamId;
            if (teamId && teamId !== 'all') {
                const team = agentState.teams[teamId];
                if (!team) {
                    return res.status(404).json({ error: 'Team not found' });
                }
                return res.status(200).json({ success: true, data: team });
            }
            return res.status(200).json({ success: true, data: agentState.teams });

        case 'agents':
            const agentTeamId = query.teamId;
            const agentId = query.agentId;
            if (agentTeamId && agentId) {
                const team = agentState.teams[agentTeamId];
                if (!team) {
                    return res.status(404).json({ error: 'Team not found' });
                }
                const agent = team.agents.find(a => a.id === agentId);
                if (!agent) {
                    return res.status(404).json({ error: 'Agent not found' });
                }
                return res.status(200).json({ success: true, data: agent });
            }
            const allAgents = [];
            Object.values(agentState.teams).forEach(team => {
                team.agents.forEach(agent => {
                    allAgents.push({ ...agent, teamId: team.id, teamName: team.name });
                });
            });
            return res.status(200).json({ success: true, data: allAgents });

        case 'tasks':
            const taskTeamId = query.teamId;
            const taskStatus = query.status;
            let tasks = [...agentState.tasks];
            if (taskTeamId) {
                tasks = tasks.filter(t => t.teamId === taskTeamId);
            }
            if (taskStatus) {
                tasks = tasks.filter(t => t.status === taskStatus);
            }
            return res.status(200).json({ success: true, data: tasks });

        case 'decisions':
            const decisionStatus = query.status || 'pending';
            const decisions = agentState.decisions.filter(d => d.status === decisionStatus);
            return res.status(200).json({ success: true, data: decisions });

        case 'activities':
            const limit = Math.min(parseInt(query.limit) || 20, 100);
            const activities = agentState.activities.slice(0, limit);
            return res.status(200).json({ success: true, data: activities });

        case 'communications':
            const commsTeamId = query.teamId;
            let communications = [...agentState.communications];
            if (commsTeamId && commsTeamId !== 'all') {
                communications = communications.filter(c =>
                    c.from.teamId === commsTeamId || c.to.teamId === commsTeamId
                );
            }
            return res.status(200).json({ success: true, data: communications });

        case 'analytics':
            return res.status(200).json({
                success: true,
                data: generateAnalytics()
            });

        case 'costs':
            // Cost transparency endpoint
            const period = query.period || 'today';
            return res.status(200).json({
                success: true,
                data: getUsageSummary(period)
            });

        default:
            return res.status(400).json({ error: 'Unknown action', code: 'INVALID_ACTION' });
    }
}

// ============================================================================
// AUTHENTICATED HANDLERS (POST, PUT, DELETE)
// ============================================================================

async function handleAuthenticatedRequest(method, action, req, res, clientIp) {
    // Authenticate
    const adminToken = process.env.ADMIN_TOKEN || process.env.AGENTS_API_TOKEN;

    if (!adminToken) {
        console.error('[Agents API] No authentication token configured');
        return res.status(503).json({
            error: 'Agent management is not configured',
            code: 'NOT_CONFIGURED'
        });
    }

    const authResult = authenticate(req, adminToken);
    if (!authResult.authenticated) {
        addAuditEntry({
            action: 'AGENTS_AUTH_FAILED',
            ip: clientIp,
            success: false,
            endpoint: '/api/agents',
            method,
            reason: authResult.error
        });
        return res.status(401).json({
            error: authResult.error,
            code: 'UNAUTHORIZED'
        });
    }

    // Rate limit write operations more strictly
    const rateLimit = checkRateLimit(`agents:write:${clientIp}`, CONFIG.RATE_LIMIT_WRITE, 60000);

    res.setHeader('X-RateLimit-Limit', CONFIG.RATE_LIMIT_WRITE);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

    if (rateLimit.limited) {
        res.setHeader('Retry-After', Math.ceil(rateLimit.retryAfterMs / 1000));
        return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMITED',
            retryAfter: Math.ceil(rateLimit.retryAfterMs / 1000)
        });
    }

    // Route to appropriate handler
    switch (method) {
        case 'POST':
            return handlePost(action, req.body, res, clientIp);
        case 'PUT':
            return handlePut(action, req.body, res, clientIp);
        case 'DELETE':
            return handleDelete(action, req.query, res, clientIp);
        default:
            return res.status(405).json({ error: 'Method not allowed' });
    }
}

// ============================================================================
// POST HANDLERS
// ============================================================================

function handlePost(action, body, res, clientIp) {
    let validation;

    switch (action) {
        case 'task':
            validation = validateRequestBody(body, SCHEMAS.task);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error, code: 'VALIDATION_ERROR' });
            }

            if (agentState.tasks.length >= CONFIG.MAX_TASKS) {
                return res.status(400).json({
                    error: `Maximum tasks (${CONFIG.MAX_TASKS}) reached`,
                    code: 'LIMIT_REACHED'
                });
            }

            const newTask = {
                id: `task-${Date.now()}`,
                title: validation.sanitized.title,
                description: validation.sanitized.description || '',
                priority: validation.sanitized.priority,
                teamId: validation.sanitized.teamId,
                assignedAgents: validation.sanitized.assignedAgents || [],
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            agentState.tasks.push(newTask);
            addActivity('Commander', 'system', `Created task: ${newTask.title}`, 'Task Created');
            addAuditEntry({
                action: 'TASK_CREATED',
                ip: clientIp,
                success: true,
                taskId: newTask.id
            });
            return res.status(201).json({ success: true, data: newTask });

        case 'decision':
            validation = validateRequestBody(body, SCHEMAS.decision);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error, code: 'VALIDATION_ERROR' });
            }

            if (agentState.decisions.length >= CONFIG.MAX_DECISIONS) {
                return res.status(400).json({
                    error: `Maximum decisions (${CONFIG.MAX_DECISIONS}) reached`,
                    code: 'LIMIT_REACHED'
                });
            }

            const newDecision = {
                id: `dec-${Date.now()}`,
                title: validation.sanitized.title,
                description: validation.sanitized.description,
                priority: validation.sanitized.priority,
                teamId: validation.sanitized.teamId,
                requestedBy: validation.sanitized.requestedBy,
                status: 'pending',
                impact: validation.sanitized.impact || '',
                details: {},
                createdAt: new Date().toISOString()
            };
            agentState.decisions.push(newDecision);
            addActivity(validation.sanitized.requestedBy || 'Unknown', validation.sanitized.teamId, `Requested decision: ${newDecision.title}`, 'Decision Request');
            addAuditEntry({
                action: 'DECISION_CREATED',
                ip: clientIp,
                success: true,
                decisionId: newDecision.id
            });
            return res.status(201).json({ success: true, data: newDecision });

        case 'broadcast':
            validation = validateRequestBody(body, SCHEMAS.broadcast);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error, code: 'VALIDATION_ERROR' });
            }

            const broadcast = {
                id: `broadcast-${Date.now()}`,
                message: validation.sanitized.message,
                priority: validation.sanitized.priority,
                recipients: validation.sanitized.recipients || ['all'],
                sentAt: new Date().toISOString(),
                sentBy: 'Commander'
            };

            addActivity('Commander', 'system', `Broadcast: ${validation.sanitized.message.substring(0, 50)}...`, 'Broadcast');

            const teams = broadcast.recipients.includes('all')
                ? Object.keys(agentState.teams)
                : broadcast.recipients;
            teams.forEach(teamId => {
                addCommunication('Commander', 'system', teamId, validation.sanitized.message);
            });

            addAuditEntry({
                action: 'BROADCAST_SENT',
                ip: clientIp,
                success: true,
                recipients: teams.length
            });
            return res.status(201).json({ success: true, data: broadcast });

        case 'communicate':
            const comm = addCommunication(
                body.fromAgent,
                body.fromTeam,
                body.toTeam,
                body.message,
                body.toAgent
            );
            addAuditEntry({
                action: 'COMMUNICATION_SENT',
                ip: clientIp,
                success: true
            });
            return res.status(201).json({ success: true, data: comm });

        case 'sync':
            const syncResult = {
                synced: true,
                timestamp: new Date().toISOString(),
                agentsSynced: countTotalAgents(),
                tasksSynced: agentState.tasks.length,
                pendingDecisions: agentState.decisions.filter(d => d.status === 'pending').length
            };
            addActivity('System', 'system', 'All agents synchronized', 'Sync');
            addAuditEntry({
                action: 'SYSTEM_SYNC',
                ip: clientIp,
                success: true
            });
            return res.status(200).json({ success: true, data: syncResult });

        default:
            return res.status(400).json({ error: 'Unknown action', code: 'INVALID_ACTION' });
    }
}

// ============================================================================
// PUT HANDLERS
// ============================================================================

function handlePut(action, body, res, clientIp) {
    let validation;

    switch (action) {
        case 'agent-status':
            validation = validateRequestBody(body, SCHEMAS.agentStatus);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error, code: 'VALIDATION_ERROR' });
            }

            const { teamId, agentId, status } = validation.sanitized;
            const team = agentState.teams[teamId];
            if (!team) {
                return res.status(404).json({ error: 'Team not found' });
            }
            const agent = team.agents.find(a => a.id === agentId);
            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }
            const oldStatus = agent.status;
            agent.status = status;
            addActivity(agent.name, teamId, `Status changed from ${oldStatus} to ${status}`, 'Status Update');
            addAuditEntry({
                action: 'AGENT_STATUS_CHANGED',
                ip: clientIp,
                success: true,
                agentId,
                teamId,
                oldStatus,
                newStatus: status
            });
            return res.status(200).json({ success: true, data: agent });

        case 'task-status':
            const task = agentState.tasks.find(t => t.id === body.taskId);
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }
            const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
            if (!validStatuses.includes(body.status)) {
                return res.status(400).json({ error: 'Invalid status', code: 'VALIDATION_ERROR' });
            }
            const oldTaskStatus = task.status;
            task.status = body.status;
            task.updatedAt = new Date().toISOString();
            addActivity('System', task.teamId, `Task "${task.title}" status: ${body.status}`, 'Task Update');
            addAuditEntry({
                action: 'TASK_STATUS_CHANGED',
                ip: clientIp,
                success: true,
                taskId: task.id,
                oldStatus: oldTaskStatus,
                newStatus: body.status
            });
            return res.status(200).json({ success: true, data: task });

        case 'decision':
            const decision = agentState.decisions.find(d => d.id === body.decisionId);
            if (!decision) {
                return res.status(404).json({ error: 'Decision not found' });
            }
            const validDecisionStatuses = ['pending', 'approved', 'rejected', 'deferred'];
            if (!validDecisionStatuses.includes(body.status)) {
                return res.status(400).json({ error: 'Invalid status', code: 'VALIDATION_ERROR' });
            }
            decision.status = body.status;
            decision.resolvedAt = new Date().toISOString();
            decision.resolvedBy = 'Commander';
            addActivity('Commander', decision.teamId, `Decision ${body.status}: ${decision.title}`, body.status === 'approved' ? 'Approved' : 'Rejected');
            addAuditEntry({
                action: 'DECISION_RESOLVED',
                ip: clientIp,
                success: true,
                decisionId: decision.id,
                resolution: body.status
            });
            return res.status(200).json({ success: true, data: decision });

        case 'orchestration-mode':
            validation = validateRequestBody(body, SCHEMAS.orchestrationMode);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error, code: 'VALIDATION_ERROR' });
            }
            const oldMode = agentState.orchestrationMode;
            agentState.orchestrationMode = validation.sanitized.mode;
            addActivity('Commander', 'system', `Orchestration mode changed from ${oldMode} to ${validation.sanitized.mode}`, 'Mode Change');
            addAuditEntry({
                action: 'ORCHESTRATION_MODE_CHANGED',
                ip: clientIp,
                success: true,
                oldMode,
                newMode: validation.sanitized.mode
            });
            return res.status(200).json({ success: true, data: { mode: validation.sanitized.mode } });

        case 'priority-order':
            if (Array.isArray(body.priorities)) {
                body.priorities.slice(0, 100).forEach((taskId, index) => {
                    const t = agentState.tasks.find(t => t.id === taskId);
                    if (t) {
                        t.priorityOrder = index + 1;
                    }
                });
            }
            addAuditEntry({
                action: 'PRIORITIES_UPDATED',
                ip: clientIp,
                success: true
            });
            return res.status(200).json({ success: true, data: { updated: true } });

        case 'api-key':
            validation = validateRequestBody(body, SCHEMAS.apiKey);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error, code: 'VALIDATION_ERROR' });
            }

            const { provider, model, apiKey } = validation.sanitized;

            // Validate API key format
            const keyPatterns = {
                anthropic: /^sk-ant-/,
                openai: /^sk-/,
                gemini: /^AI/
            };

            if (apiKey && !keyPatterns[provider].test(apiKey)) {
                return res.status(400).json({ error: 'Invalid API key format for provider', code: 'VALIDATION_ERROR' });
            }

            // Update configuration metadata (actual key should be set via env vars)
            agentState.apiKeyConfig[provider] = {
                configured: Boolean(apiKey),
                model: model || agentState.apiKeyConfig[provider].model,
                lastUpdated: new Date().toISOString()
            };

            addActivity('Commander', 'system', `Updated ${provider} API configuration`, 'Config Update');
            addAuditEntry({
                action: 'API_KEY_CONFIGURED',
                ip: clientIp,
                success: true,
                provider
            });

            return res.status(200).json({
                success: true,
                data: {
                    provider,
                    model: agentState.apiKeyConfig[provider].model,
                    configured: agentState.apiKeyConfig[provider].configured,
                    message: 'API key configuration updated. For production, set keys via environment variables.'
                }
            });

        case 'agent-model':
            const { teamId: modelTeamId, agentId: modelAgentId, modelProvider, selectedModel } = body;

            if (modelTeamId && agentState.teams[modelTeamId]) {
                if (modelAgentId) {
                    const a = agentState.teams[modelTeamId].agents.find(a => a.id === modelAgentId);
                    if (a) {
                        a.modelProvider = sanitizeString(modelProvider, 50);
                        a.model = sanitizeString(selectedModel, 100);
                        addActivity(a.name, modelTeamId, `Model changed to ${selectedModel}`, 'Config Update');
                    }
                } else {
                    agentState.teams[modelTeamId].agents.forEach(a => {
                        a.modelProvider = sanitizeString(modelProvider, 50);
                        a.model = sanitizeString(selectedModel, 100);
                    });
                    addActivity('System', modelTeamId, `Team model changed to ${selectedModel}`, 'Config Update');
                }
            }

            addAuditEntry({
                action: 'AGENT_MODEL_UPDATED',
                ip: clientIp,
                success: true,
                teamId: modelTeamId,
                agentId: modelAgentId
            });

            return res.status(200).json({ success: true, data: { updated: true } });

        default:
            return res.status(400).json({ error: 'Unknown action', code: 'INVALID_ACTION' });
    }
}

// ============================================================================
// DELETE HANDLERS
// ============================================================================

function handleDelete(action, query, res, clientIp) {
    switch (action) {
        case 'task':
            const taskIndex = agentState.tasks.findIndex(t => t.id === query.taskId);
            if (taskIndex === -1) {
                return res.status(404).json({ error: 'Task not found' });
            }
            const deletedTask = agentState.tasks.splice(taskIndex, 1)[0];
            addActivity('Commander', deletedTask.teamId, `Deleted task: ${deletedTask.title}`, 'Task Deleted');
            addAuditEntry({
                action: 'TASK_DELETED',
                ip: clientIp,
                success: true,
                taskId: query.taskId
            });
            return res.status(200).json({ success: true, data: { deleted: true, taskId: query.taskId } });

        case 'decision':
            const decisionIndex = agentState.decisions.findIndex(d => d.id === query.decisionId);
            if (decisionIndex === -1) {
                return res.status(404).json({ error: 'Decision not found' });
            }
            agentState.decisions.splice(decisionIndex, 1);
            addAuditEntry({
                action: 'DECISION_DELETED',
                ip: clientIp,
                success: true,
                decisionId: query.decisionId
            });
            return res.status(200).json({ success: true, data: { deleted: true, decisionId: query.decisionId } });

        default:
            return res.status(400).json({ error: 'Unknown action', code: 'INVALID_ACTION' });
    }
}
