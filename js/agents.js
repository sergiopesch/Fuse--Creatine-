/**
 * FUSE Agent Command Center
 * Comprehensive AI Agent Orchestration System
 */

// ============================================
// AGENT DATA STRUCTURES
// ============================================

const AgentTeams = {
    developer: {
        id: 'developer',
        name: 'Developer Team',
        badge: 'DEV',
        color: '#3b82f6',
        agents: [
            {
                id: 'architect',
                name: 'Architect',
                role: 'System Design & Architecture',
                status: 'working',
                skills: ['System Design', 'API Architecture', 'Database Design', 'Scalability'],
                tasksCompleted: 47,
                currentTask: 'Designing microservices architecture',
                efficiency: 94
            },
            {
                id: 'coder',
                name: 'Coder',
                role: 'Implementation & Debugging',
                status: 'working',
                skills: ['JavaScript', 'Python', 'React', 'Node.js', 'TypeScript'],
                tasksCompleted: 128,
                currentTask: 'Implementing admin console features',
                efficiency: 91
            },
            {
                id: 'tester',
                name: 'QA Engineer',
                role: 'Testing & Quality Assurance',
                status: 'idle',
                skills: ['Unit Testing', 'Integration Testing', 'E2E Testing', 'Performance'],
                tasksCompleted: 89,
                currentTask: null,
                efficiency: 96
            }
        ]
    },
    design: {
        id: 'design',
        name: 'Design Team',
        badge: 'DSN',
        color: '#8b5cf6',
        agents: [
            {
                id: 'ux-lead',
                name: 'UX Lead',
                role: 'User Experience Strategy',
                status: 'working',
                skills: ['User Research', 'Wireframing', 'Prototyping', 'Usability Testing'],
                tasksCompleted: 63,
                currentTask: 'Optimizing user onboarding flow',
                efficiency: 92
            },
            {
                id: 'ui-artist',
                name: 'Visual Designer',
                role: 'UI & Visual Systems',
                status: 'idle',
                skills: ['Visual Design', 'Figma', 'Design Systems', 'Branding'],
                tasksCompleted: 71,
                currentTask: null,
                efficiency: 88
            },
            {
                id: 'motion',
                name: 'Motion Designer',
                role: 'Animation & Interactions',
                status: 'working',
                skills: ['Animation', 'Micro-interactions', 'GSAP', 'Lottie'],
                tasksCompleted: 45,
                currentTask: 'Creating loading animations',
                efficiency: 95
            }
        ]
    },
    communications: {
        id: 'communications',
        name: 'Communications Team',
        badge: 'COM',
        color: '#06b6d4',
        agents: [
            {
                id: 'content-strategist',
                name: 'Content Strategist',
                role: 'Content Planning & Voice',
                status: 'working',
                skills: ['Content Strategy', 'Editorial', 'SEO', 'Brand Voice'],
                tasksCompleted: 52,
                currentTask: 'Developing content calendar',
                efficiency: 89
            },
            {
                id: 'copywriter',
                name: 'Copywriter',
                role: 'Persuasive Copy & Messaging',
                status: 'idle',
                skills: ['Copywriting', 'Headlines', 'Email', 'Ad Copy'],
                tasksCompleted: 84,
                currentTask: null,
                efficiency: 93
            },
            {
                id: 'social-manager',
                name: 'Social Media Manager',
                role: 'Community & Engagement',
                status: 'working',
                skills: ['Social Media', 'Community Management', 'Influencer Outreach', 'Analytics'],
                tasksCompleted: 67,
                currentTask: 'Scheduling launch posts',
                efficiency: 87
            }
        ]
    },
    legal: {
        id: 'legal',
        name: 'Legal Team',
        badge: 'LGL',
        color: '#f59e0b',
        agents: [
            {
                id: 'compliance-officer',
                name: 'Compliance Officer',
                role: 'Regulatory Compliance',
                status: 'working',
                skills: ['GDPR', 'CCPA', 'FDA Regulations', 'Data Privacy'],
                tasksCompleted: 34,
                currentTask: 'Reviewing data handling practices',
                efficiency: 98
            },
            {
                id: 'contract-analyst',
                name: 'Contract Analyst',
                role: 'Terms & Agreements',
                status: 'idle',
                skills: ['Contract Review', 'Terms of Service', 'Privacy Policy', 'Licensing'],
                tasksCompleted: 28,
                currentTask: null,
                efficiency: 97
            },
            {
                id: 'ip-counsel',
                name: 'IP Counsel',
                role: 'Intellectual Property',
                status: 'idle',
                skills: ['Trademarks', 'Patents', 'Copyright', 'Trade Secrets'],
                tasksCompleted: 19,
                currentTask: null,
                efficiency: 99
            }
        ]
    },
    marketing: {
        id: 'marketing',
        name: 'Marketing Team',
        badge: 'MKT',
        color: '#ef4444',
        agents: [
            {
                id: 'growth-lead',
                name: 'Growth Lead',
                role: 'Acquisition & Retention',
                status: 'working',
                skills: ['Growth Hacking', 'A/B Testing', 'Funnel Optimization', 'Retention'],
                tasksCompleted: 56,
                currentTask: 'Analyzing conversion funnels',
                efficiency: 90
            },
            {
                id: 'brand-strategist',
                name: 'Brand Strategist',
                role: 'Brand Identity & Positioning',
                status: 'working',
                skills: ['Brand Strategy', 'Positioning', 'Competitive Analysis', 'Messaging'],
                tasksCompleted: 41,
                currentTask: 'Refining brand guidelines',
                efficiency: 92
            },
            {
                id: 'analytics-expert',
                name: 'Analytics Expert',
                role: 'Data & Performance',
                status: 'working',
                skills: ['Google Analytics', 'Data Analysis', 'Attribution', 'Reporting'],
                tasksCompleted: 73,
                currentTask: 'Building performance dashboard',
                efficiency: 94
            }
        ]
    },
    gtm: {
        id: 'gtm',
        name: 'Go-to-Market Team',
        badge: 'GTM',
        color: '#10b981',
        agents: [
            {
                id: 'launch-coordinator',
                name: 'Launch Coordinator',
                role: 'Launch Planning & Execution',
                status: 'working',
                skills: ['Launch Strategy', 'Project Management', 'Timeline Planning', 'Stakeholder Management'],
                tasksCompleted: 38,
                currentTask: 'Coordinating launch timeline',
                efficiency: 91
            },
            {
                id: 'partnership-manager',
                name: 'Partnership Manager',
                role: 'Strategic Partnerships',
                status: 'idle',
                skills: ['Business Development', 'Negotiations', 'Partner Relations', 'Co-marketing'],
                tasksCompleted: 22,
                currentTask: null,
                efficiency: 88
            },
            {
                id: 'market-researcher',
                name: 'Market Researcher',
                role: 'Market Intelligence',
                status: 'working',
                skills: ['Market Research', 'Competitive Intelligence', 'Trend Analysis', 'Surveys'],
                tasksCompleted: 31,
                currentTask: 'Analyzing market trends',
                efficiency: 93
            }
        ]
    },
    sales: {
        id: 'sales',
        name: 'Sales Team',
        badge: 'SLS',
        color: '#ec4899',
        agents: [
            {
                id: 'sales-director',
                name: 'Sales Director',
                role: 'Revenue Strategy & Team Leadership',
                status: 'working',
                skills: ['Sales Strategy', 'Revenue Operations', 'Team Leadership', 'Pipeline Management'],
                tasksCompleted: 67,
                currentTask: 'Optimizing sales pipeline metrics',
                efficiency: 96
            },
            {
                id: 'account-executive',
                name: 'Account Executive',
                role: 'Enterprise Sales & Closing',
                status: 'working',
                skills: ['Enterprise Sales', 'Contract Negotiation', 'Relationship Building', 'Closing Techniques'],
                tasksCompleted: 89,
                currentTask: 'Preparing enterprise demo presentations',
                efficiency: 94
            },
            {
                id: 'sdr',
                name: 'SDR Lead',
                role: 'Outbound Prospecting & Lead Qualification',
                status: 'working',
                skills: ['Prospecting', 'Lead Qualification', 'Cold Outreach', 'CRM Management'],
                tasksCompleted: 156,
                currentTask: 'Running outbound campaign sequences',
                efficiency: 91
            },
            {
                id: 'solutions-consultant',
                name: 'Solutions Consultant',
                role: 'Technical Sales & Demos',
                status: 'idle',
                skills: ['Technical Demos', 'Solution Architecture', 'Requirements Analysis', 'POC Management'],
                tasksCompleted: 42,
                currentTask: null,
                efficiency: 97
            },
            {
                id: 'customer-success',
                name: 'Customer Success Manager',
                role: 'Retention & Expansion',
                status: 'working',
                skills: ['Customer Retention', 'Upselling', 'Onboarding', 'Health Scoring'],
                tasksCompleted: 78,
                currentTask: 'Conducting quarterly business reviews',
                efficiency: 93
            }
        ]
    }
};

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
    activeTeam: 'all',
    orchestrationMode: 'autonomous',
    decisions: [],
    activities: [],
    communications: [],
    tasks: [],
    priorities: [],
    projects: [],
    apiKeyConfig: {
        anthropic: { configured: false, model: 'claude-3-5-haiku-latest' },
        openai: { configured: false, model: 'gpt-4-turbo' },
        gemini: { configured: false, model: 'gemini-pro' }
    },
    healthMetrics: {
        lastCheck: null,
        systemStatus: 'operational'
    }
};

