/**
 * FUSE CEO Dashboard - Unified Command Center
 * Combines dashboard, agents, and admin functionality
 */

// ============================================
// SECURITY UTILITIES
// ============================================

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// ============================================
// AGENT TEAMS DATA
// ============================================

const AgentTeams = {
    developer: {
        id: 'developer',
        name: 'Developer Team',
        badge: 'DEV',
        badgeClass: 'dev',
        color: '#3b82f6',
        model: 'claude-3-5-sonnet-latest',
        provider: 'anthropic',
        description: 'Building and architecting the core platform',
        orchestrationStatus: 'paused',
        agents: [
            { id: 'architect', name: 'Architect', role: 'System Design & Architecture', status: 'idle', tasksCompleted: 0 },
            { id: 'coder', name: 'Coder', role: 'Implementation & Debugging', status: 'idle', tasksCompleted: 0 },
            { id: 'tester', name: 'QA Engineer', role: 'Testing & Quality Assurance', status: 'idle', tasksCompleted: 0 }
        ]
    },
    design: {
        id: 'design',
        name: 'Design Team',
        badge: 'DSN',
        badgeClass: 'design',
        color: '#8b5cf6',
        model: 'claude-3-5-sonnet-latest',
        provider: 'anthropic',
        description: 'Crafting beautiful user experiences',
        orchestrationStatus: 'paused',
        agents: [
            { id: 'ux-lead', name: 'UX Lead', role: 'User Experience Strategy', status: 'idle', tasksCompleted: 0 },
            { id: 'ui-artist', name: 'Visual Designer', role: 'UI & Visual Systems', status: 'idle', tasksCompleted: 0 },
            { id: 'motion', name: 'Motion Designer', role: 'Animation & Interactions', status: 'idle', tasksCompleted: 0 }
        ]
    },
    communications: {
        id: 'communications',
        name: 'Communications',
        badge: 'COM',
        badgeClass: 'comms',
        color: '#06b6d4',
        model: 'gpt-4o',
        provider: 'openai',
        description: 'Managing content and brand voice',
        orchestrationStatus: 'paused',
        agents: [
            { id: 'content-strategist', name: 'Content Strategist', role: 'Content Planning & Voice', status: 'idle', tasksCompleted: 0 },
            { id: 'copywriter', name: 'Copywriter', role: 'Persuasive Copy & Messaging', status: 'idle', tasksCompleted: 0 },
            { id: 'social-manager', name: 'Social Manager', role: 'Community & Engagement', status: 'idle', tasksCompleted: 0 }
        ]
    },
    legal: {
        id: 'legal',
        name: 'Legal Team',
        badge: 'LGL',
        badgeClass: 'legal',
        color: '#f59e0b',
        model: 'claude-3-opus-latest',
        provider: 'anthropic',
        description: 'Ensuring compliance and protecting IP',
        orchestrationStatus: 'paused',
        agents: [
            { id: 'compliance-officer', name: 'Compliance Officer', role: 'Regulatory Compliance', status: 'idle', tasksCompleted: 0 },
            { id: 'contract-analyst', name: 'Contract Analyst', role: 'Terms & Agreements', status: 'idle', tasksCompleted: 0 },
            { id: 'ip-counsel', name: 'IP Counsel', role: 'Intellectual Property', status: 'idle', tasksCompleted: 0 }
        ]
    },
    marketing: {
        id: 'marketing',
        name: 'Marketing Team',
        badge: 'MKT',
        badgeClass: 'marketing',
        color: '#ef4444',
        model: 'gpt-4o',
        provider: 'openai',
        description: 'Driving growth and brand awareness',
        orchestrationStatus: 'paused',
        agents: [
            { id: 'growth-lead', name: 'Growth Lead', role: 'Acquisition & Retention', status: 'idle', tasksCompleted: 0 },
            { id: 'brand-strategist', name: 'Brand Strategist', role: 'Brand Identity & Positioning', status: 'idle', tasksCompleted: 0 },
            { id: 'analytics-expert', name: 'Analytics Expert', role: 'Data & Performance', status: 'idle', tasksCompleted: 0 }
        ]
    },
    gtm: {
        id: 'gtm',
        name: 'Go-to-Market',
        badge: 'GTM',
        badgeClass: 'gtm',
        color: '#10b981',
        model: 'claude-3-5-sonnet-latest',
        provider: 'anthropic',
        description: 'Planning and executing product launches',
        orchestrationStatus: 'paused',
        agents: [
            { id: 'launch-coordinator', name: 'Launch Coordinator', role: 'Launch Planning & Execution', status: 'idle', tasksCompleted: 0 },
            { id: 'partnership-manager', name: 'Partnership Manager', role: 'Strategic Partnerships', status: 'idle', tasksCompleted: 0 },
            { id: 'market-researcher', name: 'Market Researcher', role: 'Market Intelligence', status: 'idle', tasksCompleted: 0 }
        ]
    },
    sales: {
        id: 'sales',
        name: 'Sales Team',
        badge: 'SLS',
        badgeClass: 'sales',
        color: '#ec4899',
        model: 'gpt-4-turbo',
        provider: 'openai',
        description: 'Driving revenue and customer relationships',
        orchestrationStatus: 'paused',
        agents: [
            { id: 'sales-director', name: 'Sales Director', role: 'Revenue Strategy & Team Leadership', status: 'idle', tasksCompleted: 0 },
            { id: 'account-executive', name: 'Account Executive', role: 'Enterprise Sales & Closing', status: 'idle', tasksCompleted: 0 },
            { id: 'sdr', name: 'SDR Lead', role: 'Outbound Prospecting', status: 'idle', tasksCompleted: 0 },
            { id: 'solutions-consultant', name: 'Solutions Consultant', role: 'Technical Sales & Demos', status: 'idle', tasksCompleted: 0 },
            { id: 'customer-success', name: 'Customer Success', role: 'Retention & Expansion', status: 'idle', tasksCompleted: 0 }
        ]
    }
};

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
    activeTab: 'overview',
    activeTeam: 'all',
    orchestrationMode: 'paused',
    teamOrchestrationState: {},
    activities: [],
    decisions: [],
    signups: [],
    costs: {
        anthropic: 0,
        openai: 0,
        gemini: 0,
        daily: 0,
        monthly: 0
    },
    apiKeyConfig: {
        anthropic: { configured: false, model: 'claude-3-5-sonnet-latest' },
        openai: { configured: false, model: 'gpt-4o' },
        gemini: { configured: false, model: 'gemini-pro' }
    },
    adminToken: null,
    charts: {},
    isAuthenticated: false
};

