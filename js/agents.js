/**
 * FUSE Agent Command Center
 * Dynamic AI Agent Orchestration System with Live Feeds
 */

// ============================================
// AGENT DATA STRUCTURES
// ============================================

// All agents default to IDLE - orchestration must be started to activate them
const AgentTeams = {
    developer: {
        id: 'developer',
        name: 'Developer Team',
        badge: 'DEV',
        color: '#3b82f6',
        model: 'claude-3-5-sonnet-latest',
        provider: 'anthropic',
        description: 'Building and architecting the core platform',
        orchestrationStatus: 'paused',
        agents: [
            {
                id: 'architect',
                name: 'Architect',
                role: 'System Design & Architecture',
                status: 'idle',
                skills: ['System Design', 'API Architecture', 'Database Design', 'Scalability'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'shield'
            },
            {
                id: 'coder',
                name: 'Coder',
                role: 'Implementation & Debugging',
                status: 'idle',
                skills: ['JavaScript', 'Python', 'React', 'Node.js', 'TypeScript'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'code'
            },
            {
                id: 'tester',
                name: 'QA Engineer',
                role: 'Testing & Quality Assurance',
                status: 'idle',
                skills: ['Unit Testing', 'Integration Testing', 'E2E Testing', 'Performance'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'test'
            }
        ]
    },
    design: {
        id: 'design',
        name: 'Design Team',
        badge: 'DSN',
        color: '#8b5cf6',
        model: 'claude-3-5-sonnet-latest',
        provider: 'anthropic',
        description: 'Crafting beautiful user experiences',
        orchestrationStatus: 'paused',
        agents: [
            {
                id: 'ux-lead',
                name: 'UX Lead',
                role: 'User Experience Strategy',
                status: 'idle',
                skills: ['User Research', 'Wireframing', 'Prototyping', 'Usability Testing'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'palette'
            },
            {
                id: 'ui-artist',
                name: 'Visual Designer',
                role: 'UI & Visual Systems',
                status: 'idle',
                skills: ['Visual Design', 'Figma', 'Design Systems', 'Branding'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'brush'
            },
            {
                id: 'motion',
                name: 'Motion Designer',
                role: 'Animation & Interactions',
                status: 'idle',
                skills: ['Animation', 'Micro-interactions', 'GSAP', 'Lottie'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'motion'
            }
        ]
    },
    communications: {
        id: 'communications',
        name: 'Communications Team',
        badge: 'COM',
        color: '#06b6d4',
        model: 'gpt-4o',
        provider: 'openai',
        description: 'Managing content and brand voice',
        orchestrationStatus: 'paused',
        agents: [
            {
                id: 'content-strategist',
                name: 'Content Strategist',
                role: 'Content Planning & Voice',
                status: 'idle',
                skills: ['Content Strategy', 'Editorial', 'SEO', 'Brand Voice'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'document'
            },
            {
                id: 'copywriter',
                name: 'Copywriter',
                role: 'Persuasive Copy & Messaging',
                status: 'idle',
                skills: ['Copywriting', 'Headlines', 'Email', 'Ad Copy'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'pen'
            },
            {
                id: 'social-manager',
                name: 'Social Media Manager',
                role: 'Community & Engagement',
                status: 'idle',
                skills: ['Social Media', 'Community Management', 'Influencer Outreach', 'Analytics'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'share'
            }
        ]
    },
    legal: {
        id: 'legal',
        name: 'Legal Team',
        badge: 'LGL',
        color: '#f59e0b',
        model: 'claude-3-opus-latest',
        provider: 'anthropic',
        description: 'Ensuring compliance and protecting IP',
        orchestrationStatus: 'paused',
        agents: [
            {
                id: 'compliance-officer',
                name: 'Compliance Officer',
                role: 'Regulatory Compliance',
                status: 'idle',
                skills: ['GDPR', 'CCPA', 'FDA Regulations', 'Data Privacy'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'shield'
            },
            {
                id: 'contract-analyst',
                name: 'Contract Analyst',
                role: 'Terms & Agreements',
                status: 'idle',
                skills: ['Contract Review', 'Terms of Service', 'Privacy Policy', 'Licensing'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'document'
            },
            {
                id: 'ip-counsel',
                name: 'IP Counsel',
                role: 'Intellectual Property',
                status: 'idle',
                skills: ['Trademarks', 'Patents', 'Copyright', 'Trade Secrets'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'lock'
            }
        ]
    },
    marketing: {
        id: 'marketing',
        name: 'Marketing Team',
        badge: 'MKT',
        color: '#ef4444',
        model: 'gpt-4o',
        provider: 'openai',
        description: 'Driving growth and brand awareness',
        orchestrationStatus: 'paused',
        agents: [
            {
                id: 'growth-lead',
                name: 'Growth Lead',
                role: 'Acquisition & Retention',
                status: 'idle',
                skills: ['Growth Hacking', 'A/B Testing', 'Funnel Optimization', 'Retention'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'chart'
            },
            {
                id: 'brand-strategist',
                name: 'Brand Strategist',
                role: 'Brand Identity & Positioning',
                status: 'idle',
                skills: ['Brand Strategy', 'Positioning', 'Competitive Analysis', 'Messaging'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'star'
            },
            {
                id: 'analytics-expert',
                name: 'Analytics Expert',
                role: 'Data & Performance',
                status: 'idle',
                skills: ['Google Analytics', 'Data Analysis', 'Attribution', 'Reporting'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'analytics'
            }
        ]
    },
    gtm: {
        id: 'gtm',
        name: 'Go-to-Market Team',
        badge: 'GTM',
        color: '#10b981',
        model: 'claude-3-5-sonnet-latest',
        provider: 'anthropic',
        description: 'Planning and executing product launches',
        orchestrationStatus: 'paused',
        agents: [
            {
                id: 'launch-coordinator',
                name: 'Launch Coordinator',
                role: 'Launch Planning & Execution',
                status: 'idle',
                skills: ['Launch Strategy', 'Project Management', 'Timeline Planning', 'Stakeholder Management'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'rocket'
            },
            {
                id: 'partnership-manager',
                name: 'Partnership Manager',
                role: 'Strategic Partnerships',
                status: 'idle',
                skills: ['Business Development', 'Negotiations', 'Partner Relations', 'Co-marketing'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'handshake'
            },
            {
                id: 'market-researcher',
                name: 'Market Researcher',
                role: 'Market Intelligence',
                status: 'idle',
                skills: ['Market Research', 'Competitive Intelligence', 'Trend Analysis', 'Surveys'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'search'
            }
        ]
    },
    sales: {
        id: 'sales',
        name: 'Sales Team',
        badge: 'SLS',
        color: '#ec4899',
        model: 'gpt-4-turbo',
        provider: 'openai',
        description: 'Driving revenue and customer relationships',
        orchestrationStatus: 'paused',
        agents: [
            {
                id: 'sales-director',
                name: 'Sales Director',
                role: 'Revenue Strategy & Team Leadership',
                status: 'idle',
                skills: ['Sales Strategy', 'Revenue Operations', 'Team Leadership', 'Pipeline Management'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'user'
            },
            {
                id: 'account-executive',
                name: 'Account Executive',
                role: 'Enterprise Sales & Closing',
                status: 'idle',
                skills: ['Enterprise Sales', 'Contract Negotiation', 'Relationship Building', 'Closing Techniques'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'briefcase'
            },
            {
                id: 'sdr',
                name: 'SDR Lead',
                role: 'Outbound Prospecting & Lead Qualification',
                status: 'idle',
                skills: ['Prospecting', 'Lead Qualification', 'Cold Outreach', 'CRM Management'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'email'
            },
            {
                id: 'solutions-consultant',
                name: 'Solutions Consultant',
                role: 'Technical Sales & Demos',
                status: 'idle',
                skills: ['Technical Demos', 'Solution Architecture', 'Requirements Analysis', 'POC Management'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'monitor'
            },
            {
                id: 'customer-success',
                name: 'Customer Success Manager',
                role: 'Retention & Expansion',
                status: 'idle',
                skills: ['Customer Retention', 'Upselling', 'Onboarding', 'Health Scoring'],
                tasksCompleted: 0,
                currentTask: null,
                efficiency: 0,
                avatar: 'check'
            }
        ]
    }
};

// ============================================
// STATE MANAGEMENT
// All teams default to PAUSED - must be explicitly started
// ============================================

const state = {
    activeTeam: 'all',
    currentWorkspaceTeam: null,
    orchestrationMode: 'manual',  // DEFAULT: manual (all paused)
    teamOrchestrationState: {
        developer: { status: 'paused', lastRun: null },
        design: { status: 'paused', lastRun: null },
        communications: { status: 'paused', lastRun: null },
        legal: { status: 'paused', lastRun: null },
        marketing: { status: 'paused', lastRun: null },
        gtm: { status: 'paused', lastRun: null },
        sales: { status: 'paused', lastRun: null }
    },
    decisions: [],
    activities: [],  // Only real activities from orchestration
    communications: [],
    tasks: [],
    priorities: [],
    projects: [],
    liveFeed: [],  // Only real orchestration events
    liveFeedFilter: 'all',
    apiKeyConfig: {
        anthropic: { configured: false, model: 'claude-3-5-sonnet-latest' },
        openai: { configured: false, model: 'gpt-4o' },
        gemini: { configured: false, model: 'gemini-pro' }
    },
    healthMetrics: {
        lastCheck: null,
        systemStatus: 'idle'  // All teams paused by default
    },
    teamSettings: {},
    adminToken: null  // Set via API config for orchestration
};

// Initialize team settings
Object.keys(AgentTeams).forEach(teamId => {
    state.teamSettings[teamId] = {
        model: AgentTeams[teamId].model,
        provider: AgentTeams[teamId].provider,
        apiKeyConfigured: false
    };
});

// All data starts empty - only real orchestration creates activities
// No mock decisions, activities, or communications
state.decisions = [];
state.activities = [];
state.communications = [];
state.priorities = [];
state.projects = [];

// ============================================
// LIVE FEED - REAL DATA ONLY
// No fake data generation - all activities come from orchestration API
// ============================================

// Fetch real activities from orchestration API
async function fetchRealActivities(teamId) {
    try {
        const url = teamId && teamId !== 'all'
            ? `/api/orchestrate?teamId=${teamId}`
            : '/api/orchestrate?action=activities&limit=20';

        const response = await fetch(url);
        if (!response.ok) return [];

        const data = await response.json();
        if (data.success) {
            return teamId && teamId !== 'all'
                ? data.data.activities || []
                : data.data || [];
        }
        return [];
    } catch (error) {
        console.error('[LiveFeed] Failed to fetch activities:', error);
        return [];
    }
}

// Convert activity to live feed item format
function activityToFeedItem(activity) {
    return {
        id: activity.id,
        type: activity.tag?.toLowerCase() === 'started' ? 'action' :
              activity.tag?.toLowerCase() === 'paused' ? 'insight' : 'action',
        agent: activity.agent,
        agentId: activity.agentId || activity.agent.toLowerCase().replace(/\s+/g, '-'),
        team: activity.teamId,
        content: activity.message,
        highlights: [],
        timestamp: new Date(activity.timestamp),
        processed: true,
        isReal: true  // Flag indicating this is real data
    };
}

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
    // Views
    allTeamsView: document.getElementById('allTeamsView'),
    teamWorkspace: document.getElementById('teamWorkspace'),
    teamsGrid: document.getElementById('teamsGrid'),
    // Workspace elements
    workspaceHeader: document.getElementById('workspaceHeader'),
    workspaceBadge: document.getElementById('workspaceBadge'),
    workspaceName: document.getElementById('workspaceName'),
    workspaceStatus: document.getElementById('workspaceStatus'),
    agentsWorldGrid: document.getElementById('agentsWorldGrid'),
    connectionsCanvas: document.getElementById('connectionsCanvas'),
    liveFeedContainer: document.getElementById('liveFeedContainer'),
    // Stats
    teamAgentCount: document.getElementById('teamAgentCount'),
    teamWorkingCount: document.getElementById('teamWorkingCount'),
    teamTasksCompleted: document.getElementById('teamTasksCompleted'),
    teamEfficiency: document.getElementById('teamEfficiency'),
    teamModelName: document.getElementById('teamModelName'),
    // Global elements
    decisionQueue: document.getElementById('decisionQueue'),
    activityFeed: document.getElementById('activityFeed'),
    priorityQueue: document.getElementById('priorityQueue'),
    projectList: document.getElementById('projectList'),
    commsLog: document.getElementById('commsLog'),
    toastContainer: document.getElementById('toastContainer'),
    liveClock: document.getElementById('liveClock'),
    // Modals
    taskModal: document.getElementById('taskModal'),
    agentModal: document.getElementById('agentModal'),
    decisionModal: document.getElementById('decisionModal'),
    broadcastModal: document.getElementById('broadcastModal'),
    teamSettingsModal: document.getElementById('teamSettingsModal'),
    // Stats
    activeAgents: document.getElementById('activeAgents'),
    tasksInProgress: document.getElementById('tasksInProgress'),
    pendingDecisions: document.getElementById('pendingDecisions'),
    completedToday: document.getElementById('completedToday'),
    sidebarActiveAgents: document.getElementById('sidebarActiveAgents'),
    sidebarTasksCount: document.getElementById('sidebarTasksCount'),
    sidebarEfficiency: document.getElementById('sidebarEfficiency')
};

// ============================================
// RENDERING FUNCTIONS
// ============================================

function renderTeamsGrid() {
    if (!elements.teamsGrid) return;

    const teamColors = {
        developer: '#3b82f6',
        design: '#8b5cf6',
        communications: '#06b6d4',
        legal: '#f59e0b',
        marketing: '#ef4444',
        gtm: '#10b981',
        sales: '#ec4899'
    };

    elements.teamsGrid.innerHTML = Object.entries(AgentTeams).map(([teamId, team]) => {
        const workingCount = team.agents.filter(a => a.status === 'working').length;
        const totalTasks = team.agents.reduce((sum, a) => sum + a.tasksCompleted, 0);
        const avgEfficiency = Math.round(team.agents.reduce((sum, a) => sum + a.efficiency, 0) / team.agents.length);

        return `
            <div class="team-overview-card" data-team="${teamId}" onclick="openTeamWorkspace('${teamId}')">
                <div class="team-overview-header">
                    <div class="team-overview-badge" style="background: ${teamColors[teamId]}20; color: ${teamColors[teamId]}">${team.badge}</div>
                    <div class="team-overview-info">
                        <h3 class="team-overview-name">${team.name}</h3>
                        <span class="team-overview-desc">${team.description}</span>
                    </div>
                    <div class="team-overview-status">
                        <span class="status-dot ${workingCount > 0 ? 'online' : 'idle'}"></span>
                    </div>
                </div>
                <div class="team-overview-agents">
                    ${team.agents.map(agent => `
                        <div class="mini-agent ${agent.status}" title="${agent.name} - ${agent.status}">
                            <div class="mini-agent-avatar" style="background: ${teamColors[teamId]}30; border-color: ${teamColors[teamId]}">
                                ${agent.name.charAt(0)}
                            </div>
                            ${agent.status === 'working' ? '<span class="mini-agent-pulse"></span>' : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="team-overview-stats">
                    <div class="team-mini-stat">
                        <span class="team-mini-stat-value">${workingCount}/${team.agents.length}</span>
                        <span class="team-mini-stat-label">Active</span>
                    </div>
                    <div class="team-mini-stat">
                        <span class="team-mini-stat-value">${totalTasks}</span>
                        <span class="team-mini-stat-label">Tasks</span>
                    </div>
                    <div class="team-mini-stat">
                        <span class="team-mini-stat-value">${avgEfficiency}%</span>
                        <span class="team-mini-stat-label">Efficiency</span>
                    </div>
                </div>
                <div class="team-overview-model">
                    <span class="model-badge ${team.provider}">${team.model.split('-').slice(0, 2).join(' ')}</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderDecisionQueue() {
    if (!elements.decisionQueue) return;

    elements.decisionQueue.innerHTML = state.decisions.map(decision => `
        <div class="decision-item" data-decision-id="${decision.id}">
            <div class="decision-priority ${decision.priority}"></div>
            <div class="decision-info">
                <div class="decision-title">${decision.title}</div>
                <div class="decision-meta">
                    <span>From: ${decision.requestedBy}</span>
                    <span>${getRelativeTime(decision.timestamp)}</span>
                </div>
            </div>
            <button class="decision-action" onclick="openDecisionModal('${decision.id}')">Review</button>
        </div>
    `).join('');
}

function renderActivityFeed() {
    if (!elements.activityFeed) return;

    const teamColors = {
        developer: '#3b82f6',
        design: '#8b5cf6',
        communications: '#06b6d4',
        legal: '#f59e0b',
        marketing: '#ef4444',
        gtm: '#10b981',
        sales: '#ec4899'
    };

    elements.activityFeed.innerHTML = state.activities.map(activity => `
        <div class="activity-item fade-in">
            <div class="activity-avatar" style="background: ${teamColors[activity.team]}20">
                <svg viewBox="0 0 24 24" fill="${teamColors[activity.team]}">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
            </div>
            <div class="activity-content">
                <div class="activity-header">
                    <span class="activity-agent">${activity.agent}</span>
                    <span class="activity-time">${getRelativeTime(activity.timestamp)}</span>
                </div>
                <div class="activity-message">${activity.message}</div>
                <span class="activity-tag">${activity.tag}</span>
            </div>
        </div>
    `).join('');
}

function renderPriorityQueue() {
    if (!elements.priorityQueue) return;

    elements.priorityQueue.innerHTML = state.priorities.map((priority, index) => `
        <div class="priority-item" draggable="true" data-priority-id="${priority.id}">
            <span class="priority-rank">${index + 1}</span>
            <div class="priority-info">
                <span class="priority-name">${priority.name}</span>
                <span class="priority-team">${priority.team}</span>
            </div>
            <span class="drag-handle">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </span>
        </div>
    `).join('');
}

function renderProjectList() {
    if (!elements.projectList) return;

    elements.projectList.innerHTML = state.projects.map(project => `
        <div class="project-item" data-project-id="${project.id}">
            <div class="project-info">
                <span class="project-name">${project.name}</span>
                <span class="project-teams">${project.teams.join(', ')}</span>
            </div>
        </div>
    `).join('');
}

function renderCommsLog(filter = 'all') {
    if (!elements.commsLog) return;

    const teamColors = {
        developer: '#3b82f6',
        design: '#8b5cf6',
        communications: '#06b6d4',
        legal: '#f59e0b',
        marketing: '#ef4444',
        gtm: '#10b981',
        sales: '#ec4899'
    };

    const filtered = filter === 'all'
        ? state.communications
        : state.communications.filter(c => c.from.team === filter || c.to.team === filter);

    elements.commsLog.innerHTML = filtered.map(comm => `
        <div class="comms-item fade-in">
            <div class="comms-header">
                <div class="comms-participants">
                    <span class="comms-from" style="color: ${teamColors[comm.from.team]}">${comm.from.agent}</span>
                    <span class="comms-arrow">→</span>
                    <span class="comms-to" style="color: ${teamColors[comm.to.team]}">${comm.to.agent}</span>
                </div>
                <span class="comms-time">${getRelativeTime(comm.timestamp)}</span>
            </div>
            <div class="comms-message">${comm.message}</div>
        </div>
    `).join('');
}

function updateStats() {
    let totalAgents = 0;
    let activeCount = 0;
    let tasksCount = 0;
    let totalEfficiency = 0;

    Object.values(AgentTeams).forEach(team => {
        team.agents.forEach(agent => {
            totalAgents++;
            totalEfficiency += agent.efficiency || 0;
            if (agent.status === 'working') {
                activeCount++;
                tasksCount++;
            }
        });
    });

    const avgEfficiency = totalAgents > 0 ? Math.round(totalEfficiency / totalAgents) : 0;

    if (elements.activeAgents) elements.activeAgents.textContent = activeCount.toString();
    if (elements.tasksInProgress) elements.tasksInProgress.textContent = tasksCount;
    if (elements.pendingDecisions) elements.pendingDecisions.textContent = state.decisions.length;
    if (elements.completedToday) elements.completedToday.textContent = '24';

    // Sidebar stats
    if (elements.sidebarActiveAgents) elements.sidebarActiveAgents.textContent = activeCount;
    if (elements.sidebarTasksCount) elements.sidebarTasksCount.textContent = tasksCount;
    if (elements.sidebarEfficiency) elements.sidebarEfficiency.textContent = `${avgEfficiency}%`;

    state.healthMetrics.lastCheck = new Date().toISOString();
    state.healthMetrics.systemStatus = activeCount > 0 ? 'operational' : 'idle';
}

// ============================================
// TEAM WORKSPACE FUNCTIONS
// ============================================

function openTeamWorkspace(teamId) {
    const team = AgentTeams[teamId];
    if (!team) return;

    state.currentWorkspaceTeam = teamId;
    state.activeTeam = teamId;

    // Update nav buttons
    document.querySelectorAll('.team-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.team === teamId);
    });

    // Switch views
    if (elements.allTeamsView) elements.allTeamsView.style.display = 'none';
    if (elements.teamWorkspace) elements.teamWorkspace.style.display = 'block';

    // Update workspace header
    const teamColors = {
        developer: '#3b82f6',
        design: '#8b5cf6',
        communications: '#06b6d4',
        legal: '#f59e0b',
        marketing: '#ef4444',
        gtm: '#10b981',
        sales: '#ec4899'
    };

    if (elements.workspaceBadge) {
        elements.workspaceBadge.textContent = team.badge;
        elements.workspaceBadge.style.background = `${teamColors[teamId]}20`;
        elements.workspaceBadge.style.color = teamColors[teamId];
    }

    if (elements.workspaceName) elements.workspaceName.textContent = team.name;

    const workingCount = team.agents.filter(a => a.status === 'working').length;
    if (elements.workspaceStatus) {
        elements.workspaceStatus.innerHTML = `
            <span class="status-dot ${workingCount > 0 ? 'online' : 'idle'}"></span>
            ${workingCount}/${team.agents.length} agents active
        `;
    }

    // Update team stats
    const totalTasks = team.agents.reduce((sum, a) => sum + a.tasksCompleted, 0);
    const avgEfficiency = Math.round(team.agents.reduce((sum, a) => sum + a.efficiency, 0) / team.agents.length);

    if (elements.teamAgentCount) elements.teamAgentCount.textContent = team.agents.length;
    if (elements.teamWorkingCount) elements.teamWorkingCount.textContent = workingCount;
    if (elements.teamTasksCompleted) elements.teamTasksCompleted.textContent = totalTasks;
    if (elements.teamEfficiency) elements.teamEfficiency.textContent = `${avgEfficiency}%`;
    if (elements.teamModelName) {
        const modelShort = team.model.split('-').slice(0, 2).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
        elements.teamModelName.textContent = modelShort;
    }

    // Render agent world
    renderAgentWorld(teamId);

    // Start live feed for this team
    startTeamLiveFeed(teamId);
}

function closeTeamWorkspace() {
    state.currentWorkspaceTeam = null;
    state.activeTeam = 'all';

    // Update nav buttons
    document.querySelectorAll('.team-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.team === 'all');
    });

    // Switch views
    if (elements.allTeamsView) elements.allTeamsView.style.display = 'block';
    if (elements.teamWorkspace) elements.teamWorkspace.style.display = 'none';

    // Clear live feed
    state.liveFeed = [];
}

function renderAgentWorld(teamId) {
    const team = AgentTeams[teamId];
    if (!team || !elements.agentsWorldGrid) return;

    const teamColors = {
        developer: '#3b82f6',
        design: '#8b5cf6',
        communications: '#06b6d4',
        legal: '#f59e0b',
        marketing: '#ef4444',
        gtm: '#10b981',
        sales: '#ec4899'
    };

    const color = teamColors[teamId];

    elements.agentsWorldGrid.innerHTML = team.agents.map((agent, index) => `
        <div class="agent-world-node ${agent.status}" data-agent="${agent.id}" onclick="openAgentModal('${teamId}', '${agent.id}')" style="--agent-color: ${color}; --agent-index: ${index}">
            <div class="agent-node-glow"></div>
            <div class="agent-node-avatar">
                <span class="agent-initial">${agent.name.charAt(0)}</span>
                ${agent.status === 'working' ? '<div class="agent-node-pulse"></div>' : ''}
            </div>
            <div class="agent-node-info">
                <span class="agent-node-name">${agent.name}</span>
                <span class="agent-node-role">${agent.role}</span>
            </div>
            <div class="agent-node-status">
                <span class="agent-node-status-badge ${agent.status}">
                    ${agent.status === 'working' ? 'Working' : 'Standby'}
                </span>
            </div>
            ${agent.currentTask ? `
                <div class="agent-node-task">
                    <span class="task-indicator"></span>
                    <span class="task-text">${agent.currentTask}</span>
                </div>
            ` : ''}
            <div class="agent-node-metrics">
                <div class="metric">
                    <span class="metric-value">${agent.tasksCompleted}</span>
                    <span class="metric-label">Tasks</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${agent.efficiency}%</span>
                    <span class="metric-label">Efficiency</span>
                </div>
            </div>
        </div>
    `).join('');

    // Draw connections
    setTimeout(() => drawAgentConnections(teamId), 100);
}

function drawAgentConnections(teamId) {
    const canvas = elements.connectionsCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const container = elements.agentsWorldGrid;

    // Set canvas size
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const nodes = container.querySelectorAll('.agent-world-node');
    if (nodes.length < 2) return;

    const teamColors = {
        developer: '#3b82f6',
        design: '#8b5cf6',
        communications: '#06b6d4',
        legal: '#f59e0b',
        marketing: '#ef4444',
        gtm: '#10b981',
        sales: '#ec4899'
    };

    const color = teamColors[teamId] || '#ffffff';

    // Draw connections between working agents
    const workingNodes = [...nodes].filter(n => n.classList.contains('working'));

    workingNodes.forEach((node, i) => {
        workingNodes.forEach((otherNode, j) => {
            if (i >= j) return;

            const rect1 = node.getBoundingClientRect();
            const rect2 = otherNode.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            const x1 = rect1.left - containerRect.left + rect1.width / 2;
            const y1 = rect1.top - containerRect.top + rect1.height / 2;
            const x2 = rect2.left - containerRect.left + rect2.width / 2;
            const y2 = rect2.top - containerRect.top + rect2.height / 2;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `${color}40`;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();

            // Animated dot
            const progress = (Date.now() % 2000) / 2000;
            const dotX = x1 + (x2 - x1) * progress;
            const dotY = y1 + (y2 - y1) * progress;

            ctx.beginPath();
            ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        });
    });
}

// ============================================
// LIVE FEED FUNCTIONS
// ============================================

let liveFeedInterval = null;

async function startTeamLiveFeed(teamId) {
    // Clear existing interval
    if (liveFeedInterval) {
        clearInterval(liveFeedInterval);
    }

    // Clear existing feed
    state.liveFeed = [];

    // Fetch real activities from API
    const activities = await fetchRealActivities(teamId);
    state.liveFeed = activities.map(activityToFeedItem);

    renderLiveFeed();

    // Poll for new activities (real data only)
    liveFeedInterval = setInterval(async () => {
        if (state.currentWorkspaceTeam === teamId) {
            const newActivities = await fetchRealActivities(teamId);
            if (newActivities.length > 0) {
                // Only add truly new items
                const existingIds = new Set(state.liveFeed.map(f => f.id));
                const newItems = newActivities
                    .filter(a => !existingIds.has(a.id))
                    .map(activityToFeedItem);

                if (newItems.length > 0) {
                    state.liveFeed = [...newItems, ...state.liveFeed].slice(0, 20);
                    renderLiveFeed();
                }
            }
        }
    }, 5000);  // Poll every 5 seconds
}

function renderLiveFeed() {
    if (!elements.liveFeedContainer) return;

    const filteredFeed = state.liveFeedFilter === 'all'
        ? state.liveFeed
        : state.liveFeed.filter(item => item.type === state.liveFeedFilter);

    const teamColors = {
        developer: '#3b82f6',
        design: '#8b5cf6',
        communications: '#06b6d4',
        legal: '#f59e0b',
        marketing: '#ef4444',
        gtm: '#10b981',
        sales: '#ec4899'
    };

    const typeIcons = {
        thinking: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
        action: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>`,
        comms: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>`,
        insight: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>`
    };

    elements.liveFeedContainer.innerHTML = filteredFeed.map(item => {
        const color = teamColors[item.team] || '#ffffff';
        const highlightedContent = item.highlights.reduce((content, highlight) => {
            return content.replace(new RegExp(`(${highlight})`, 'gi'), `<span class="feed-highlight">$1</span>`);
        }, item.content);

        return `
            <div class="live-feed-item ${item.type} fade-in" style="--feed-color: ${color}">
                <div class="feed-item-indicator">
                    <span class="feed-type-icon">${typeIcons[item.type]}</span>
                </div>
                <div class="feed-item-content">
                    <div class="feed-item-header">
                        <span class="feed-agent">${item.agent}</span>
                        <span class="feed-type-badge ${item.type}">${item.type}</span>
                        <span class="feed-time">${getRelativeTime(item.timestamp)}</span>
                    </div>
                    <div class="feed-item-message">${highlightedContent}</div>
                    ${item.processed ? '<span class="feed-processed">Processed</span>' : '<span class="feed-processing">Processing...</span>'}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// TEAM FILTERING
// ============================================

function filterTeams(teamId) {
    if (teamId === 'all') {
        closeTeamWorkspace();
    } else {
        openTeamWorkspace(teamId);
    }
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openModal(modalElement) {
    if (modalElement) {
        modalElement.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function openDecisionModal(decisionId) {
    const decision = state.decisions.find(d => d.id === decisionId);
    if (!decision) return;

    const content = document.getElementById('decisionContent');
    if (content) {
        content.innerHTML = `
            <div class="decision-summary">
                <h3>${decision.title}</h3>
                <p>${decision.description}</p>
            </div>
            <div class="decision-details">
                ${Object.entries(decision.details).map(([key, value]) => `
                    <div class="decision-detail-row">
                        <span class="decision-detail-label">${key}</span>
                        <span class="decision-detail-value">${value}</span>
                    </div>
                `).join('')}
            </div>
            <div class="decision-impact">
                <h4>Impact Analysis</h4>
                <p>${decision.impact}</p>
            </div>
        `;
    }

    elements.decisionModal.dataset.currentDecision = decisionId;
    openModal(elements.decisionModal);
}

function openAgentModal(teamId, agentId) {
    const team = AgentTeams[teamId];
    if (!team) return;

    const agent = team.agents.find(a => a.id === agentId);
    if (!agent) return;

    const teamColors = {
        developer: '#3b82f6',
        design: '#8b5cf6',
        communications: '#06b6d4',
        legal: '#f59e0b',
        marketing: '#ef4444',
        gtm: '#10b981',
        sales: '#ec4899'
    };

    const title = document.getElementById('agentModalTitle');
    const content = document.getElementById('agentDetailContent');

    if (title) title.textContent = agent.name;

    if (content) {
        content.innerHTML = `
            <div class="agent-detail-header">
                <div class="agent-detail-avatar" style="background: ${teamColors[teamId]}20">
                    <svg viewBox="0 0 24 24" fill="${teamColors[teamId]}">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                    </svg>
                </div>
                <div class="agent-detail-info">
                    <h3>${agent.name}</h3>
                    <p>${agent.role} • ${team.name}</p>
                </div>
            </div>
            <div class="agent-stats">
                <div class="agent-stat">
                    <span class="agent-stat-value">${agent.tasksCompleted}</span>
                    <span class="agent-stat-label">Tasks Completed</span>
                </div>
                <div class="agent-stat">
                    <span class="agent-stat-value">${agent.efficiency}%</span>
                    <span class="agent-stat-label">Efficiency</span>
                </div>
                <div class="agent-stat">
                    <span class="agent-stat-value" style="color: ${agent.status === 'working' ? '#3b82f6' : '#94a3b8'}">${agent.status === 'working' ? 'Active' : 'Idle'}</span>
                    <span class="agent-stat-label">Status</span>
                </div>
            </div>
            <div class="form-group">
                <label>Skills</label>
                <div class="agent-checkboxes">
                    ${agent.skills.map(skill => `<span class="checkbox-label" style="cursor: default;">${skill}</span>`).join('')}
                </div>
            </div>
            <div class="agent-model-info">
                <label>AI Model</label>
                <div class="model-info-card">
                    <span class="model-provider ${team.provider}">${team.provider}</span>
                    <span class="model-name">${team.model}</span>
                </div>
            </div>
            ${agent.currentTask ? `
                <div class="agent-tasks-section">
                    <h4>Current Task</h4>
                    <div class="agent-task-list">
                        <div class="agent-task-item">
                            <span class="agent-task-status in-progress"></span>
                            <span class="agent-task-name">${agent.currentTask}</span>
                            <span class="agent-task-time">In Progress</span>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
    }

    openModal(elements.agentModal);
}

function openTeamSettingsModal(teamId) {
    const team = AgentTeams[teamId];
    if (!team) return;

    const title = document.getElementById('teamSettingsTitle');
    const content = document.getElementById('teamSettingsContent');

    if (title) title.textContent = `${team.name} Settings`;

    if (content) {
        content.innerHTML = `
            <div class="team-settings-section">
                <h3 class="settings-section-title">AI Model Configuration</h3>
                <div class="form-group">
                    <label for="teamProvider">AI Provider</label>
                    <select id="teamProvider" onchange="updateTeamModelOptions('${teamId}')">
                        <option value="anthropic" ${team.provider === 'anthropic' ? 'selected' : ''}>Anthropic (Claude)</option>
                        <option value="openai" ${team.provider === 'openai' ? 'selected' : ''}>OpenAI (GPT)</option>
                        <option value="gemini" ${team.provider === 'gemini' ? 'selected' : ''}>Google (Gemini)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="teamModel">Model</label>
                    <select id="teamModel">
                        ${getModelOptions(team.provider, team.model)}
                    </select>
                </div>
                <div class="api-key-status">
                    <span class="api-key-label">API Key Status:</span>
                    <span class="api-key-badge ${state.apiKeyConfig[team.provider].configured ? 'configured' : 'not-configured'}">
                        ${state.apiKeyConfig[team.provider].configured ? 'Configured' : 'Not Configured'}
                    </span>
                </div>
            </div>
            <div class="team-settings-section">
                <h3 class="settings-section-title">Team Performance</h3>
                <div class="performance-metrics">
                    <div class="perf-metric">
                        <span class="perf-metric-label">Avg Response Time</span>
                        <span class="perf-metric-value">1.2s</span>
                    </div>
                    <div class="perf-metric">
                        <span class="perf-metric-label">Tasks/Hour</span>
                        <span class="perf-metric-value">8.5</span>
                    </div>
                    <div class="perf-metric">
                        <span class="perf-metric-label">Success Rate</span>
                        <span class="perf-metric-value">96%</span>
                    </div>
                </div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="closeModal(elements.teamSettingsModal)">Cancel</button>
                <button type="button" class="btn-primary" onclick="saveTeamSettings('${teamId}')">Save Settings</button>
            </div>
        `;
    }

    openModal(elements.teamSettingsModal);
}

function getModelOptions(provider, selectedModel) {
    const models = {
        anthropic: [
            { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (Fast)' },
            { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet (Balanced)' },
            { value: 'claude-3-opus-latest', label: 'Claude 3 Opus (Powerful)' }
        ],
        openai: [
            { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)' },
            { value: 'gpt-4o', label: 'GPT-4o (Balanced)' },
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (Powerful)' }
        ],
        gemini: [
            { value: 'gemini-pro', label: 'Gemini Pro' },
            { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
            { value: 'gemini-pro-vision', label: 'Gemini Pro Vision' }
        ]
    };

    return models[provider].map(m =>
        `<option value="${m.value}" ${m.value === selectedModel ? 'selected' : ''}>${m.label}</option>`
    ).join('');
}

function updateTeamModelOptions(teamId) {
    const providerSelect = document.getElementById('teamProvider');
    const modelSelect = document.getElementById('teamModel');
    if (!providerSelect || !modelSelect) return;

    modelSelect.innerHTML = getModelOptions(providerSelect.value, '');
}

function saveTeamSettings(teamId) {
    const providerSelect = document.getElementById('teamProvider');
    const modelSelect = document.getElementById('teamModel');

    if (providerSelect && modelSelect) {
        state.teamSettings[teamId] = {
            provider: providerSelect.value,
            model: modelSelect.value,
            apiKeyConfigured: state.apiKeyConfig[providerSelect.value].configured
        };

        AgentTeams[teamId].provider = providerSelect.value;
        AgentTeams[teamId].model = modelSelect.value;

        // Update the display
        if (state.currentWorkspaceTeam === teamId && elements.teamModelName) {
            const modelShort = modelSelect.value.split('-').slice(0, 2).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
            elements.teamModelName.textContent = modelShort;
        }

        showToast('success', 'Settings Saved', `${AgentTeams[teamId].name} configuration updated successfully.`);
    }

    closeModal(elements.teamSettingsModal);
}

// ============================================
// DECISION ACTIONS
// ============================================

function approveDecision() {
    const decisionId = elements.decisionModal?.dataset.currentDecision;
    if (!decisionId) return;

    const decision = state.decisions.find(d => d.id === decisionId);
    if (decision) {
        state.activities.unshift({
            id: `act-${Date.now()}`,
            agent: 'Commander',
            team: decision.team,
            message: `Approved: ${decision.title}`,
            tag: 'Approved',
            timestamp: new Date()
        });

        state.decisions = state.decisions.filter(d => d.id !== decisionId);

        renderDecisionQueue();
        renderActivityFeed();
        updateStats();
        showToast('success', 'Decision Approved', `${decision.title} has been approved and teams notified.`);
    }

    closeModal(elements.decisionModal);
}

function rejectDecision() {
    const decisionId = elements.decisionModal?.dataset.currentDecision;
    if (!decisionId) return;

    const decision = state.decisions.find(d => d.id === decisionId);
    if (decision) {
        state.activities.unshift({
            id: `act-${Date.now()}`,
            agent: 'Commander',
            team: decision.team,
            message: `Rejected: ${decision.title}`,
            tag: 'Rejected',
            timestamp: new Date()
        });

        state.decisions = state.decisions.filter(d => d.id !== decisionId);

        renderDecisionQueue();
        renderActivityFeed();
        updateStats();
        showToast('error', 'Decision Rejected', `${decision.title} has been rejected.`);
    }

    closeModal(elements.decisionModal);
}

function deferDecision() {
    const decisionId = elements.decisionModal?.dataset.currentDecision;
    if (!decisionId) return;

    const decision = state.decisions.find(d => d.id === decisionId);
    if (decision) {
        showToast('info', 'Decision Deferred', `${decision.title} has been deferred for later review.`);
    }

    closeModal(elements.decisionModal);
}

// ============================================
// TASK CREATION
// ============================================

function handleTaskSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('taskTitle')?.value;
    const description = document.getElementById('taskDescription')?.value;
    const priority = document.getElementById('taskPriority')?.value;
    const team = document.getElementById('taskTeam')?.value;

    if (!title || !team) return;

    state.activities.unshift({
        id: `act-${Date.now()}`,
        agent: 'Commander',
        team: team,
        message: `Created new task: ${title}`,
        tag: 'Task Created',
        timestamp: new Date()
    });

    renderActivityFeed();
    showToast('success', 'Task Created', `"${title}" has been assigned to ${AgentTeams[team]?.name || team}.`);
    closeModal(elements.taskModal);

    e.target.reset();
}

// ============================================
// BROADCAST
// ============================================

function handleBroadcastSubmit(e) {
    e.preventDefault();

    const message = document.getElementById('broadcastMessage')?.value;
    const priority = document.getElementById('broadcastPriority')?.value;

    if (!message) return;

    state.activities.unshift({
        id: `act-${Date.now()}`,
        agent: 'Commander',
        team: 'all',
        message: `Broadcast: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
        tag: priority === 'urgent' ? 'Urgent' : priority === 'important' ? 'Important' : 'Info',
        timestamp: new Date()
    });

    renderActivityFeed();
    showToast('success', 'Broadcast Sent', 'Your message has been sent to all agents.');
    closeModal(elements.broadcastModal);

    e.target.reset();
}

// ============================================
// ORCHESTRATION MODE
// ============================================

function setOrchestrationMode(mode) {
    state.orchestrationMode = mode;

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const modeDescriptions = {
        autonomous: 'Agents operate independently with periodic check-ins',
        supervised: 'Major decisions require your approval before execution',
        manual: 'All agent actions require explicit approval'
    };

    showToast('info', 'Mode Changed', modeDescriptions[mode]);
}

// ============================================
// SYNC ALL
// ============================================

function syncAll() {
    showToast('info', 'Syncing...', 'Synchronizing all agent states and tasks.');

    document.querySelectorAll('.team-card, .team-overview-card, .agent-world-node').forEach((card, index) => {
        setTimeout(() => {
            card.style.transform = 'scale(0.98)';
            setTimeout(() => {
                card.style.transform = '';
            }, 150);
        }, index * 50);
    });

    setTimeout(() => {
        showToast('success', 'Sync Complete', 'All agents and tasks are synchronized.');
    }, 1500);
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(type, title, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>',
        error: '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>',
        info: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>',
        warning: '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>'
    };

    toast.innerHTML = `
        <div class="toast-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">${icons[type]}</svg>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
        </button>
    `;

    elements.toastContainer?.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('exiting');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getRelativeTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function updateAgentCheckboxes(teamId) {
    const container = document.getElementById('agentCheckboxes');
    if (!container) return;

    const team = AgentTeams[teamId];
    if (!team) return;

    container.innerHTML = team.agents.map(agent => `
        <label class="checkbox-label">
            <input type="checkbox" value="${agent.id}" checked> ${agent.name}
        </label>
    `).join('');
}

function updateClock() {
    if (elements.liveClock) {
        const now = new Date();
        elements.liveClock.textContent = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }
}

// ============================================
// API CONFIGURATION FUNCTIONS
// ============================================

function saveApiConfig(provider) {
    const keyInput = document.getElementById(`${provider}Key`);
    const modelSelect = document.getElementById(`${provider}Model`);

    if (!keyInput || !modelSelect) return;

    const apiKey = keyInput.value.trim();
    const model = modelSelect.value;

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
        model: model
    };

    const statusEl = document.getElementById(`${provider}Status`);
    if (statusEl) {
        statusEl.textContent = 'Configured';
        statusEl.classList.add('configured');
    }

    keyInput.value = '';

    state.activities.unshift({
        id: `act-${Date.now()}`,
        agent: 'Commander',
        team: 'system',
        message: `Updated ${provider} API configuration to ${model}`,
        tag: 'Config',
        timestamp: new Date()
    });
    renderActivityFeed();

    showToast('success', 'Configuration Saved', `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key configured successfully`);
}

function runHealthCheck() {
    showToast('info', 'Health Check', 'Running system health check...');

    const startTime = performance.now();

    setTimeout(() => {
        const latency = Math.round(performance.now() - startTime);

        state.healthMetrics.lastCheck = new Date().toISOString();
        state.healthMetrics.systemStatus = 'operational';

        const apiLatencyEl = document.getElementById('apiLatency');
        const lastCheckEl = document.getElementById('lastHealthCheck');
        const systemStatusEl = document.getElementById('systemStatus');

        if (apiLatencyEl) apiLatencyEl.textContent = `${latency} ms`;
        if (lastCheckEl) lastCheckEl.textContent = 'Just now';
        if (systemStatusEl) {
            systemStatusEl.textContent = 'Operational';
            systemStatusEl.className = 'health-value status-good';
        }

        state.activities.unshift({
            id: `act-${Date.now()}`,
            agent: 'System',
            team: 'system',
            message: `Health check completed - All systems operational (${latency}ms latency)`,
            tag: 'Health',
            timestamp: new Date()
        });
        renderActivityFeed();

        showToast('success', 'Health Check Complete', `System operational - ${latency}ms latency`);
    }, 500);
}

function initApiConfigPanel() {
    document.querySelectorAll('.api-config-header').forEach(header => {
        header.addEventListener('click', () => {
            const toggle = header.querySelector('.api-config-toggle');
            const body = header.nextElementSibling;

            if (toggle && body) {
                const isExpanded = toggle.dataset.expanded === 'true';
                toggle.dataset.expanded = isExpanded ? 'false' : 'true';
                body.style.display = isExpanded ? 'none' : 'block';
            }
        });
    });

    Object.entries(state.apiKeyConfig).forEach(([provider, config]) => {
        const statusEl = document.getElementById(`${provider}Status`);
        if (statusEl && config.configured) {
            statusEl.textContent = 'Configured';
            statusEl.classList.add('configured');
        }
    });
}

// ============================================
// ORCHESTRATION CONTROLS
// ============================================

/**
 * Start orchestration for a team
 */
async function startTeamOrchestration(teamId) {
    if (!state.adminToken) {
        showToast('error', 'Admin Token Required', 'Configure admin token in API Settings to orchestrate teams.');
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
            updateTeamOrchestrationUI(teamId);
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

/**
 * Stop orchestration for a team
 */
async function stopTeamOrchestration(teamId) {
    if (!state.adminToken) {
        showToast('error', 'Admin Token Required', 'Configure admin token in API Settings');
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

            // Set all agents to idle
            AgentTeams[teamId].agents.forEach(agent => {
                agent.status = 'idle';
                agent.currentTask = null;
            });

            showToast('info', 'Orchestration Paused', `${AgentTeams[teamId].name} is now paused`);
            updateTeamOrchestrationUI(teamId);
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

/**
 * Execute one orchestration cycle for a team
 */
async function executeTeamOrchestration(teamId, task = null) {
    if (!state.adminToken) {
        showToast('error', 'Admin Token Required', 'Configure admin token in API Settings');
        return null;
    }

    // Check if team is running
    if (state.teamOrchestrationState[teamId]?.status !== 'running') {
        showToast('warning', 'Not Running', 'Start team orchestration first');
        return null;
    }

    try {
        showToast('info', 'Executing...', `Running ${AgentTeams[teamId].name} orchestration cycle`);

        const response = await fetch('/api/orchestrate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.adminToken}`
            },
            body: JSON.stringify({ teamId, action: 'execute', task })
        });

        const data = await response.json();

        if (data.success) {
            const result = data.data;

            // Update activities
            if (result.activities && result.activities.length > 0) {
                state.activities = [...result.activities, ...state.activities].slice(0, 50);
                state.liveFeed = result.activities.map(activityToFeedItem).concat(state.liveFeed).slice(0, 20);
                renderLiveFeed();
                renderActivityFeed();
            }

            // Update agent statuses based on activities
            result.activities?.forEach(activity => {
                const agent = AgentTeams[teamId].agents.find(a =>
                    a.name.toLowerCase() === activity.agent.toLowerCase()
                );
                if (agent) {
                    agent.status = 'working';
                    agent.currentTask = activity.message;
                    agent.tasksCompleted++;
                }
            });

            showToast('success', 'Orchestration Complete', `Used ${result.usage?.outputTokens || 0} tokens`);
            updateTeamOrchestrationUI(teamId);
            renderTeamsGrid();
            return result;
        } else {
            showToast('error', 'Execution Failed', data.error || 'Orchestration failed');
            return null;
        }
    } catch (error) {
        console.error('[Orchestration] Execute error:', error);
        showToast('error', 'Execution Error', 'Orchestration execution failed');
        return null;
    }
}

/**
 * Toggle orchestration for a team (start/stop)
 */
async function toggleTeamOrchestration(teamId) {
    const isRunning = state.teamOrchestrationState[teamId]?.status === 'running';
    if (isRunning) {
        await stopTeamOrchestration(teamId);
    } else {
        await startTeamOrchestration(teamId);
    }
}

/**
 * Fetch orchestration status from API
 */
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

            return data.data;
        }
    } catch (error) {
        console.error('[Orchestration] Status fetch error:', error);
    }
    return null;
}

/**
 * Update UI to reflect team orchestration state
 */
function updateTeamOrchestrationUI(teamId) {
    const team = AgentTeams[teamId];
    if (!team) return;

    const isRunning = state.teamOrchestrationState[teamId]?.status === 'running';

    // Update team workspace if viewing this team
    if (state.currentWorkspaceTeam === teamId) {
        // Update agent nodes
        team.agents.forEach(agent => {
            const agentNode = document.querySelector(`.agent-node[data-agent="${agent.id}"]`);
            if (agentNode) {
                agentNode.className = `agent-node ${agent.status}`;
            }
        });
    }

    // Update team card in grid
    const teamCard = document.querySelector(`.team-card[data-team="${teamId}"]`);
    if (teamCard) {
        const statusIndicator = teamCard.querySelector('.team-status-indicator');
        if (statusIndicator) {
            statusIndicator.textContent = isRunning ? 'Running' : 'Paused';
            statusIndicator.className = `team-status-indicator ${isRunning ? 'running' : 'paused'}`;
        }
    }

    // Update sidebar team item
    const teamItem = document.querySelector(`.team-nav-btn[data-team="${teamId}"]`);
    if (teamItem) {
        teamItem.classList.toggle('running', isRunning);
    }
}

/**
 * Save admin token to state
 */
function saveAdminToken(token) {
    if (token && token.length >= 32) {
        state.adminToken = token;
        localStorage.setItem('fuse_admin_token', token);
        showToast('success', 'Token Saved', 'Admin token configured for orchestration');
        return true;
    } else {
        showToast('error', 'Invalid Token', 'Admin token must be at least 32 characters');
        return false;
    }
}

/**
 * Load admin token from storage
 */
function loadAdminToken() {
    const token = localStorage.getItem('fuse_admin_token');
    if (token) {
        state.adminToken = token;
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Load admin token from storage
    loadAdminToken();

    // Fetch orchestration status on load
    fetchOrchestrationStatus();
    // Initial renders
    renderTeamsGrid();
    renderDecisionQueue();
    renderActivityFeed();
    renderPriorityQueue();
    renderProjectList();
    renderCommsLog();
    updateStats();

    // Initialize API config panel
    initApiConfigPanel();

    // Start clock
    updateClock();
    setInterval(updateClock, 1000);

    // Team navigation
    document.querySelectorAll('.team-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => filterTeams(btn.dataset.team));
    });

    // Back button
    document.getElementById('backToAllTeams')?.addEventListener('click', closeTeamWorkspace);

    // Team settings button
    document.getElementById('teamSettingsBtn')?.addEventListener('click', () => {
        if (state.currentWorkspaceTeam) {
            openTeamSettingsModal(state.currentWorkspaceTeam);
        }
    });

    // Live feed filters
    document.querySelectorAll('.feed-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.feed-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.liveFeedFilter = btn.dataset.filter;
            renderLiveFeed();
        });
    });

    // Panel tabs
    document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const tabId = tab.dataset.tab + 'Tab';
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.classList.add('active');
            }
        });
    });

    // Orchestration mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setOrchestrationMode(btn.dataset.mode));
    });

    // Quick actions
    document.getElementById('newTaskBtn')?.addEventListener('click', () => {
        updateAgentCheckboxes('developer');
        openModal(elements.taskModal);
    });

    document.getElementById('broadcastBtn')?.addEventListener('click', () => {
        openModal(elements.broadcastModal);
    });

    document.getElementById('syncAllBtn')?.addEventListener('click', syncAll);

    // Modal close buttons
    document.getElementById('closeTaskModal')?.addEventListener('click', () => closeModal(elements.taskModal));
    document.getElementById('closeAgentModal')?.addEventListener('click', () => closeModal(elements.agentModal));
    document.getElementById('closeDecisionModal')?.addEventListener('click', () => closeModal(elements.decisionModal));
    document.getElementById('closeBroadcastModal')?.addEventListener('click', () => closeModal(elements.broadcastModal));
    document.getElementById('closeTeamSettingsModal')?.addEventListener('click', () => closeModal(elements.teamSettingsModal));
    document.getElementById('cancelTask')?.addEventListener('click', () => closeModal(elements.taskModal));
    document.getElementById('cancelBroadcast')?.addEventListener('click', () => closeModal(elements.broadcastModal));

    // Decision actions
    document.getElementById('approveDecision')?.addEventListener('click', approveDecision);
    document.getElementById('rejectDecision')?.addEventListener('click', rejectDecision);
    document.getElementById('deferDecision')?.addEventListener('click', deferDecision);

    // Form submissions
    document.getElementById('taskForm')?.addEventListener('submit', handleTaskSubmit);
    document.getElementById('broadcastForm')?.addEventListener('submit', handleBroadcastSubmit);

    // Team selector for task form
    document.getElementById('taskTeam')?.addEventListener('change', (e) => {
        updateAgentCheckboxes(e.target.value);
    });

    // Communications filter
    document.getElementById('commsTeamFilter')?.addEventListener('change', (e) => {
        renderCommsLog(e.target.value);
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(overlay);
            }
        });
    });

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                closeModal(modal);
            });
        }
    });

    // Real activities only - no random generation
    // Activities come from real orchestration via /api/orchestrate

    // Redraw connections on resize
    window.addEventListener('resize', () => {
        if (state.currentWorkspaceTeam) {
            drawAgentConnections(state.currentWorkspaceTeam);
        }
    });

    // Animate connections periodically
    setInterval(() => {
        if (state.currentWorkspaceTeam) {
            drawAgentConnections(state.currentWorkspaceTeam);
        }
    }, 50);
});

// ============================================
// DRAG AND DROP FOR PRIORITY QUEUE
// ============================================

let draggedItem = null;

document.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('priority-item')) {
        draggedItem = e.target;
        e.target.style.opacity = '0.5';
    }
});

document.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('priority-item')) {
        e.target.style.opacity = '';
        draggedItem = null;
    }
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.priority-item');
    if (target && draggedItem && target !== draggedItem) {
        const container = target.parentNode;
        const items = [...container.querySelectorAll('.priority-item')];
        const draggedIndex = items.indexOf(draggedItem);
        const targetIndex = items.indexOf(target);

        if (draggedIndex < targetIndex) {
            container.insertBefore(draggedItem, target.nextSibling);
        } else {
            container.insertBefore(draggedItem, target);
        }

        container.querySelectorAll('.priority-rank').forEach((rank, index) => {
            rank.textContent = index + 1;
        });
    }
});

// Export for external use
window.AgentCommander = {
    state,
    AgentTeams,
    showToast,
    syncAll,
    filterTeams,
    setOrchestrationMode,
    saveApiConfig,
    runHealthCheck,
    openTeamWorkspace,
    closeTeamWorkspace,
    openAgentModal,
    openTeamSettingsModal
};
