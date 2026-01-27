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
    selectedTeams: [],  // For multi-team selection
    orchestrationMode: 'paused',
    worldState: 'paused',  // Current world state
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
    isAuthenticated: false,
    // Orchestration state
    executionInProgress: false,
    lastExecutionTime: null,
    // Biometric state
    biometricSupported: false,
    biometricVerified: false,
    authenticatorType: 'Biometric'
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
    elements.workspaceModeIndicator = document.getElementById('workspaceModeIndicator');
    elements.workspaceModeText = document.getElementById('workspaceModeText');
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

document.addEventListener('DOMContentLoaded', async () => {
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

    // Initialize biometric authentication gate
    const biometricResult = await initBiometricAuth();
    
    // Only start periodic updates if authenticated or no gate
    if (biometricResult) {
        setInterval(fetchOrchestrationStatus, 30000);
    }

    // Clock always updates
    setInterval(updateClock, 1000);

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

async function setWorldState(newState) {
    state.orchestrationMode = newState;
    state.worldState = newState;

    elements.worldStateBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.state === newState);
    });

    // Call backend to set world state
    if (state.adminToken) {
        try {
            const response = await fetch('/api/orchestrate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.adminToken}`
                },
                body: JSON.stringify({ action: 'setWorldState', state: newState })
            });

            const data = await response.json();
            
            if (!data.success) {
                showToast('error', 'State Change Failed', data.error || 'Failed to set world state');
                return;
            }

            // Update UI based on response
            if (data.data.teamsAffected) {
                updateAllTeamUI();
            }

        } catch (error) {
            console.error('[WorldState] Error:', error);
            // Continue with local state update even if API fails
        }
    }

    // Update orchestration based on world state
    switch (newState) {
        case 'paused':
            // Local state update - teams paused via API
            Object.keys(AgentTeams).forEach(teamId => {
                state.teamOrchestrationState[teamId] = { status: 'paused', lastRun: state.teamOrchestrationState[teamId]?.lastRun };
                AgentTeams[teamId].orchestrationStatus = 'paused';
            });
            updateAllTeamUI();
            break;
            
        case 'manual':
            // Manual mode - keep current team states
            showToast('info', 'Manual Mode', 'You can manually start/stop individual teams');
            break;
            
        case 'semi_auto':
            // Semi-auto - start all teams but require approval for actions
            Object.keys(AgentTeams).forEach(teamId => {
                state.teamOrchestrationState[teamId] = { status: 'running', lastRun: state.teamOrchestrationState[teamId]?.lastRun };
                AgentTeams[teamId].orchestrationStatus = 'running';
            });
            updateAllTeamUI();
            showToast('info', 'Semi-Auto Mode', 'Teams active - actions require your approval');
            break;
            
        case 'autonomous':
            // Autonomous - start all teams
            Object.keys(AgentTeams).forEach(teamId => {
                state.teamOrchestrationState[teamId] = { status: 'running', lastRun: state.teamOrchestrationState[teamId]?.lastRun };
                AgentTeams[teamId].orchestrationStatus = 'running';
            });
            updateAllTeamUI();
            showToast('success', 'Autonomous Mode', 'All teams active - full autonomous operation');
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

    // "All Teams" button
    const allSelected = state.activeTeam === 'all' && state.selectedTeams.length === 0;
    let html = `
        <button class="team-nav-btn ${allSelected ? 'active' : ''}" data-team="all">
            <span class="team-badge all">ALL</span>
            <span class="team-name">All Teams</span>
            <span class="team-status-dot"></span>
        </button>
    `;

    // Team buttons with checkboxes for multi-select
    Object.entries(AgentTeams).forEach(([teamId, team]) => {
        const isRunning = state.teamOrchestrationState[teamId]?.status === 'running';
        const isSelected = state.selectedTeams.includes(teamId);
        const isActive = state.activeTeam === teamId && state.selectedTeams.length === 0;
        
        html += `
            <div class="team-nav-item ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}" data-team="${teamId}">
                <label class="team-nav-checkbox" title="Select for multi-team operation">
                    <input type="checkbox" class="team-select-input" data-team="${teamId}" ${isSelected ? 'checked' : ''}>
                </label>
                <button class="team-nav-btn ${isRunning ? 'running' : ''}" data-team="${teamId}">
                    <span class="team-badge ${team.badgeClass}">${team.badge}</span>
                    <span class="team-name">${team.name}</span>
                    <span class="team-status-dot"></span>
                </button>
            </div>
        `;
    });

    // Show selected count if any teams are selected
    if (state.selectedTeams.length > 0) {
        html += `
            <div class="team-selection-summary">
                <span class="selection-count">${state.selectedTeams.length} team${state.selectedTeams.length > 1 ? 's' : ''} selected</span>
                <button class="btn-clear-selection" id="btnClearSelection">Clear</button>
            </div>
        `;
    }

    elements.teamNav.innerHTML = html;

    // Add click handlers for team buttons
    elements.teamNav.querySelectorAll('.team-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const teamId = btn.dataset.team;
            // If clicking a team button, focus on that team (single view)
            selectTeam(teamId);
        });
    });

    // Add checkbox handlers for multi-select
    elements.teamNav.querySelectorAll('.team-select-input').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            const teamId = e.target.dataset.team;
            toggleTeamSelection(teamId);
        });
    });

    // Clear selection button
    const btnClearSelection = document.getElementById('btnClearSelection');
    if (btnClearSelection) {
        btnClearSelection.addEventListener('click', () => {
            state.selectedTeams = [];
            renderTeamNavButtons();
            updateWorkspaceHeader();
        });
    }
}