// Initialize decisions queue
state.decisions = [
    {
        id: 'dec-001',
        title: 'Launch Email Campaign Approval',
        description: 'The Marketing Team has prepared the launch email sequence. Review and approve the messaging and timing.',
        priority: 'critical',
        team: 'marketing',
        requestedBy: 'Growth Lead',
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        impact: 'This will trigger automated emails to 2,400+ waitlist subscribers. Expected conversion rate: 12-15%.',
        details: {
            'Email Count': '5 emails over 7 days',
            'Total Recipients': '2,487 subscribers',
            'Scheduled Start': 'Tomorrow 9:00 AM EST',
            'A/B Testing': 'Subject lines (2 variants)'
        }
    },
    {
        id: 'dec-002',
        title: 'API Rate Limit Increase',
        description: 'Developer Team requests increasing API rate limits from 100 to 500 requests/minute to handle expected traffic.',
        priority: 'high',
        team: 'developer',
        requestedBy: 'Architect',
        timestamp: new Date(Date.now() - 1000 * 60 * 45),
        impact: 'Infrastructure cost increase ~$150/month. Prevents potential service degradation during peak hours.',
        details: {
            'Current Limit': '100 req/min',
            'Proposed Limit': '500 req/min',
            'Cost Impact': '+$150/month',
            'Performance Gain': '5x capacity'
        }
    },
    {
        id: 'dec-003',
        title: 'Partner Integration Timeline',
        description: 'GTM Team needs approval to extend partner integration deadline by 2 weeks due to API compatibility issues.',
        priority: 'medium',
        team: 'gtm',
        requestedBy: 'Partnership Manager',
        timestamp: new Date(Date.now() - 1000 * 60 * 120),
        impact: 'May delay one partner launch feature. All other launch components unaffected.',
        details: {
            'Original Deadline': 'Feb 1, 2026',
            'New Deadline': 'Feb 15, 2026',
            'Affected Partner': 'NutriTrack API',
            'Risk Level': 'Low'
        }
    }
];

