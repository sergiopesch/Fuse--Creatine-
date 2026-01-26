/**
 * FUSE Agent Command Center API
 * Backend for managing AI agent teams and orchestration
 */

// Agent team data structure
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

// In-memory storage for demo (in production, use a database)
let agentState = {
    teams: { ...defaultAgentTeams },
    tasks: [],
    decisions: [],
    activities: [],
    communications: [],
    orchestrationMode: 'autonomous',
    // API Key configuration for agents (stored securely, only metadata exposed)
    apiKeyConfig: {
        anthropic: { configured: false, model: 'claude-3-5-haiku-latest', lastUpdated: null },
        openai: { configured: false, model: 'gpt-4-turbo', lastUpdated: null },
        gemini: { configured: false, model: 'gemini-pro', lastUpdated: null }
    },
    // Agent health metrics
    healthMetrics: {
        lastHealthCheck: null,
        systemLoad: 0,
        memoryUsage: 0,
        apiLatency: {}
    }
};

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

export default async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ ok: true });
    }

    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    const { method, query } = req;
    const action = query.action || 'status';

    try {
        switch (method) {
            case 'GET':
                return handleGet(action, query, res);
            case 'POST':
                return handlePost(action, req.body, res);
            case 'PUT':
                return handlePut(action, req.body, res);
            case 'DELETE':
                return handleDelete(action, query, res);
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Agent API Error:', error);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
}

// GET handlers
function handleGet(action, query, res) {
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
            // Detailed health check for monitoring
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
            // Return API key configuration status (never expose actual keys)
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
            // Return all agents
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
            const limit = parseInt(query.limit) || 20;
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

        default:
            return res.status(400).json({ error: 'Unknown action' });
    }
}