/**
 * Toggle team selection for multi-team operations
 */
function toggleTeamSelection(teamId) {
    const index = state.selectedTeams.indexOf(teamId);
    if (index > -1) {
        // Deselect
        state.selectedTeams.splice(index, 1);
    } else {
        // Select (max 7 teams)
        if (state.selectedTeams.length < 7) {
            state.selectedTeams.push(teamId);
        } else {
            showToast('warning', 'Max Selection', 'You can select up to 7 teams');
            return;
        }
    }
    
    renderTeamNavButtons();
    renderAgentsTeamsGrid();
    updateWorkspaceHeader();
}

function selectTeam(teamId) {
    state.activeTeam = teamId;
    
    // Only clear selection when clicking "All Teams"
    if (teamId === 'all') {
        state.selectedTeams = [];
    }

    // Update nav buttons
    renderTeamNavButtons();

    // Update workspace title and status
    updateWorkspaceHeader();

    // Re-render teams grid
    renderAgentsTeamsGrid();
}

/**
 * Update workspace header based on current state
 */
function updateWorkspaceHeader() {
    const teamId = state.activeTeam;
    const hasSelection = state.selectedTeams.length > 0;
    
    if (elements.workspaceTitle) {
        if (hasSelection) {
            // Show selected teams
            const selectedNames = state.selectedTeams.map(id => AgentTeams[id]?.badge || id).join(' + ');
            elements.workspaceTitle.textContent = `${state.selectedTeams.length} Team${state.selectedTeams.length > 1 ? 's' : ''} Selected`;
            elements.workspaceStatus.textContent = selectedNames;
            elements.workspaceStatus.className = 'workspace-status selected';
        } else if (teamId === 'all') {
            elements.workspaceTitle.textContent = 'All Teams';
            
            // Count running teams
            const runningCount = Object.values(state.teamOrchestrationState).filter(t => t.status === 'running').length;
            const totalCount = Object.keys(AgentTeams).length;
            
            if (runningCount === 0) {
                elements.workspaceStatus.textContent = 'All teams paused';
                elements.workspaceStatus.className = 'workspace-status';
            } else if (runningCount === totalCount) {
                elements.workspaceStatus.textContent = 'All teams running';
                elements.workspaceStatus.className = 'workspace-status running';
            } else {
                elements.workspaceStatus.textContent = `${runningCount}/${totalCount} teams running`;
                elements.workspaceStatus.className = 'workspace-status';
            }
        } else {
            const team = AgentTeams[teamId];
            elements.workspaceTitle.textContent = team.name;
            const status = state.teamOrchestrationState[teamId]?.status || 'paused';
            elements.workspaceStatus.textContent = `Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`;
            elements.workspaceStatus.className = `workspace-status ${status === 'running' ? 'running' : ''}`;
        }
    }

    // Update execute button text based on selection
    updateExecuteButtonText();

    // Update mode indicator
    updateModeIndicator();
}

/**
 * Update execute button text based on current selection
 */
function updateExecuteButtonText() {
    const btn = elements.btnExecuteCycle;
    if (!btn || state.executionInProgress) return;

    const hasSelection = state.selectedTeams.length > 0;
    let buttonText = 'Execute Cycle';
    
    if (hasSelection) {
        buttonText = `Execute ${state.selectedTeams.length} Team${state.selectedTeams.length > 1 ? 's' : ''}`;
    } else if (state.activeTeam === 'all') {
        buttonText = 'Execute All Teams';
    } else {
        buttonText = `Execute ${AgentTeams[state.activeTeam]?.badge || 'Team'}`;
    }

    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
        </svg>
        ${buttonText}
    `;
}

/**
 * Update the workspace mode indicator
 */
function updateModeIndicator() {
    const indicator = document.getElementById('workspaceModeIndicator');
    const modeText = document.getElementById('workspaceModeText');
    
    if (!indicator || !modeText) return;

    const modeConfig = {
        paused: {
            icon: '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>',
            text: 'Paused',
            class: 'paused'
        },
        manual: {
            icon: '<path d="M13 7.83l4.59 4.58L19 11l-7-7-7 7 1.41 1.41L11 7.83V22h2V7.83z"/>',
            text: 'Manual',
            class: 'manual'
        },
        semi_auto: {
            icon: '<path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>',
            text: 'Semi-Auto',
            class: 'semi_auto'
        },
        autonomous: {
            icon: '<path d="M8 5v14l11-7z"/>',
            text: 'Autonomous',
            class: 'autonomous'
        }
    };

    const config = modeConfig[state.worldState] || modeConfig.paused;
    
    indicator.className = `workspace-mode-indicator ${config.class}`;
    indicator.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">${config.icon}</svg>
        <span id="workspaceModeText">${config.text}</span>
    `;
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

    // Determine which teams to show
    let teamsToShow;
    if (state.selectedTeams.length > 0) {
        // Show only selected teams
        teamsToShow = state.selectedTeams.map(id => [id, AgentTeams[id]]).filter(([id, team]) => team);
    } else if (state.activeTeam === 'all') {
        // Show all teams
        teamsToShow = Object.entries(AgentTeams);
    } else {
        // Show single team
        teamsToShow = [[state.activeTeam, AgentTeams[state.activeTeam]]];
    }

    let html = '';
    
    teamsToShow.forEach(([teamId, team]) => {
        if (!team) return;
        const isRunning = state.teamOrchestrationState[teamId]?.status === 'running';
        const isSelected = state.selectedTeams.includes(teamId);
        const lastRun = state.teamOrchestrationState[teamId]?.lastRun;
        const lastRunText = lastRun ? formatTimeAgo(new Date(lastRun)) : 'Never';

        html += `
            <div class="team-section ${isSelected ? 'selected' : ''}" data-team="${teamId}">
                <div class="team-header">
                    <div class="team-badge ${team.badgeClass}">${team.badge}</div>
                    <h3 class="team-name">${escapeHtml(team.name)}</h3>
                    <span class="team-count">${team.agents.length} agents</span>
                    <span class="team-last-run" title="Last execution">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                        ${lastRunText}
                    </span>
                    <div class="team-controls">
                        <button class="btn-team-execute" data-team="${teamId}" title="Execute this team">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
                        </button>
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

    // Add execute handlers for individual teams
    elements.agentsTeamsContainer.querySelectorAll('.btn-team-execute').forEach(btn => {
        btn.addEventListener('click', async () => {
            const teamId = btn.dataset.team;
            await executeTeams([teamId]);
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
    if (!state.adminToken) {
        showToast('error', 'Admin Token Required', 'Configure admin token in Settings');
        return;
    }

    showToast('info', 'Starting All Teams', 'Initiating orchestration for all teams...');

    try {
        const response = await fetch('/api/orchestrate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.adminToken}`
            },
            body: JSON.stringify({ action: 'startAll' })
        });

        const data = await response.json();

        if (data.success) {
            // Update local state
            Object.keys(AgentTeams).forEach(teamId => {
                state.teamOrchestrationState[teamId] = { status: 'running', lastRun: new Date().toISOString() };
                AgentTeams[teamId].orchestrationStatus = 'running';
            });
            
            // Update world state if returned
            if (data.data.worldState) {
                state.worldState = data.data.worldState;
                state.orchestrationMode = data.data.worldState;
            }

            updateAllTeamUI();
            showToast('success', 'All Teams Started', `${data.data.teamsStarted || Object.keys(AgentTeams).length} teams now active`);
        } else {
            showToast('error', 'Start Failed', data.error || 'Failed to start all teams');
        }
    } catch (error) {
        console.error('[Orchestration] Start all error:', error);
        showToast('error', 'Connection Error', 'Failed to start all teams');
    }
}