// Initialize activities
state.activities = [
    {
        id: 'act-001',
        agent: 'Architect',
        team: 'developer',
        message: 'Completed microservices architecture documentation',
        tag: 'Completed',
        timestamp: new Date(Date.now() - 1000 * 60 * 2)
    },
    {
        id: 'act-002',
        agent: 'Growth Lead',
        team: 'marketing',
        message: 'Launched A/B test for landing page hero section',
        tag: 'Testing',
        timestamp: new Date(Date.now() - 1000 * 60 * 8)
    },
    {
        id: 'act-003',
        agent: 'UX Lead',
        team: 'design',
        message: 'Finalized mobile navigation prototype',
        tag: 'Design',
        timestamp: new Date(Date.now() - 1000 * 60 * 15)
    },
    {
        id: 'act-004',
        agent: 'Compliance Officer',
        team: 'legal',
        message: 'Updated privacy policy for GDPR compliance',
        tag: 'Legal',
        timestamp: new Date(Date.now() - 1000 * 60 * 23)
    },
    {
        id: 'act-005',
        agent: 'Content Strategist',
        team: 'communications',
        message: 'Drafted launch announcement blog post',
        tag: 'Content',
        timestamp: new Date(Date.now() - 1000 * 60 * 31)
    },
    {
        id: 'act-006',
        agent: 'Launch Coordinator',
        team: 'gtm',
        message: 'Synced launch checklist with all teams',
        tag: 'Coordination',
        timestamp: new Date(Date.now() - 1000 * 60 * 42)
    },
    {
        id: 'act-007',
        agent: 'Coder',
        team: 'developer',
        message: 'Deployed hotfix for chat widget performance',
        tag: 'Deployment',
        timestamp: new Date(Date.now() - 1000 * 60 * 55)
    },
    {
        id: 'act-008',
        agent: 'Motion Designer',
        team: 'design',
        message: 'Created animated success state for form submissions',
        tag: 'Animation',
        timestamp: new Date(Date.now() - 1000 * 60 * 68)
    }
];