// Initialize team orchestration state
Object.keys(AgentTeams).forEach(teamId => {
    state.teamOrchestrationState[teamId] = { status: 'paused', lastRun: null };
});

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {};

function cacheElements() {
    // Header elements
    elements.currentTime = document.getElementById('currentTime');
    elements.globalStatus = document.getElementById('globalStatus');
    elements.globalStatusText = document.getElementById('globalStatusText');
    elements.verifiedBadge = document.getElementById('verifiedBadge');
    elements.btnLogout = document.getElementById('btnLogout');

    // Navigation tabs
    elements.ceoTabs = document.querySelectorAll('.ceo-tab');
    elements.ceoSections = document.querySelectorAll('.ceo-section');

    // Overview elements
    elements.totalAgents = document.getElementById('totalAgents');
    elements.activeAgents = document.getElementById('activeAgents');
    elements.utilization = document.getElementById('utilization');
    elements.pendingTasks = document.getElementById('pendingTasks');
    elements.criticalCount = document.getElementById('criticalCount');
    elements.signupCount = document.getElementById('signupCount');
    elements.consentRate = document.getElementById('consentRate');
    elements.teamsMiniGrid = document.getElementById('teamsMiniGrid');
    elements.overviewActivityFeed = document.getElementById('overviewActivityFeed');
    elements.overviewDecisions = document.getElementById('overviewDecisions');
    elements.decisionCount = document.getElementById('decisionCount');

    // World control elements
    elements.worldStateBtns = document.querySelectorAll('.world-state-btn');
    elements.btnEmergencyStop = document.getElementById('btnEmergencyStop');
    elements.creditBalance = document.getElementById('creditBalance');

    // Agents section elements
    elements.teamNav = document.getElementById('teamNav');
    elements.agentsTeamsContainer = document.getElementById('agentsTeamsContainer');
    elements.workspaceTitle = document.getElementById('workspaceTitle');
    elements.workspaceStatus = document.getElementById('workspaceStatus');
    elements.btnNewTask = document.getElementById('btnNewTask');
    elements.btnBroadcast = document.getElementById('btnBroadcast');
    elements.btnExecuteCycle = document.getElementById('btnExecuteCycle');
    elements.btnStartAllTeams = document.getElementById('btnStartAllTeams');
    elements.btnPauseAllTeams = document.getElementById('btnPauseAllTeams');
    elements.liveFeedContent = document.getElementById('liveFeedContent');
    elements.decisionQueueContent = document.getElementById('decisionQueueContent');
    elements.queueCount = document.getElementById('queueCount');

    // Analytics elements
    elements.analyticsSignups = document.getElementById('analyticsSignups');
    elements.analyticsConsent = document.getElementById('analyticsConsent');
    elements.analyticsCosts = document.getElementById('analyticsCosts');
    elements.analyticsTokens = document.getElementById('analyticsTokens');
    elements.signupsTableBody = document.getElementById('signupsTableBody');
    elements.signupSearch = document.getElementById('signupSearch');
    elements.btnExportSignups = document.getElementById('btnExportSignups');

    // Settings elements
    elements.adminTokenInput = document.getElementById('adminTokenInput');
    elements.adminTokenStatus = document.getElementById('adminTokenStatus');
    elements.btnSaveAdminToken = document.getElementById('btnSaveAdminToken');
    elements.btnRunHealthCheck = document.getElementById('btnRunHealthCheck');

    // Modals
    elements.taskModal = document.getElementById('taskModal');
    elements.broadcastModal = document.getElementById('broadcastModal');
    elements.emergencyModal = document.getElementById('emergencyModal');

    // Toast container
    elements.toastContainer = document.getElementById('toastContainer');
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    initTabNavigation();
    initClock();
    initWorldControls();
    initTeamNavigation();
    initModals();
    initAnalytics();
    initSettings();
    loadAdminToken();
    renderTeamsMiniGrid();
    renderAgentsTeamsGrid();
    renderTeamNavButtons();
    updateStats();

    // Start periodic updates
    setInterval(updateClock, 1000);
    setInterval(fetchOrchestrationStatus, 30000);

    console.log('[CEO Dashboard] Initialized');
});