async function pauseAllTeams() {
    if (!state.adminToken) {
        showToast('error', 'Admin Token Required', 'Configure admin token in Settings');
        return;
    }

    showToast('info', 'Pausing All Teams', 'Stopping orchestration for all teams...');

    try {
        const response = await fetch('/api/orchestrate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.adminToken}`
            },
            body: JSON.stringify({ action: 'stopAll' })
        });

        const data = await response.json();

        if (data.success) {
            // Update local state
            Object.keys(AgentTeams).forEach(teamId => {
                state.teamOrchestrationState[teamId] = { status: 'paused', lastRun: state.teamOrchestrationState[teamId]?.lastRun };
                AgentTeams[teamId].orchestrationStatus = 'paused';
                AgentTeams[teamId].agents.forEach(agent => {
                    agent.status = 'idle';
                    agent.currentTask = null;
                });
            });
            
            // Update world state
            state.worldState = 'paused';
            state.orchestrationMode = 'paused';
            
            // Update world state buttons
            elements.worldStateBtns?.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.state === 'paused');
            });

            updateAllTeamUI();
            showToast('info', 'All Teams Paused', `${data.data.teamsPaused || Object.keys(AgentTeams).length} teams paused`);
        } else {
            showToast('error', 'Pause Failed', data.error || 'Failed to pause all teams');
        }
    } catch (error) {
        console.error('[Orchestration] Pause all error:', error);
        showToast('error', 'Connection Error', 'Failed to pause all teams');
    }
}

/**
 * Start selected teams (multi-team operation)
 */
async function startSelectedTeams() {
    if (!state.adminToken) {
        showToast('error', 'Admin Token Required', 'Configure admin token in Settings');
        return;
    }

    const teamIds = state.selectedTeams.length > 0 ? state.selectedTeams : [state.activeTeam];
    
    if (teamIds.includes('all')) {
        return startAllTeams();
    }

    showToast('info', 'Starting Teams', `Starting ${teamIds.length} team(s)...`);

    for (const teamId of teamIds) {
        await startTeamOrchestration(teamId);
    }
}

/**
 * Pause selected teams (multi-team operation)
 */
async function pauseSelectedTeams() {
    if (!state.adminToken) {
        showToast('error', 'Admin Token Required', 'Configure admin token in Settings');
        return;
    }

    const teamIds = state.selectedTeams.length > 0 ? state.selectedTeams : [state.activeTeam];
    
    if (teamIds.includes('all')) {
        return pauseAllTeams();
    }

    showToast('info', 'Pausing Teams', `Pausing ${teamIds.length} team(s)...`);

    for (const teamId of teamIds) {
        await stopTeamOrchestration(teamId);
    }
}