// Initialize inter-agent communications
state.communications = [
    {
        id: 'com-001',
        from: { agent: 'Architect', team: 'developer' },
        to: { agent: 'UX Lead', team: 'design' },
        message: 'The new API endpoints are ready for integration. I\'ve documented the response schemas - can we sync on the data visualization approach?',
        timestamp: new Date(Date.now() - 1000 * 60 * 5)
    },
    {
        id: 'com-002',
        from: { agent: 'Growth Lead', team: 'marketing' },
        to: { agent: 'Content Strategist', team: 'communications' },
        message: 'Conversion data shows 23% higher engagement with urgency messaging. Can we incorporate this into the launch content?',
        timestamp: new Date(Date.now() - 1000 * 60 * 18)
    },
    {
        id: 'com-003',
        from: { agent: 'Compliance Officer', team: 'legal' },
        to: { agent: 'Coder', team: 'developer' },
        message: 'Please ensure all user data exports include the new consent audit fields. GDPR requirement effective immediately.',
        timestamp: new Date(Date.now() - 1000 * 60 * 35)
    },
    {
        id: 'com-004',
        from: { agent: 'Launch Coordinator', team: 'gtm' },
        to: { agent: 'Brand Strategist', team: 'marketing' },
        message: 'Partner assets received. Please verify brand alignment before we proceed with co-marketing materials.',
        timestamp: new Date(Date.now() - 1000 * 60 * 52)
    },
    {
        id: 'com-005',
        from: { agent: 'Visual Designer', team: 'design' },
        to: { agent: 'Social Media Manager', team: 'communications' },
        message: 'New social media templates are uploaded to the shared drive. Optimized for Instagram, Twitter, and LinkedIn.',
        timestamp: new Date(Date.now() - 1000 * 60 * 71)
    }
];

// Initialize priority queue
state.priorities = [
    { id: 'pri-001', name: 'Launch Email Sequence', team: 'Marketing + Communications' },
    { id: 'pri-002', name: 'Performance Optimization', team: 'Developer' },
    { id: 'pri-003', name: 'Legal Review Completion', team: 'Legal' },
    { id: 'pri-004', name: 'Partner Integration', team: 'GTM + Developer' }
];

// Initialize cross-team projects
state.projects = [
    { id: 'proj-001', name: 'Product Launch v1.0', teams: ['All Teams'] },
    { id: 'proj-002', name: 'Waitlist Conversion Campaign', teams: ['Marketing', 'Communications', 'Design'] },
    { id: 'proj-003', name: 'Platform Scalability', teams: ['Developer', 'GTM'] }
];

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
    teamsGrid: document.getElementById('teamsGrid'),
    decisionQueue: document.getElementById('decisionQueue'),
    activityFeed: document.getElementById('activityFeed'),
    priorityQueue: document.getElementById('priorityQueue'),
    projectList: document.getElementById('projectList'),
    commsLog: document.getElementById('commsLog'),
    toastContainer: document.getElementById('toastContainer'),
    // Modals
    taskModal: document.getElementById('taskModal'),
    agentModal: document.getElementById('agentModal'),
    decisionModal: document.getElementById('decisionModal'),
    broadcastModal: document.getElementById('broadcastModal'),
    // Stats
    activeAgents: document.getElementById('activeAgents'),
    tasksInProgress: document.getElementById('tasksInProgress'),
    pendingDecisions: document.getElementById('pendingDecisions'),
    completedToday: document.getElementById('completedToday')
};