// POST handlers
function handlePost(action, body, res) {
    switch (action) {
        case 'task':
            const newTask = {
                id: `task-${Date.now()}`,
                title: body.title,
                description: body.description || '',
                priority: body.priority || 'medium',
                teamId: body.teamId,
                assignedAgents: body.assignedAgents || [],
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            agentState.tasks.push(newTask);
            addActivity('Commander', 'system', `Created task: ${newTask.title}`, 'Task Created');
            return res.status(201).json({ success: true, data: newTask });

        case 'decision':
            const newDecision = {
                id: `dec-${Date.now()}`,
                title: body.title,
                description: body.description,
                priority: body.priority || 'medium',
                teamId: body.teamId,
                requestedBy: body.requestedBy,
                status: 'pending',
                impact: body.impact || '',
                details: body.details || {},
                createdAt: new Date().toISOString()
            };
            agentState.decisions.push(newDecision);
            addActivity(body.requestedBy, body.teamId, `Requested decision: ${newDecision.title}`, 'Decision Request');
            return res.status(201).json({ success: true, data: newDecision });

        case 'broadcast':
            const broadcast = {
                id: `broadcast-${Date.now()}`,
                message: body.message,
                priority: body.priority || 'info',
                recipients: body.recipients || ['all'],
                sentAt: new Date().toISOString(),
                sentBy: 'Commander'
            };
            // Add to activities
            addActivity('Commander', 'system', `Broadcast: ${body.message.substring(0, 50)}...`, 'Broadcast');
            // Add communication logs
            const teams = body.recipients.includes('all')
                ? Object.keys(agentState.teams)
                : body.recipients;
            teams.forEach(teamId => {
                addCommunication('Commander', 'system', teamId, body.message);
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
            return res.status(201).json({ success: true, data: comm });

        case 'sync':
            // Sync all agents - simulate synchronization
            const syncResult = {
                synced: true,
                timestamp: new Date().toISOString(),
                agentsSynced: 18,
                tasksSynced: agentState.tasks.length,
                pendingDecisions: agentState.decisions.filter(d => d.status === 'pending').length
            };
            addActivity('System', 'system', 'All agents synchronized', 'Sync');
            return res.status(200).json({ success: true, data: syncResult });

        default:
            return res.status(400).json({ error: 'Unknown action' });
    }
}

// PUT handlers
function handlePut(action, body, res) {
    switch (action) {
        case 'agent-status':
            const { teamId, agentId, status } = body;
            const team = agentState.teams[teamId];
            if (!team) {
                return res.status(404).json({ error: 'Team not found' });
            }
            const agent = team.agents.find(a => a.id === agentId);
            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }
            agent.status = status;
            addActivity(agent.name, teamId, `Status changed to ${status}`, 'Status Update');
            return res.status(200).json({ success: true, data: agent });

        case 'task-status':
            const task = agentState.tasks.find(t => t.id === body.taskId);
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }
            task.status = body.status;
            task.updatedAt = new Date().toISOString();
            addActivity('System', task.teamId, `Task "${task.title}" status: ${body.status}`, 'Task Update');
            return res.status(200).json({ success: true, data: task });

        case 'decision':
            const decision = agentState.decisions.find(d => d.id === body.decisionId);
            if (!decision) {
                return res.status(404).json({ error: 'Decision not found' });
            }
            decision.status = body.status; // approved, rejected, deferred
            decision.resolvedAt = new Date().toISOString();
            decision.resolvedBy = 'Commander';
            addActivity('Commander', decision.teamId, `Decision ${body.status}: ${decision.title}`, body.status === 'approved' ? 'Approved' : 'Rejected');
            return res.status(200).json({ success: true, data: decision });

        case 'orchestration-mode':
            const validModes = ['autonomous', 'supervised', 'manual'];
            if (!validModes.includes(body.mode)) {
                return res.status(400).json({ error: 'Invalid orchestration mode' });
            }
            agentState.orchestrationMode = body.mode;
            addActivity('Commander', 'system', `Orchestration mode changed to ${body.mode}`, 'Mode Change');
            return res.status(200).json({ success: true, data: { mode: body.mode } });

        case 'priority-order':
            // Update task priorities
            if (Array.isArray(body.priorities)) {
                body.priorities.forEach((taskId, index) => {
                    const task = agentState.tasks.find(t => t.id === taskId);
                    if (task) {
                        task.priorityOrder = index + 1;
                    }
                });
            }
            return res.status(200).json({ success: true, data: { updated: true } });

        case 'api-key':
            // Update API key configuration (key is validated but never stored in memory)
            const { provider, model, apiKey } = body;
            const validProviders = ['anthropic', 'openai', 'gemini'];

            if (!validProviders.includes(provider)) {
                return res.status(400).json({ error: 'Invalid provider' });
            }

            // Validate API key format
            const keyPatterns = {
                anthropic: /^sk-ant-/,
                openai: /^sk-/,
                gemini: /^AI/
            };

            if (apiKey && !keyPatterns[provider].test(apiKey)) {
                return res.status(400).json({ error: 'Invalid API key format for provider' });
            }

            // Update configuration metadata (actual key should be set via env vars)
            agentState.apiKeyConfig[provider] = {
                configured: Boolean(apiKey),
                model: model || agentState.apiKeyConfig[provider].model,
                lastUpdated: new Date().toISOString()
            };

            addActivity('Commander', 'system', `Updated ${provider} API configuration`, 'Config Update');

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
            // Update which model a specific team uses
            const { teamId: modelTeamId, agentId: modelAgentId, modelProvider, selectedModel } = body;

            if (modelTeamId && agentState.teams[modelTeamId]) {
                if (modelAgentId) {
                    const agent = agentState.teams[modelTeamId].agents.find(a => a.id === modelAgentId);
                    if (agent) {
                        agent.modelProvider = modelProvider;
                        agent.model = selectedModel;
                        addActivity(agent.name, modelTeamId, `Model changed to ${selectedModel}`, 'Config Update');
                    }
                } else {
                    // Apply to all agents in team
                    agentState.teams[modelTeamId].agents.forEach(agent => {
                        agent.modelProvider = modelProvider;
                        agent.model = selectedModel;
                    });
                    addActivity('System', modelTeamId, `Team model changed to ${selectedModel}`, 'Config Update');
                }
            }

            return res.status(200).json({ success: true, data: { updated: true } });

        default:
            return res.status(400).json({ error: 'Unknown action' });
    }
}

// DELETE handlers
function handleDelete(action, query, res) {
    switch (action) {
        case 'task':
            const taskIndex = agentState.tasks.findIndex(t => t.id === query.taskId);
            if (taskIndex === -1) {
                return res.status(404).json({ error: 'Task not found' });
            }
            const deletedTask = agentState.tasks.splice(taskIndex, 1)[0];
            addActivity('Commander', deletedTask.teamId, `Deleted task: ${deletedTask.title}`, 'Task Deleted');
            return res.status(200).json({ success: true, data: { deleted: true, taskId: query.taskId } });

        case 'decision':
            const decisionIndex = agentState.decisions.findIndex(d => d.id === query.decisionId);
            if (decisionIndex === -1) {
                return res.status(404).json({ error: 'Decision not found' });
            }
            agentState.decisions.splice(decisionIndex, 1);
            return res.status(200).json({ success: true, data: { deleted: true, decisionId: query.decisionId } });

        default:
            return res.status(400).json({ error: 'Unknown action' });
    }
}

// Helper functions
function countTotalAgents() {
    let count = 0;
    Object.values(agentState.teams).forEach(team => {
        count += team.agents.length;
    });
    return count;
}

function countActiveAgents() {
    let count = 0;
    Object.values(agentState.teams).forEach(team => {
        count += team.agents.filter(a => a.status === 'working').length;
    });
    return count;
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
        agent,
        teamId,
        message,
        tag,
        timestamp: new Date().toISOString()
    };
    agentState.activities.unshift(activity);
    // Keep only last 100 activities
    if (agentState.activities.length > 100) {
        agentState.activities = agentState.activities.slice(0, 100);
    }
    return activity;
}

function addCommunication(fromAgent, fromTeam, toTeam, message, toAgent = null) {
    const comm = {
        id: `comm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from: { agent: fromAgent, teamId: fromTeam },
        to: { agent: toAgent || 'Team', teamId: toTeam },
        message,
        timestamp: new Date().toISOString()
    };
    agentState.communications.unshift(comm);
    // Keep only last 50 communications
    if (agentState.communications.length > 50) {
        agentState.communications = agentState.communications.slice(0, 50);
    }
    return comm;
}

function generateAnalytics() {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
        overview: {
            totalAgents: 18,
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
            efficiency: Math.round(85 + Math.random() * 15) // Simulated efficiency score
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
            averageResponseTime: '2.3s', // Simulated
            uptime: '99.9%'
        }
    };
}