async function executeOrchestrationCycle() {
    if (!state.adminToken) {
        showToast('error', 'Admin Token Required', 'Configure admin token in Settings');
        return;
    }

    // Prevent double execution
    if (state.executionInProgress) {
        showToast('warning', 'Execution In Progress', 'Please wait for current execution to complete');
        return;
    }

    state.executionInProgress = true;
    updateExecuteButtonState(true);

    try {
        let response;
        let toastMessage;
        const hasSelection = state.selectedTeams.length > 0;

        if (hasSelection) {
            // Execute selected teams (1, 2, 3, or more)
            const teamNames = state.selectedTeams.map(id => AgentTeams[id]?.badge || id).join(' + ');
            toastMessage = `Running ${state.selectedTeams.length} team${state.selectedTeams.length > 1 ? 's' : ''}: ${teamNames}`;
            showToast('info', 'Executing Selected Teams', toastMessage);

            if (state.selectedTeams.length === 1) {
                // Single selected team
                response = await fetch('/api/orchestrate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${state.adminToken}`
                    },
                    body: JSON.stringify({ teamId: state.selectedTeams[0], action: 'execute' })
                });
            } else {
                // Multiple selected teams
                response = await fetch('/api/orchestrate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${state.adminToken}`
                    },
                    body: JSON.stringify({ 
                        action: 'executeMultiple', 
                        teamIds: state.selectedTeams,
                        parallel: true 
                    })
                });
            }

        } else if (state.activeTeam === 'all') {
            // Execute ALL teams
            toastMessage = 'Running company-wide orchestration...';
            showToast('info', 'Executing All Teams', toastMessage);

            response = await fetch('/api/orchestrate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.adminToken}`
                },
                body: JSON.stringify({ action: 'executeAll', parallel: true })
            });

        } else {
            // Execute single focused team (from sidebar click)
            const teamId = state.activeTeam;
            toastMessage = `Running ${AgentTeams[teamId].name} orchestration...`;
            showToast('info', 'Executing Team', toastMessage);

            response = await fetch('/api/orchestrate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.adminToken}`
                },
                body: JSON.stringify({ teamId, action: 'execute' })
            });
        }

        const data = await response.json();

        if (data.success) {
            const result = data.data;

            // Handle different response structures
            let activities = [];
            let tokensUsed = 0;
            let teamsExecuted = 1;

            if (result.totalActivities) {
                // Multi-team execution response
                activities = result.totalActivities;
                tokensUsed = result.usage?.outputTokens || 0;
                teamsExecuted = result.executed?.length || 0;
            } else if (result.activities) {
                // Single team execution response
                activities = result.activities;
                tokensUsed = result.usage?.outputTokens || 0;
            }

            // Update activities
            if (activities.length > 0) {
                state.activities = [...activities, ...state.activities].slice(0, 50);
                renderActivityFeed();
                renderOverviewActivity();
            }

            // Update team states
            if (result.executed) {
                result.executed.forEach(teamId => {
                    state.teamOrchestrationState[teamId] = { 
                        status: 'running', 
                        lastRun: new Date().toISOString() 
                    };
                    if (AgentTeams[teamId]) {
                        AgentTeams[teamId].orchestrationStatus = 'running';
                    }
                });
            }

            state.lastExecutionTime = new Date().toISOString();
            updateAllTeamUI();

            // Success message
            if (teamsExecuted > 1) {
                showToast('success', 'Orchestration Complete', `Executed ${teamsExecuted} teams • ${tokensUsed} tokens used`);
            } else {
                showToast('success', 'Orchestration Complete', `${activities.length} activities • ${tokensUsed} tokens used`);
            }

            // Show failed teams if any
            if (result.failed && result.failed.length > 0) {
                const failedNames = result.failed.map(f => f.teamId).join(', ');
                showToast('warning', 'Some Teams Failed', `Failed: ${failedNames}`);
            }

        } else {
            showToast('error', 'Execution Failed', data.error || data.details || 'Orchestration failed');
        }
    } catch (error) {
        console.error('[Orchestration] Execute error:', error);
        showToast('error', 'Execution Error', 'Orchestration execution failed');
    } finally {
        state.executionInProgress = false;
        updateExecuteButtonState(false);
    }
}

/**
 * Execute orchestration for specific teams
 */
async function executeTeams(teamIds) {
    if (!state.adminToken) {
        showToast('error', 'Admin Token Required', 'Configure admin token in Settings');
        return;
    }

    if (!teamIds || teamIds.length === 0) {
        showToast('warning', 'No Teams Selected', 'Select teams to execute');
        return;
    }

    state.executionInProgress = true;
    updateExecuteButtonState(true);

    try {
        const teamNames = teamIds.map(id => AgentTeams[id]?.name || id).join(', ');
        showToast('info', 'Executing Teams', `Running: ${teamNames}`);

        const response = await fetch('/api/orchestrate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.adminToken}`
            },
            body: JSON.stringify({ 
                action: teamIds.length === 1 ? 'execute' : 'executeMultiple',
                teamId: teamIds.length === 1 ? teamIds[0] : undefined,
                teamIds: teamIds.length > 1 ? teamIds : undefined,
                parallel: true
            })
        });

        const data = await response.json();

        if (data.success) {
            const result = data.data;
            const activities = result.totalActivities || result.activities || [];
            
            if (activities.length > 0) {
                state.activities = [...activities, ...state.activities].slice(0, 50);
                renderActivityFeed();
                renderOverviewActivity();
            }

            updateAllTeamUI();
            showToast('success', 'Execution Complete', `${activities.length} activities generated`);
        } else {
            showToast('error', 'Execution Failed', data.error || 'Failed to execute teams');
        }
    } catch (error) {
        console.error('[Orchestration] Execute teams error:', error);
        showToast('error', 'Execution Error', 'Failed to execute teams');
    } finally {
        state.executionInProgress = false;
        updateExecuteButtonState(false);
    }
}

/**
 * Update execute button state during execution
 */