// ============================================
// RENDERING FUNCTIONS
// ============================================

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
        gtm: '#10b981'
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
        gtm: '#10b981'
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
    // Count all agents and working agents
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

    if (elements.activeAgents) elements.activeAgents.textContent = totalAgents.toString();
    if (elements.tasksInProgress) elements.tasksInProgress.textContent = tasksCount;
    if (elements.pendingDecisions) elements.pendingDecisions.textContent = state.decisions.length;
    if (elements.completedToday) elements.completedToday.textContent = '24';

    // Update health metrics
    state.healthMetrics.lastCheck = new Date().toISOString();
    state.healthMetrics.systemStatus = activeCount > 0 ? 'operational' : 'idle';
}

// ============================================
// TEAM FILTERING
// ============================================

function filterTeams(teamId) {
    state.activeTeam = teamId;

    // Update nav buttons
    document.querySelectorAll('.team-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.team === teamId);
    });

    // Filter team cards
    document.querySelectorAll('.team-card').forEach(card => {
        if (teamId === 'all') {
            card.classList.remove('hidden');
        } else {
            card.classList.toggle('hidden', card.dataset.team !== teamId);
        }
    });
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

    // Store current decision ID for action handlers
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
        gtm: '#10b981'
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

// ============================================
// DECISION ACTIONS
// ============================================