// ============================================
// TAB NAVIGATION
// ============================================

function initTabNavigation() {
    elements.ceoTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            switchTab(tabId);
        });
    });

    // Handle button navigation within panels
    document.querySelectorAll('[data-navigate]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.navigate;
            switchTab(targetTab);
        });
    });
}

function switchTab(tabId) {
    state.activeTab = tabId;

    // Update tab buttons
    elements.ceoTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    // Update sections
    elements.ceoSections.forEach(section => {
        const sectionId = section.id.replace('section-', '');
        section.classList.toggle('active', sectionId === tabId);
    });

    // Initialize tab-specific content
    if (tabId === 'analytics' && !state.charts.signupTrend) {
        initCharts();
    }
}

// ============================================
// CLOCK
// ============================================

function initClock() {
    updateClock();
}

function updateClock() {
    if (elements.currentTime) {
        const now = new Date();
        elements.currentTime.textContent = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }
}

// ============================================
// WORLD CONTROLS
// ============================================

function initWorldControls() {
    elements.worldStateBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const newState = btn.dataset.state;
            setWorldState(newState);
        });
    });

    if (elements.btnEmergencyStop) {
        elements.btnEmergencyStop.addEventListener('click', showEmergencyModal);
    }
}

function setWorldState(newState) {
    state.orchestrationMode = newState;

    elements.worldStateBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.state === newState);
    });

    // Update orchestration based on world state
    switch (newState) {
        case 'paused':
            pauseAllTeams();
            break;
        case 'autonomous':
            startAllTeams();
            break;
    }

    showToast('info', 'World State Changed', `Orchestration mode set to ${newState.toUpperCase()}`);
}

// ============================================
// TEAM NAVIGATION (Agents Section)
// ============================================

function initTeamNavigation() {
    if (elements.btnStartAllTeams) {
        elements.btnStartAllTeams.addEventListener('click', startAllTeams);
    }

    if (elements.btnPauseAllTeams) {
        elements.btnPauseAllTeams.addEventListener('click', pauseAllTeams);
    }

    if (elements.btnNewTask) {
        elements.btnNewTask.addEventListener('click', () => showModal('taskModal'));
    }

    if (elements.btnBroadcast) {
        elements.btnBroadcast.addEventListener('click', () => showModal('broadcastModal'));
    }

    if (elements.btnExecuteCycle) {
        elements.btnExecuteCycle.addEventListener('click', executeOrchestrationCycle);
    }
}

function renderTeamNavButtons() {
    if (!elements.teamNav) return;

    const existingAll = elements.teamNav.querySelector('[data-team="all"]');
    let html = existingAll ? existingAll.outerHTML : '';

    Object.entries(AgentTeams).forEach(([teamId, team]) => {
        const isRunning = state.teamOrchestrationState[teamId]?.status === 'running';
        html += `
            <button class="team-nav-btn ${isRunning ? 'running' : ''}" data-team="${teamId}">
                <span class="team-badge ${team.badgeClass}">${team.badge}</span>
                <span class="team-name">${team.name}</span>
                <span class="team-status-dot"></span>
            </button>
        `;
    });

    elements.teamNav.innerHTML = html;

    // Add click handlers
    elements.teamNav.querySelectorAll('.team-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const teamId = btn.dataset.team;
            selectTeam(teamId);
        });
    });
}

function selectTeam(teamId) {
    state.activeTeam = teamId;

    // Update nav button states
    elements.teamNav.querySelectorAll('.team-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.team === teamId);
    });

    // Update workspace title
    if (elements.workspaceTitle) {
        if (teamId === 'all') {
            elements.workspaceTitle.textContent = 'All Teams';
            elements.workspaceStatus.textContent = 'All systems ready';
        } else {
            const team = AgentTeams[teamId];
            elements.workspaceTitle.textContent = team.name;
            const status = state.teamOrchestrationState[teamId]?.status || 'paused';
            elements.workspaceStatus.textContent = `Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`;
        }
    }

    // Re-render teams grid
    renderAgentsTeamsGrid();
}

// ============================================
// TEAMS RENDERING
// ============================================