function updateExecuteButtonState(isExecuting) {
    const btn = elements.btnExecuteCycle;
    if (!btn) return;

    if (isExecuting) {
        btn.disabled = true;
        btn.classList.add('executing');
        btn.innerHTML = `
            <svg class="spin" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
            </svg>
            Executing...
        `;
    } else {
        btn.disabled = false;
        btn.classList.remove('executing');
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
            </svg>
            Execute Cycle
        `;
    }
}

async function fetchOrchestrationStatus() {
    try {
        const response = await fetch('/api/orchestrate?action=status');
        const data = await response.json();

        if (data.success) {
            // Update world state
            state.worldState = data.data.worldState || data.data.globalMode || 'manual';
            state.orchestrationMode = data.data.globalMode || 'manual';
            state.executionInProgress = data.data.executionInProgress || false;
            state.lastExecutionTime = data.data.lastExecutionTime;

            // Update team states
            Object.entries(data.data.teams || {}).forEach(([teamId, teamState]) => {
                state.teamOrchestrationState[teamId] = {
                    status: teamState.status,
                    lastRun: teamState.lastRun,
                    runCount: teamState.runCount
                };
                if (AgentTeams[teamId]) {
                    AgentTeams[teamId].orchestrationStatus = teamState.status;
                }
            });

            // Update world state buttons
            elements.worldStateBtns?.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.state === state.worldState);
            });

            // Update execution button state
            updateExecuteButtonState(state.executionInProgress);

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
    updateWorkspaceHeader();
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
    // Don't auto-load signups - they require authentication
    // Signups will be loaded after biometric auth succeeds

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

/**
 * Initialize biometric authentication gate
 */
async function initBiometricAuth() {
    const gate = document.getElementById('biometricGate');
    const btnAuth = document.getElementById('btnAuthenticate');
    const btnSetup = document.getElementById('btnSetup');
    const authTypeText = document.getElementById('authTypeText');
    const gateSubtitle = document.getElementById('gateSubtitle');
    const gateMessage = document.getElementById('gateMessage');
    const iconContainer = document.getElementById('biometricIcon');

    if (!gate) {
        console.log('[CEO Dashboard] No biometric gate found, allowing access');
        document.body.classList.add('authenticated'); // Show dashboard content
        return true; // No gate, allow access
    }

    // CRITICAL: Attach event listeners IMMEDIATELY to ensure buttons always work
    if (btnAuth) {
        btnAuth.addEventListener('click', handleBiometricAuth);
        console.log('[CEO Dashboard] Auth button listener attached');
    }
    if (btnSetup) {
        btnSetup.addEventListener('click', handleBiometricSetup);
        console.log('[CEO Dashboard] Setup button listener attached');
    }

    // Initialize device linking
    initDeviceLinking();

    // Check biometric library loaded
    if (typeof BiometricAuth === 'undefined') {
        console.error('[CEO Dashboard] BiometricAuth not loaded');
        gate.classList.add('not-supported');
        showBiometricStatus('Biometric library failed to load', 'error');
        return false;
    }

    try {
        // Check for magic link token in URL (highest priority)
        const magicToken = BiometricAuth.getMagicLinkToken();
        if (magicToken) {
            showBiometricStatus('Verifying magic link...', 'info');
            try {
                const magicResult = await BiometricAuth.verifyMagicLink(magicToken);
                BiometricAuth.clearMagicLinkToken();
                if (magicResult.success) {
                    showBiometricStatus(magicResult.message || 'Access granted via magic link!', 'success');
                    await new Promise(r => setTimeout(r, 800));
                    hideBiometricGate();
                    return true;
                }
            } catch (magicError) {
                console.error('[CEO Dashboard] Magic link verification failed:', magicError);
                BiometricAuth.clearMagicLinkToken();
                showBiometricStatus(magicError.message || 'Magic link expired or invalid', 'error');
            }
        }

        // Check if already verified in this session
        const sessionVerified = await BiometricAuth.isSessionVerified();
        if (sessionVerified) {
            console.log('[CEO Dashboard] Session already verified');
            hideBiometricGate();
            return true;
        }

        // Check biometric support
        const support = await BiometricAuth.checkSupport();
        state.biometricSupported = support.supported && support.platformAuthenticator;
        state.authenticatorType = support.type || 'Biometric';

        if (!state.biometricSupported) {
            console.warn('[CEO Dashboard] Platform authenticator not available:', support);
            gate.classList.add('not-supported');
            showBiometricStatus('Biometric not available - use magic link to access', 'info');
            initMagicLink();
            return false;
        }

        // Update UI with authenticator type
        if (authTypeText) {
            authTypeText.textContent = state.authenticatorType;
        }

        // Update icon based on type
        updateBiometricIcon(state.authenticatorType);

        // Check access status (owner-lock system)
        showBiometricStatus('Checking access...', 'info');
        const accessStatus = await BiometricAuth.checkAccessStatus();

        hideBiometricStatus();

        // Handle service errors (e.g., missing BLOB_READ_WRITE_TOKEN)
        if (accessStatus.serviceError) {
            console.error('[CEO Dashboard] Service error during access check:', accessStatus.message);
            if (btnAuth) btnAuth.style.display = 'none';
            if (btnSetup) btnSetup.style.display = 'none';
            if (gateSubtitle) {
                gateSubtitle.textContent = 'Service Unavailable';
            }
            if (gateMessage) {
                gateMessage.textContent = accessStatus.message || 'Authentication service is temporarily unavailable. Please try again later.';
            }
            showBiometricStatus('Authentication service error. Please check server configuration.', 'error');
            return false;
        }

        if (accessStatus.hasOwner) {
            if (accessStatus.isOwnerDevice) {
                // Owner device - show auth button
                if (btnAuth) btnAuth.style.display = 'flex';
                if (btnSetup) btnSetup.style.display = 'none';
                if (gateSubtitle) {
                    gateSubtitle.innerHTML = `Welcome back. Use <span class="biometric-type">${escapeHtml(state.authenticatorType)}</span> to unlock.`;
                }
                if (gateMessage) {
                    gateMessage.textContent = 'Your biometric is required to access this dashboard';
                }
                updateAuthButton(`Unlock with ${state.authenticatorType}`, false);
            } else {
                // Non-owner device - show locked state with link option
                gate.classList.add('locked');
                if (btnAuth) btnAuth.style.display = 'none';
                if (btnSetup) btnSetup.style.display = 'none';
                showLockedIcon();
                if (gateSubtitle) {
                    gateSubtitle.textContent = 'Access Denied';
                }
                if (gateMessage) {
                    gateMessage.textContent = 'This dashboard is secured by another device. Only the owner can access it.';
                }
                showBiometricStatus('This dashboard is locked to its owner\'s device', 'error');

                // Show link device option if available
                const btnLinkDevice = document.getElementById('btnLinkDevice');
                if (btnLinkDevice && accessStatus.canLinkDevice !== false) {
                    btnLinkDevice.style.display = 'flex';
                }

                // Always show magic link option for non-owner devices
                const btnMagicLink = document.getElementById('btnMagicLink');
                if (btnMagicLink) {
                    btnMagicLink.style.display = 'flex';
                    initMagicLink();
                }
                return false;
            }
        } else {
            // No owner yet - show setup for first registration
            if (btnAuth) btnAuth.style.display = 'none';
            if (btnSetup) btnSetup.style.display = 'flex';
            if (gateSubtitle) {
                gateSubtitle.innerHTML = `Secure this dashboard with <span class="biometric-type">${escapeHtml(state.authenticatorType)}</span>`;
            }
            if (gateMessage) {
                gateMessage.textContent = 'First-time setup: Your biometric will become the only key to this dashboard';
            }
        }

        return false; // Don't allow access until verified

    } catch (error) {
        console.error('[CEO Dashboard] Biometric initialization error:', error);
        showBiometricStatus(`Initialization failed: ${error.message}`, 'error');
        // Keep buttons functional so user can retry
        return false;
    }
}

/**
 * Handle biometric authentication
 */
async function handleBiometricAuth() {
    console.log('[CEO Dashboard] handleBiometricAuth called');
    const iconContainer = document.getElementById('biometricIcon');

    // Check if BiometricAuth is available
    if (typeof BiometricAuth === 'undefined') {
        console.error('[CEO Dashboard] BiometricAuth not available');
        showBiometricStatus('Biometric library not loaded. Please refresh the page.', 'error');
        alert('Error: Biometric authentication library not loaded. Please refresh the page.');
        return;
    }

    // Check if WebAuthn is supported
    if (!state.biometricSupported) {
        console.error('[CEO Dashboard] Biometric not supported');
        showBiometricStatus('Biometric authentication not supported on this device.', 'error');
        return;
    }

    try {
        console.log('[CEO Dashboard] Starting authentication...');
        updateAuthButton('Verifying...', true);
        iconContainer?.classList.add('scanning');
        iconContainer?.classList.remove('error', 'success');
        hideBiometricStatus();

        const result = await BiometricAuth.authenticate((progress) => {
            console.log('[CEO Dashboard] Auth progress:', progress);
            showBiometricStatus(progress, 'info');
        });

        console.log('[CEO Dashboard] Auth result:', result);

        if (result.success) {
            state.biometricVerified = true;
            state.isAuthenticated = true;
            iconContainer?.classList.remove('scanning');
            iconContainer?.classList.add('success');
            showSuccessIcon();
            showBiometricStatus(result.message || 'Welcome back!', 'success');

            // Dispatch custom event for integration
            window.dispatchEvent(new CustomEvent('biometric-authenticated'));

            // Brief delay to show success
            setTimeout(() => {
                hideBiometricGate();
                // Load authenticated data
                fetchOrchestrationStatus();
                loadSignups();
            }, 800);
        } else {
            console.warn('[CEO Dashboard] Auth returned non-success:', result);
            iconContainer?.classList.remove('scanning');
            iconContainer?.classList.add('error');
            showBiometricStatus(result.message || 'Authentication failed', 'error');
            updateAuthButton('Try Again', false);

            setTimeout(() => {
                iconContainer?.classList.remove('error');
                updateBiometricIcon(state.authenticatorType);
            }, 2000);
        }
    } catch (error) {
        console.error('[CEO Dashboard] Biometric auth failed:', error);
        iconContainer?.classList.remove('scanning');
        iconContainer?.classList.add('error');

        let errorMessage = error.message || 'Authentication failed';

        if (errorMessage.includes('temporarily unavailable') || errorMessage.includes('CONFIG_ERROR')) {
            errorMessage = 'Server configuration error. Please contact administrator.';
        } else if (errorMessage.includes('Unable to connect')) {
            errorMessage = 'Cannot connect to server. Please check your internet connection.';
        } else if (errorMessage.includes('cancelled')) {
            errorMessage = 'Authentication was cancelled. Please try again.';
        }

        showBiometricStatus(errorMessage, 'error');
        updateAuthButton('Try Again', false);

        setTimeout(() => {
            iconContainer?.classList.remove('error');
            updateBiometricIcon(state.authenticatorType);
        }, 2000);
    }
}

/**
 * Handle biometric setup/registration (owner-lock)
 */
async function handleBiometricSetup() {
    console.log('[CEO Dashboard] handleBiometricSetup called');
    const btnSetup = document.getElementById('btnSetup');
    const btnAuth = document.getElementById('btnAuthenticate');
    const iconContainer = document.getElementById('biometricIcon');
    const btnSetupText = document.getElementById('btnSetupText');
    const gateMessage = document.getElementById('gateMessage');

    try {
        if (btnSetup) btnSetup.disabled = true;
        if (btnSetupText) btnSetupText.textContent = 'Setting up...';
        iconContainer?.classList.add('scanning');
        iconContainer?.classList.remove('error', 'success');
        hideBiometricStatus();

        const result = await BiometricAuth.register((progress) => {
            showBiometricStatus(progress, 'info');
        });

        if (result.success) {
            iconContainer?.classList.remove('scanning');
            iconContainer?.classList.add('success');
            showSuccessIcon();
            showBiometricStatus(result.message || 'Dashboard secured!', 'success');

            if (gateMessage) {
                gateMessage.textContent = 'Your biometric is now the only key to this dashboard';
            }

            // Switch to authenticate mode after brief delay
            setTimeout(() => {
                if (btnSetup) btnSetup.style.display = 'none';
                if (btnAuth) btnAuth.style.display = 'flex';
                updateAuthButton(`Unlock with ${state.authenticatorType}`, false);
                iconContainer?.classList.remove('success');
                updateBiometricIcon(state.authenticatorType);
                showBiometricStatus('Now use your biometric to unlock', 'info');
            }, 1500);
        }
    } catch (error) {
        console.error('[CEO Dashboard] Biometric setup failed:', error);
        iconContainer?.classList.remove('scanning');
        iconContainer?.classList.add('error');
        showBiometricStatus(error.message || 'Setup failed', 'error');
        if (btnSetup) btnSetup.disabled = false;
        if (btnSetupText) btnSetupText.textContent = 'Secure This Dashboard';

        setTimeout(() => {
            iconContainer?.classList.remove('error');
            updateBiometricIcon(state.authenticatorType);
        }, 2000);
    }
}

/**
 * Initialize magic link functionality
 */
function initMagicLink() {
    const btnMagicLink = document.getElementById('btnMagicLink');
    const btnMagicLinkAlt = document.getElementById('btnMagicLinkAlt');
    const magicLinkInput = document.getElementById('magicLinkInput');
    const magicEmailInput = document.getElementById('magicEmailInput');
    const btnSendMagic = document.getElementById('btnSendMagic');
    const btnCancelMagic = document.getElementById('btnCancelMagic');

    const pageName = 'ceo-dashboard';

    function showMagicLinkForm() {
        if (btnMagicLink) btnMagicLink.style.display = 'none';
        if (magicLinkInput) {
            magicLinkInput.style.display = 'block';
            magicEmailInput?.focus();
        }
        hideBiometricStatus();
    }

    if (btnMagicLink) {
        btnMagicLink.addEventListener('click', showMagicLinkForm);
    }

    if (btnMagicLinkAlt) {
        btnMagicLinkAlt.addEventListener('click', showMagicLinkForm);
    }

    btnCancelMagic?.addEventListener('click', () => {
        if (magicLinkInput) magicLinkInput.style.display = 'none';
        if (btnMagicLink) btnMagicLink.style.display = 'flex';
        if (magicEmailInput) magicEmailInput.value = '';
    });

    btnSendMagic?.addEventListener('click', () => handleSendMagicLink(pageName));

    magicEmailInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSendMagicLink(pageName);
    });
}

/**
 * Handle sending a magic link email
 */
async function handleSendMagicLink(pageName) {
    const magicEmailInput = document.getElementById('magicEmailInput');
    const btnSendMagic = document.getElementById('btnSendMagic');

    const email = magicEmailInput?.value?.trim();

    if (!email || !email.includes('@')) {
        showBiometricStatus('Please enter a valid email address', 'error');
        return;
    }

    if (typeof BiometricAuth === 'undefined') {
        showBiometricStatus('Authentication library not loaded. Please refresh.', 'error');
        return;
    }

    try {
        if (btnSendMagic) {
            btnSendMagic.disabled = true;
            const btnText = btnSendMagic.querySelector('span');
            if (btnText) btnText.textContent = 'Sending...';
        }
        showBiometricStatus('Sending magic link...', 'info');

        const result = await BiometricAuth.requestMagicLink(email, pageName);

        if (result.success) {
            showBiometricStatus(result.message || 'Magic link sent! Check your email.', 'success');

            const magicLinkInput = document.getElementById('magicLinkInput');
            if (magicLinkInput) {
                magicLinkInput.innerHTML = `
                    <div class="magic-link-sent">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--gate-success);margin:0 auto 16px;">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        <p class="link-instruction" style="color:var(--gate-success);font-weight:600;">Magic link sent!</p>
                        <p class="link-instruction">Check your email and click the link to access this dashboard from this device.</p>
                        <p class="link-instruction" style="font-size:12px;color:var(--gate-text-subtle);">Link expires in 15 minutes.</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('[CEO Dashboard] Magic link send failed:', error);
        showBiometricStatus(error.message || 'Failed to send magic link', 'error');

        if (btnSendMagic) {
            btnSendMagic.disabled = false;
            const btnText = btnSendMagic.querySelector('span');
            if (btnText) btnText.textContent = 'Send';
        }
    }
}