function approveDecision() {
    const decisionId = elements.decisionModal?.dataset.currentDecision;
    if (!decisionId) return;

    const decision = state.decisions.find(d => d.id === decisionId);
    if (decision) {
        // Add to activity
        state.activities.unshift({
            id: `act-${Date.now()}`,
            agent: 'Commander',
            team: decision.team,
            message: `Approved: ${decision.title}`,
            tag: 'Approved',
            timestamp: new Date()
        });

        // Remove from decisions
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

    // Add activity
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

    // Reset form
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

    // Add activity
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

    // Simulate sync with animation
    document.querySelectorAll('.team-card').forEach((card, index) => {
        setTimeout(() => {
            card.style.transform = 'scale(0.98)';
            setTimeout(() => {
                card.style.transform = '';
            }, 150);
        }, index * 100);
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

    // Auto remove after 5 seconds
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

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Initial renders
    renderDecisionQueue();
    renderActivityFeed();
    renderPriorityQueue();
    renderProjectList();
    renderCommsLog();
    updateStats();

    // Initialize API config panel
    initApiConfigPanel();

    // Initialize lazy loading for performance
    lazyLoadTeamCards();

    // Initialize agent status monitoring
    updateAgentVisibilityDashboard();

    // Team navigation
    document.querySelectorAll('.team-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => filterTeams(btn.dataset.team));
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

    // Agent card clicks
    document.querySelectorAll('.agent-card').forEach(card => {
        card.addEventListener('click', () => {
            const teamCard = card.closest('.team-card');
            if (teamCard) {
                openAgentModal(teamCard.dataset.team, card.dataset.agent);
            }
        });
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

    // Simulate real-time updates
    setInterval(() => {
        // Randomly update activity timestamps
        state.activities.forEach(activity => {
            activity.timestamp = new Date(activity.timestamp);
        });

        // Occasionally add new activities
        if (Math.random() > 0.85) {
            const teams = Object.keys(AgentTeams);
            const randomTeam = teams[Math.floor(Math.random() * teams.length)];
            const team = AgentTeams[randomTeam];
            const randomAgent = team.agents[Math.floor(Math.random() * team.agents.length)];

            const actions = [
                'Completed sub-task',
                'Started new analysis',
                'Updated progress',
                'Synced with team',
                'Generated report'
            ];

            state.activities.unshift({
                id: `act-${Date.now()}`,
                agent: randomAgent.name,
                team: randomTeam,
                message: actions[Math.floor(Math.random() * actions.length)],
                tag: 'Update',
                timestamp: new Date()
            });

            // Keep only last 20 activities
            if (state.activities.length > 20) {
                state.activities.pop();
            }

            renderActivityFeed();
        }
    }, 10000);
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

        // Update priority ranks
        container.querySelectorAll('.priority-rank').forEach((rank, index) => {
            rank.textContent = index + 1;
        });
    }
});

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

    // Validate key format
    const keyPatterns = {
        anthropic: /^sk-ant-/,
        openai: /^sk-/,
        gemini: /^AI/
    };

    if (!keyPatterns[provider].test(apiKey)) {
        showToast('error', 'Invalid Format', `API key doesn't match expected format for ${provider}`);
        return;
    }

    // Update local state (in production, this would call the API)
    state.apiKeyConfig[provider] = {
        configured: true,
        model: model
    };

    // Update status display
    const statusEl = document.getElementById(`${provider}Status`);
    if (statusEl) {
        statusEl.textContent = 'Configured';
        statusEl.classList.add('configured');
    }

    // Clear the key input for security
    keyInput.value = '';

    // Add activity
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

    // Simulate API latency check
    setTimeout(() => {
        const latency = Math.round(performance.now() - startTime);

        // Update health metrics
        state.healthMetrics.lastCheck = new Date().toISOString();
        state.healthMetrics.systemStatus = 'operational';

        // Update UI
        const apiLatencyEl = document.getElementById('apiLatency');
        const lastCheckEl = document.getElementById('lastHealthCheck');
        const systemStatusEl = document.getElementById('systemStatus');

        if (apiLatencyEl) apiLatencyEl.textContent = `${latency} ms`;
        if (lastCheckEl) lastCheckEl.textContent = 'Just now';
        if (systemStatusEl) {
            systemStatusEl.textContent = 'Operational';
            systemStatusEl.className = 'health-value status-good';
        }

        // Add to activity feed
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
    // Add click handlers for config card toggles
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

    // Initialize API status from state
    Object.entries(state.apiKeyConfig).forEach(([provider, config]) => {
        const statusEl = document.getElementById(`${provider}Status`);
        if (statusEl && config.configured) {
            statusEl.textContent = 'Configured';
            statusEl.classList.add('configured');
        }
    });
}

// ============================================
// PERFORMANCE OPTIMIZATION: LAZY LOADING
// ============================================

function lazyLoadTeamCards() {
    const options = {
        root: null,
        rootMargin: '50px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, options);

    document.querySelectorAll('.team-card').forEach(card => {
        observer.observe(card);
    });
}

// ============================================
// REAL-TIME AGENT STATUS MONITORING
// ============================================

function getAgentStatusSummary() {
    const summary = {
        total: 0,
        working: 0,
        idle: 0,
        teams: {}
    };

    Object.entries(AgentTeams).forEach(([teamId, team]) => {
        const teamSummary = {
            name: team.name,
            working: 0,
            idle: 0,
            total: team.agents.length
        };

        team.agents.forEach(agent => {
            summary.total++;
            if (agent.status === 'working') {
                summary.working++;
                teamSummary.working++;
            } else {
                summary.idle++;
                teamSummary.idle++;
            }
        });

        teamSummary.utilization = Math.round((teamSummary.working / teamSummary.total) * 100);
        summary.teams[teamId] = teamSummary;
    });

    return summary;
}

function updateAgentVisibilityDashboard() {
    const summary = getAgentStatusSummary();

    // This data can be used to render an agent visibility dashboard
    // or expose via window for admin console integration
    window.AgentStatusSummary = summary;

    return summary;
}

// Export for potential external use
window.AgentCommander = {
    state,
    AgentTeams,
    showToast,
    syncAll,
    filterTeams,
    setOrchestrationMode,
    saveApiConfig,
    runHealthCheck,
    getAgentStatusSummary,
    updateAgentVisibilityDashboard
};