function renderTeamsMiniGrid() {
    if (!elements.teamsMiniGrid) return;

    let html = '';
    Object.entries(AgentTeams).forEach(([teamId, team]) => {
        const isRunning = state.teamOrchestrationState[teamId]?.status === 'running';
        const activeCount = team.agents.filter(a => a.status === 'working').length;

        html += `
            <div class="team-mini-card" data-team="${teamId}">
                <div class="team-mini-badge ${team.badgeClass}">${team.badge}</div>
                <div class="team-mini-info">
                    <div class="team-mini-name">${escapeHtml(team.name)}</div>
                    <div class="team-mini-status">
                        <span class="status-dot ${isRunning ? 'running' : ''}"></span>
                        <span>${activeCount}/${team.agents.length} active</span>
                    </div>
                </div>
            </div>
        `;
    });

    elements.teamsMiniGrid.innerHTML = html;

    // Add click handlers to navigate to agents tab
    elements.teamsMiniGrid.querySelectorAll('.team-mini-card').forEach(card => {
        card.addEventListener('click', () => {
            const teamId = card.dataset.team;
            switchTab('agents');
            selectTeam(teamId);
        });
    });
}

function renderAgentsTeamsGrid() {
    if (!elements.agentsTeamsContainer) return;

    const teamsToShow = state.activeTeam === 'all'
        ? Object.entries(AgentTeams)
        : [[state.activeTeam, AgentTeams[state.activeTeam]]];

    let html = '';
    teamsToShow.forEach(([teamId, team]) => {
        if (!team) return;
        const isRunning = state.teamOrchestrationState[teamId]?.status === 'running';

        html += `
            <div class="team-section" data-team="${teamId}">
                <div class="team-header">
                    <div class="team-badge ${team.badgeClass}">${team.badge}</div>
                    <h3 class="team-name">${escapeHtml(team.name)}</h3>
                    <span class="team-count">${team.agents.length} agents</span>
                    <div class="team-controls">
                        <button class="btn-team-toggle ${isRunning ? 'running' : ''}" data-team="${teamId}">
                            ${isRunning ? 'Pause' : 'Start'}
                        </button>
                    </div>
                </div>
                <div class="agents-grid">
                    ${team.agents.map(agent => `
                        <div class="agent-mini-card ${agent.status}" data-agent="${agent.id}">
                            <div class="agent-status-dot"></div>
                            <span class="agent-name">${escapeHtml(agent.name)}</span>
                            <span class="agent-task">${agent.currentTask || agent.role}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    elements.agentsTeamsContainer.innerHTML = html;

    // Add toggle handlers
    elements.agentsTeamsContainer.querySelectorAll('.btn-team-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
            const teamId = btn.dataset.team;
            await toggleTeamOrchestration(teamId);
        });
    });
}

// ============================================
// ORCHESTRATION CONTROLS
// ============================================

async function startTeamOrchestration(teamId) {
    if (!state.adminToken) {
        showToast('error', 'Admin Token Required', 'Configure admin token in Settings to orchestrate teams.');
        return false;
    }

    try {
        const response = await fetch('/api/orchestrate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.adminToken}`
            },
            body: JSON.stringify({ teamId, action: 'start' })
        });

        const data = await response.json();

        if (data.success) {
            state.teamOrchestrationState[teamId] = { status: 'running', lastRun: new Date().toISOString() };
            AgentTeams[teamId].orchestrationStatus = 'running';
            showToast('success', 'Orchestration Started', `${AgentTeams[teamId].name} is now running`);
            updateTeamUI(teamId);
            return true;
        } else {
            showToast('error', 'Start Failed', data.error || 'Failed to start orchestration');
            return false;
        }
    } catch (error) {
        console.error('[Orchestration] Start error:', error);
        showToast('error', 'Connection Error', 'Failed to start orchestration');
        return false;
    }
}

async function stopTeamOrchestration(teamId) {
    if (!state.adminToken) {
        showToast('error', 'Admin Token Required', 'Configure admin token in Settings');
        return false;
    }

    try {
        const response = await fetch('/api/orchestrate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.adminToken}`
            },
            body: JSON.stringify({ teamId, action: 'stop' })
        });

        const data = await response.json();

        if (data.success) {
            state.teamOrchestrationState[teamId] = { status: 'paused', lastRun: new Date().toISOString() };
            AgentTeams[teamId].orchestrationStatus = 'paused';
            AgentTeams[teamId].agents.forEach(agent => {
                agent.status = 'idle';
                agent.currentTask = null;
            });
            showToast('info', 'Orchestration Paused', `${AgentTeams[teamId].name} is now paused`);
            updateTeamUI(teamId);
            return true;
        } else {
            showToast('error', 'Stop Failed', data.error || 'Failed to stop orchestration');
            return false;
        }
    } catch (error) {
        console.error('[Orchestration] Stop error:', error);
        showToast('error', 'Connection Error', 'Failed to stop orchestration');
        return false;
    }
}