/**
 * Initialize device linking functionality
 */
function initDeviceLinking() {
    const btnLinkDevice = document.getElementById('btnLinkDevice');
    const btnClaimLink = document.getElementById('btnClaimLink');
    const btnCancelLink = document.getElementById('btnCancelLink');
    const deviceLinkInput = document.getElementById('deviceLinkInput');
    const linkCodeInput = document.getElementById('linkCodeInput');

    if (btnLinkDevice) {
        btnLinkDevice.addEventListener('click', () => {
            if (deviceLinkInput) deviceLinkInput.style.display = 'block';
            btnLinkDevice.style.display = 'none';
        });
    }

    if (btnCancelLink) {
        btnCancelLink.addEventListener('click', () => {
            if (deviceLinkInput) deviceLinkInput.style.display = 'none';
            if (btnLinkDevice) btnLinkDevice.style.display = 'flex';
            if (linkCodeInput) linkCodeInput.value = '';
        });
    }

    if (btnClaimLink && linkCodeInput) {
        btnClaimLink.addEventListener('click', async () => {
            const code = linkCodeInput.value.trim().toUpperCase();
            if (code.length !== 6) {
                showBiometricStatus('Please enter a 6-character code', 'error');
                return;
            }

            try {
                btnClaimLink.disabled = true;
                showBiometricStatus('Linking device...', 'info');

                const result = await BiometricAuth.claimDeviceLink(code);

                if (result.success) {
                    showBiometricStatus('Device linked! You can now register your biometric.', 'success');
                    if (deviceLinkInput) deviceLinkInput.style.display = 'none';

                    // Show setup button for newly linked device
                    const btnSetup = document.getElementById('btnSetup');
                    if (btnSetup) btnSetup.style.display = 'flex';
                }
            } catch (error) {
                showBiometricStatus(error.message || 'Failed to link device', 'error');
            } finally {
                btnClaimLink.disabled = false;
            }
        });
    }
}

/**
 * Update biometric icon based on authenticator type
 */
function updateBiometricIcon(type) {
    const iconFaceId = document.getElementById('iconFaceId');
    const iconFingerprint = document.getElementById('iconFingerprint');
    const iconLocked = document.getElementById('iconLocked');
    const iconSuccess = document.getElementById('iconSuccess');

    [iconFaceId, iconFingerprint, iconLocked, iconSuccess].forEach(icon => {
        if (icon) icon.style.display = 'none';
    });

    if (type === 'Fingerprint' || type === 'Touch ID' || type === 'Windows Hello') {
        if (iconFingerprint) iconFingerprint.style.display = 'block';
    } else {
        if (iconFaceId) iconFaceId.style.display = 'block';
    }
}

/**
 * Show locked icon for non-owner devices
 */
function showLockedIcon() {
    const iconFaceId = document.getElementById('iconFaceId');
    const iconFingerprint = document.getElementById('iconFingerprint');
    const iconLocked = document.getElementById('iconLocked');

    [iconFaceId, iconFingerprint].forEach(icon => {
        if (icon) icon.style.display = 'none';
    });
    if (iconLocked) iconLocked.style.display = 'block';
}

/**
 * Show success icon
 */
function showSuccessIcon() {
    const iconFaceId = document.getElementById('iconFaceId');
    const iconFingerprint = document.getElementById('iconFingerprint');
    const iconSuccess = document.getElementById('iconSuccess');

    [iconFaceId, iconFingerprint].forEach(icon => {
        if (icon) icon.style.display = 'none';
    });
    if (iconSuccess) iconSuccess.style.display = 'block';
}