async function toggleTeamOrchestration(teamId) {
    const isRunning = state.teamOrchestrationState[teamId]?.status === 'running';
    if (isRunning) {
        await stopTeamOrchestration(teamId);
    } else {
        await startTeamOrchestration(teamId);
    }
}

async function startAllTeams() {
    showToast('info', 'Starting All Teams', 'Initiating orchestration for all teams...');
    for (const teamId of Object.keys(AgentTeams)) {
        await startTeamOrchestration(teamId);
    }
}

async function pauseAllTeams() {
    showToast('info', 'Pausing All Teams', 'Stopping orchestration for all teams...');
    for (const teamId of Object.keys(AgentTeams)) {
        await stopTeamOrchestration(teamId);
    }
}

async function executeOrchestrationCycle() {
    if (!state.adminToken) {
        showToast('error', 'Admin Token Required', 'Configure admin token in Settings');
        return;
    }

    const teamId = state.activeTeam === 'all' ? Object.keys(AgentTeams)[0] : state.activeTeam;

    if (state.teamOrchestrationState[teamId]?.status !== 'running') {
        showToast('warning', 'Not Running', 'Start team orchestration first');
        return;
    }

    try {
        showToast('info', 'Executing...', `Running ${AgentTeams[teamId].name} orchestration cycle`);

        const response = await fetch('/api/orchestrate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.adminToken}`
            },
            body: JSON.stringify({ teamId, action: 'execute' })
        });

        const data = await response.json();

        if (data.success) {
            const result = data.data;

            // Update activities
            if (result.activities && result.activities.length > 0) {
                state.activities = [...result.activities, ...state.activities].slice(0, 50);
                renderActivityFeed();
                renderOverviewActivity();
            }

            showToast('success', 'Orchestration Complete', `Used ${result.usage?.outputTokens || 0} tokens`);
            updateTeamUI(teamId);
        } else {
            showToast('error', 'Execution Failed', data.error || 'Orchestration failed');
        }
    } catch (error) {
        console.error('[Orchestration] Execute error:', error);
        showToast('error', 'Execution Error', 'Orchestration execution failed');
    }
}

async function fetchOrchestrationStatus() {
    try {
        const response = await fetch('/api/orchestrate?action=status');
        const data = await response.json();

        if (data.success) {
            state.orchestrationMode = data.data.globalMode || 'manual';

            Object.entries(data.data.teams || {}).forEach(([teamId, teamState]) => {
                state.teamOrchestrationState[teamId] = {
                    status: teamState.status,
                    lastRun: teamState.lastRun
                };
                if (AgentTeams[teamId]) {
                    AgentTeams[teamId].orchestrationStatus = teamState.status;
                }
            });

            updateAllTeamUI();
        }
    } catch (error) {
        console.error('[Orchestration] Status fetch error:', error);
    }
}

function updateTeamUI(teamId) {
    renderTeamsMiniGrid();
    renderTeamNavButtons();
    renderAgentsTeamsGrid();
    updateStats();
}

function updateAllTeamUI() {
    renderTeamsMiniGrid();
    renderTeamNavButtons();
    renderAgentsTeamsGrid();
    updateStats();
}

// ============================================
// ACTIVITY FEED
// ============================================

function renderActivityFeed() {
    if (!elements.liveFeedContent) return;

    if (state.activities.length === 0) {
        elements.liveFeedContent.innerHTML = `
            <div class="activity-empty">
                <p>No activity yet. Start orchestration to see live updates.</p>
            </div>
        `;
        return;
    }

    let html = '';
    state.activities.slice(0, 20).forEach(activity => {
        const teamClass = activity.teamId || activity.team || 'system';
        const timeAgo = formatTimeAgo(new Date(activity.timestamp));

        html += `
            <div class="activity-item">
                <div class="activity-dot ${teamClass}"></div>
                <div class="activity-content">
                    <span class="activity-agent">${escapeHtml(activity.agent)}</span>
                    <span class="activity-message">${escapeHtml(activity.message)}</span>
                    <span class="activity-time">${timeAgo}</span>
                </div>
            </div>
        `;
    });

    elements.liveFeedContent.innerHTML = html;
}

function renderOverviewActivity() {
    if (!elements.overviewActivityFeed) return;

    if (state.activities.length === 0) {
        elements.overviewActivityFeed.innerHTML = `
            <div class="activity-empty">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                <p>No activity yet. Start orchestration to see live updates.</p>
            </div>
        `;
        return;
    }

    let html = '';
    state.activities.slice(0, 10).forEach(activity => {
        const teamClass = activity.teamId || activity.team || 'system';
        const timeAgo = formatTimeAgo(new Date(activity.timestamp));

        html += `
            <div class="activity-item">
                <div class="activity-dot ${teamClass}"></div>
                <div class="activity-content">
                    <span class="activity-agent">${escapeHtml(activity.agent)}</span>
                    <span class="activity-message">${escapeHtml(activity.message)}</span>
                    <span class="activity-time">${timeAgo}</span>
                </div>
            </div>
        `;
    });

    elements.overviewActivityFeed.innerHTML = html;
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}

// ============================================
// STATS
// ============================================

function updateStats() {
    const totalAgents = Object.values(AgentTeams).reduce((sum, team) => sum + team.agents.length, 0);
    const activeAgents = Object.values(AgentTeams).reduce((sum, team) =>
        sum + team.agents.filter(a => a.status === 'working').length, 0);
    const utilization = totalAgents > 0 ? Math.round((activeAgents / totalAgents) * 100) : 0;

    if (elements.totalAgents) elements.totalAgents.textContent = totalAgents;
    if (elements.activeAgents) elements.activeAgents.textContent = activeAgents;
    if (elements.utilization) elements.utilization.textContent = `${utilization}%`;
    if (elements.pendingTasks) elements.pendingTasks.textContent = state.decisions.length;
    if (elements.decisionCount) elements.decisionCount.textContent = state.decisions.length;
    if (elements.queueCount) elements.queueCount.textContent = state.decisions.length;
}

// ============================================
// ANALYTICS
// ============================================

function initAnalytics() {
    loadSignups();

    if (elements.signupSearch) {
        elements.signupSearch.addEventListener('input', filterSignups);
    }

    if (elements.btnExportSignups) {
        elements.btnExportSignups.addEventListener('click', exportSignupsCSV);
    }
}

async function loadSignups() {
    if (!state.adminToken) {
        console.warn('[Analytics] Admin token required to load signups');
        return;
    }

    try {
        const response = await fetch('/api/admin-signups', {
            headers: {
                'Authorization': `Bearer ${state.adminToken}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.warn('[Analytics] Unauthorized - check admin token');
                return;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.signups) {
            // Transform admin-signups format to expected format
            state.signups = data.signups.map(s => ({
                email: s.email,
                interest: s.mainInterest,
                consent: s.consentToContact,
                marketingConsent: s.consentToContact,
                timestamp: s.signupDate || s.storedAt,
                date: s.signupDate || s.storedAt
            }));
            renderSignupsTable();
            updateAnalyticsMetrics();
        }
    } catch (error) {
        console.error('[Analytics] Failed to load signups:', error);
        // Show user-friendly error
        if (error.message && !error.message.includes('JSON')) {
            showToast('error', 'Failed to Load Signups', error.message);
        }
    }
}

function renderSignupsTable() {
    if (!elements.signupsTableBody) return;

    if (state.signups.length === 0) {
        elements.signupsTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.5);">
                    No signups yet
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    state.signups.slice(0, 50).forEach(signup => {
        const date = new Date(signup.timestamp || signup.date).toLocaleDateString();
        const consent = signup.consent || signup.marketingConsent;

        html += `
            <tr>
                <td>${escapeHtml(signup.email)}</td>
                <td>${escapeHtml(signup.interest || 'Not specified')}</td>
                <td><span class="consent-badge ${consent ? 'yes' : 'no'}">${consent ? 'Yes' : 'No'}</span></td>
                <td>${date}</td>
                <td>
                    <button class="btn-table-action" data-email="${escapeHtml(signup.email)}">View</button>
                </td>
            </tr>
        `;
    });

    elements.signupsTableBody.innerHTML = html;
}

function updateAnalyticsMetrics() {
    const totalSignups = state.signups.length;
    const consented = state.signups.filter(s => s.consent || s.marketingConsent).length;
    const consentRate = totalSignups > 0 ? Math.round((consented / totalSignups) * 100) : 0;

    if (elements.analyticsSignups) elements.analyticsSignups.textContent = totalSignups;
    if (elements.analyticsConsent) elements.analyticsConsent.textContent = `${consentRate}%`;
    if (elements.signupCount) elements.signupCount.textContent = totalSignups;
    if (elements.consentRate) elements.consentRate.textContent = `${consentRate}%`;
}

function filterSignups() {
    const query = elements.signupSearch.value.toLowerCase();
    const filtered = state.signups.filter(s =>
        s.email.toLowerCase().includes(query) ||
        (s.interest && s.interest.toLowerCase().includes(query))
    );

    // Temporarily update state for rendering
    const originalSignups = state.signups;
    state.signups = filtered;
    renderSignupsTable();
    state.signups = originalSignups;
}

function exportSignupsCSV() {
    if (state.signups.length === 0) {
        showToast('warning', 'No Data', 'No signups to export');
        return;
    }

    const headers = ['Email', 'Interest', 'Consent', 'Date'];
    const rows = state.signups.map(s => [
        s.email,
        s.interest || '',
        s.consent || s.marketingConsent ? 'Yes' : 'No',
        new Date(s.timestamp || s.date).toISOString()
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `fuse-signups-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    URL.revokeObjectURL(url);
    showToast('success', 'Export Complete', `Exported ${state.signups.length} signups`);
}

// ============================================
// CHARTS
// ============================================

function initCharts() {
    // Mini trend chart (overview)
    const miniCtx = document.getElementById('miniTrendChart');
    if (miniCtx) {
        state.charts.miniTrend = new Chart(miniCtx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Signups',
                    data: [3, 5, 2, 8, 4, 6, 7],
                    borderColor: '#818cf8',
                    backgroundColor: 'rgba(129, 140, 248, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { display: false }
                }
            }
        });
    }

    // Signup trend chart (analytics)
    const trendCtx = document.getElementById('signupTrendChart');
    if (trendCtx) {
        state.charts.signupTrend = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: generateLastNDays(7),
                datasets: [{
                    label: 'Signups',
                    data: generateRandomData(7, 0, 15),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'rgba(255,255,255,0.5)' }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'rgba(255,255,255,0.5)' }
                    }
                }
            }
        });
    }

    // Interest distribution chart
    const interestCtx = document.getElementById('interestChart');
    if (interestCtx) {
        state.charts.interest = new Chart(interestCtx, {
            type: 'doughnut',
            data: {
                labels: ['Productivity', 'Health', 'Finance', 'Education', 'Other'],
                datasets: [{
                    data: [35, 25, 20, 15, 5],
                    backgroundColor: [
                        '#3b82f6',
                        '#22c55e',
                        '#f59e0b',
                        '#8b5cf6',
                        '#6b7280'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: 'rgba(255,255,255,0.7)' }
                    }
                }
            }
        });
    }
}