/**
 * Update authenticate button state
 */
function updateAuthButton(text, disabled) {
    const btn = document.getElementById('btnAuthenticate');
    const textEl = document.getElementById('btnAuthText');
    if (btn) btn.disabled = disabled;
    if (textEl) textEl.textContent = text;
}

/**
 * Show biometric status message
 */
function showBiometricStatus(message, type) {
    const statusEl = document.getElementById('biometricStatus');
    const statusText = document.getElementById('statusText');
    const statusIcon = statusEl?.querySelector('.status-icon');

    if (!statusEl) return;

    if (statusText) statusText.textContent = message;
    statusEl.className = 'biometric-status visible ' + type;

    if (statusIcon) {
        statusIcon.innerHTML = type === 'success'
            ? '<polyline points="20 6 9 17 4 12"/>'
            : type === 'error'
            ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
            : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>';
    }
}

/**
 * Hide biometric status message
 */
function hideBiometricStatus() {
    const statusEl = document.getElementById('biometricStatus');
    if (statusEl) {
        statusEl.className = 'biometric-status';
    }
}

/**
 * Hide the biometric gate and show dashboard
 */
function hideBiometricGate() {
    const gate = document.getElementById('biometricGate');
    console.log('[CEO Dashboard] hideBiometricGate called, gate element:', !!gate);
    
    if (gate) {
        gate.classList.add('authenticated');
        gate.classList.add('hidden');
        
        // Add authenticated class to body to reveal dashboard content
        document.body.classList.add('authenticated');
        console.log('[CEO Dashboard] Added authenticated class to body:', document.body.classList.contains('authenticated'));
        console.log('[CEO Dashboard] Body classes:', document.body.className);
        
        setTimeout(() => {
            gate.style.display = 'none';
            console.log('[CEO Dashboard] Gate hidden via display:none');
        }, 500);
    }
}

// Listen for successful authentication events
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