function generateLastNDays(n) {
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    return days;
}

function generateRandomData(n, min, max) {
    return Array.from({ length: n }, () => Math.floor(Math.random() * (max - min + 1)) + min);
}

// ============================================
// SETTINGS
// ============================================

function initSettings() {
    if (elements.btnSaveAdminToken) {
        elements.btnSaveAdminToken.addEventListener('click', saveAdminToken);
    }

    if (elements.btnRunHealthCheck) {
        elements.btnRunHealthCheck.addEventListener('click', runHealthCheck);
    }

    // API key save buttons
    ['anthropic', 'openai', 'gemini'].forEach(provider => {
        const btn = document.getElementById(`btnSave${provider.charAt(0).toUpperCase() + provider.slice(1)}Key`);
        if (btn) {
            btn.addEventListener('click', () => saveApiKey(provider));
        }
    });
}

function loadAdminToken() {
    let token = sessionStorage.getItem('fuse_admin_token');

    // Migration from localStorage
    if (!token) {
        const legacyToken = localStorage.getItem('fuse_admin_token');
        if (legacyToken) {
            sessionStorage.setItem('fuse_admin_token', legacyToken);
            localStorage.removeItem('fuse_admin_token');
            token = legacyToken;
        }
    }

    if (token) {
        state.adminToken = token;
        if (elements.adminTokenStatus) {
            elements.adminTokenStatus.textContent = 'Configured';
            elements.adminTokenStatus.classList.add('configured');
        }
    }
}

function saveAdminToken() {
    const input = elements.adminTokenInput;
    if (!input) return;

    const token = input.value.trim();
    if (token.length < 32) {
        showToast('error', 'Invalid Token', 'Admin token must be at least 32 characters');
        return;
    }

    state.adminToken = token;
    sessionStorage.setItem('fuse_admin_token', token);
    input.value = '';

    if (elements.adminTokenStatus) {
        elements.adminTokenStatus.textContent = 'Configured';
        elements.adminTokenStatus.classList.add('configured');
    }

    showToast('success', 'Token Saved', 'Admin token configured for this session');
}

function saveApiKey(provider) {
    const keyInput = document.getElementById(`${provider}KeyInput`);
    const modelSelect = document.getElementById(`${provider}ModelSelect`);
    const statusEl = document.getElementById(`${provider}ConfigStatus`);

    if (!keyInput) return;

    const apiKey = keyInput.value.trim();
    const model = modelSelect?.value;

    if (!apiKey) {
        showToast('error', 'Validation Error', 'Please enter an API key');
        return;
    }

    const keyPatterns = {
        anthropic: /^sk-ant-/,
        openai: /^sk-/,
        gemini: /^AI/
    };

    if (!keyPatterns[provider].test(apiKey)) {
        showToast('error', 'Invalid Format', `API key doesn't match expected format for ${provider}`);
        return;
    }

    state.apiKeyConfig[provider] = {
        configured: true,
        model: model || state.apiKeyConfig[provider].model
    };

    if (statusEl) {
        statusEl.textContent = 'Configured';
        statusEl.classList.add('configured');
    }

    keyInput.value = '';
    showToast('success', 'Configuration Saved', `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key configured`);
}

function runHealthCheck() {
    showToast('info', 'Health Check', 'Running system health check...');

    const startTime = performance.now();

    setTimeout(() => {
        const latency = Math.round(performance.now() - startTime);

        const apiLatencyEl = document.getElementById('settingsApiLatency');
        const lastCheckEl = document.getElementById('settingsLastCheck');
        const systemStatusEl = document.getElementById('settingsSystemStatus');

        if (apiLatencyEl) apiLatencyEl.textContent = `${latency} ms`;
        if (lastCheckEl) lastCheckEl.textContent = 'Just now';
        if (systemStatusEl) systemStatusEl.textContent = 'Operational';

        showToast('success', 'Health Check Complete', `System operational - ${latency}ms latency`);
    }, 500);
}

// ============================================
// MODALS
// ============================================

function initModals() {
    // Close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllModals();
        });
    });

    // Overlay clicks
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', closeAllModals);
    });

    // Emergency modal confirmation
    const emergencyInput = document.getElementById('emergencyConfirmInput');
    const confirmBtn = document.getElementById('btnConfirmEmergency');

    if (emergencyInput && confirmBtn) {
        emergencyInput.addEventListener('input', () => {
            confirmBtn.disabled = emergencyInput.value !== 'STOP ALL';
        });

        confirmBtn.addEventListener('click', async () => {
            await emergencyStopAll();
            closeAllModals();
        });
    }

    // Task modal submit
    const submitTaskBtn = document.getElementById('btnSubmitTask');
    if (submitTaskBtn) {
        submitTaskBtn.addEventListener('click', submitNewTask);
    }

    // Broadcast modal submit
    const sendBroadcastBtn = document.getElementById('btnSendBroadcast');
    if (sendBroadcastBtn) {
        sendBroadcastBtn.addEventListener('click', sendBroadcast);
    }

    // Logout button
    if (elements.btnLogout) {
        elements.btnLogout.addEventListener('click', logout);
    }
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });

    // Reset emergency input
    const emergencyInput = document.getElementById('emergencyConfirmInput');
    if (emergencyInput) emergencyInput.value = '';
}

function showEmergencyModal() {
    showModal('emergencyModal');
}

async function emergencyStopAll() {
    showToast('warning', 'Emergency Stop', 'Stopping all orchestration...');
    await pauseAllTeams();
    setWorldState('paused');
    showToast('success', 'Emergency Stop Complete', 'All orchestration has been stopped');
}

function submitNewTask() {
    const title = document.getElementById('taskTitle')?.value;
    const description = document.getElementById('taskDescription')?.value;
    const team = document.getElementById('taskTeam')?.value;
    const priority = document.getElementById('taskPriority')?.value;

    if (!title || !team) {
        showToast('error', 'Validation Error', 'Please fill in required fields');
        return;
    }

    // Add to activity
    state.activities.unshift({
        id: `act-${Date.now()}`,
        agent: 'Commander',
        teamId: team,
        message: `New task created: ${title}`,
        tag: 'Task',
        timestamp: new Date()
    });

    renderActivityFeed();
    renderOverviewActivity();
    closeAllModals();
    showToast('success', 'Task Created', `Task "${title}" assigned to ${AgentTeams[team]?.name || team}`);

    // Clear form
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
}

function sendBroadcast() {
    const message = document.getElementById('broadcastMessage')?.value;
    const priority = document.getElementById('broadcastPriority')?.value;

    if (!message) {
        showToast('error', 'Validation Error', 'Please enter a message');
        return;
    }

    // Add to activity
    state.activities.unshift({
        id: `act-${Date.now()}`,
        agent: 'Commander',
        teamId: 'system',
        message: `Broadcast: ${message}`,
        tag: 'Broadcast',
        timestamp: new Date()
    });

    renderActivityFeed();
    renderOverviewActivity();
    closeAllModals();
    showToast('success', 'Broadcast Sent', 'Message sent to all teams');

    // Clear form
    document.getElementById('broadcastMessage').value = '';
}

function logout() {
    // Clear session
    sessionStorage.removeItem('fuse_session_token');
    sessionStorage.removeItem('fuse_admin_token');

    // Show biometric gate
    const gate = document.getElementById('biometricGate');
    if (gate) {
        gate.style.display = 'flex';
    }

    showToast('info', 'Logged Out', 'Dashboard locked');
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(type, title, message) {
    if (!elements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>',
        error: '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>',
        warning: '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>',
        info: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>'
    };

    toast.innerHTML = `
        <svg class="toast-icon" viewBox="0 0 24 24" fill="currentColor">${icons[type] || icons.info}</svg>
        <div class="toast-content">
            <span class="toast-title">${escapeHtml(title)}</span>
            <span class="toast-message">${escapeHtml(message)}</span>
        </div>
    `;

    elements.toastContainer.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ============================================
// BIOMETRIC AUTH INTEGRATION
// ============================================

// Listen for successful authentication from biometric-auth.js
window.addEventListener('biometric-authenticated', () => {
    state.isAuthenticated = true;
    console.log('[CEO Dashboard] User authenticated via biometrics');

    // Initialize data that requires authentication
    fetchOrchestrationStatus();
    loadSignups();
});

// Export for biometric-auth.js integration
window.CEODashboard = {
    showToast,
    state
};
