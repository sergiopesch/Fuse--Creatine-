/**
 * FUSE Agent Command Center
 * Dynamic AI Agent Orchestration System with Live Feeds
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
        model: 'claude-3-5-sonnet-latest',
        provider: 'anthropic',
        description: 'Building and architecting the core platform',
        agents: [
            {
                id: 'architect',
                name: 'Architect',
                role: 'System Design & Architecture',
                status: 'working',
                skills: ['System Design', 'API Architecture', 'Database Design', 'Scalability'],
                tasksCompleted: 47,
                currentTask: 'Designing microservices architecture',
                efficiency: 94,
                avatar: 'shield'
            },
            {
                id: 'coder',
                name: 'Coder',
                role: 'Implementation & Debugging',
                status: 'working',
                skills: ['JavaScript', 'Python', 'React', 'Node.js', 'TypeScript'],
                tasksCompleted: 128,
                currentTask: 'Implementing admin console features',
                efficiency: 91,
                avatar: 'code'
            },
            {
                id: 'tester',
                name: 'QA Engineer',
                role: 'Testing & Quality Assurance',
                status: 'idle',
                skills: ['Unit Testing', 'Integration Testing', 'E2E Testing', 'Performance'],
                tasksCompleted: 89,
                currentTask: null,
                efficiency: 96,
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
        agents: [
            {
                id: 'ux-lead',
                name: 'UX Lead',
                role: 'User Experience Strategy',
                status: 'working',
                skills: ['User Research', 'Wireframing', 'Prototyping', 'Usability Testing'],
                tasksCompleted: 63,
                currentTask: 'Optimizing user onboarding flow',
                efficiency: 92,
                avatar: 'palette'
            },
            {
                id: 'ui-artist',
                name: 'Visual Designer',
                role: 'UI & Visual Systems',
                status: 'idle',
                skills: ['Visual Design', 'Figma', 'Design Systems', 'Branding'],
                tasksCompleted: 71,
                currentTask: null,
                efficiency: 88,
                avatar: 'brush'
            },
            {
                id: 'motion',
                name: 'Motion Designer',
                role: 'Animation & Interactions',
                status: 'working',
                skills: ['Animation', 'Micro-interactions', 'GSAP', 'Lottie'],
                tasksCompleted: 45,
                currentTask: 'Creating loading animations',
                efficiency: 95,
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
        agents: [
            {
                id: 'content-strategist',
                name: 'Content Strategist',
                role: 'Content Planning & Voice',
                status: 'working',
                skills: ['Content Strategy', 'Editorial', 'SEO', 'Brand Voice'],
                tasksCompleted: 52,
                currentTask: 'Developing content calendar',
                efficiency: 89,
                avatar: 'document'
            },
            {
                id: 'copywriter',
                name: 'Copywriter',
                role: 'Persuasive Copy & Messaging',
                status: 'idle',
                skills: ['Copywriting', 'Headlines', 'Email', 'Ad Copy'],
                tasksCompleted: 84,
                currentTask: null,
                efficiency: 93,
                avatar: 'pen'
            },
            {
                id: 'social-manager',
                name: 'Social Media Manager',
                role: 'Community & Engagement',
                status: 'working',
                skills: ['Social Media', 'Community Management', 'Influencer Outreach', 'Analytics'],
                tasksCompleted: 67,
                currentTask: 'Scheduling launch posts',
                efficiency: 87,
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
        agents: [
            {
                id: 'compliance-officer',
                name: 'Compliance Officer',
                role: 'Regulatory Compliance',
                status: 'working',
                skills: ['GDPR', 'CCPA', 'FDA Regulations', 'Data Privacy'],
                tasksCompleted: 34,
                currentTask: 'Reviewing data handling practices',
                efficiency: 98,
                avatar: 'shield'
            },
            {
                id: 'contract-analyst',
                name: 'Contract Analyst',
                role: 'Terms & Agreements',
                status: 'idle',
                skills: ['Contract Review', 'Terms of Service', 'Privacy Policy', 'Licensing'],
                tasksCompleted: 28,
                currentTask: null,
                efficiency: 97,
                avatar: 'document'
            },
            {
                id: 'ip-counsel',
                name: 'IP Counsel',
                role: 'Intellectual Property',
                status: 'idle',
                skills: ['Trademarks', 'Patents', 'Copyright', 'Trade Secrets'],
                tasksCompleted: 19,
                currentTask: null,
                efficiency: 99,
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
        agents: [
            {
                id: 'growth-lead',
                name: 'Growth Lead',
                role: 'Acquisition & Retention',
                status: 'working',
                skills: ['Growth Hacking', 'A/B Testing', 'Funnel Optimization', 'Retention'],
                tasksCompleted: 56,
                currentTask: 'Analyzing conversion funnels',
                efficiency: 90,
                avatar: 'chart'
            },
            {
                id: 'brand-strategist',
                name: 'Brand Strategist',
                role: 'Brand Identity & Positioning',
                status: 'working',
                skills: ['Brand Strategy', 'Positioning', 'Competitive Analysis', 'Messaging'],
                tasksCompleted: 41,
                currentTask: 'Refining brand guidelines',
                efficiency: 92,
                avatar: 'star'
            },
            {
                id: 'analytics-expert',
                name: 'Analytics Expert',
                role: 'Data & Performance',
                status: 'working',
                skills: ['Google Analytics', 'Data Analysis', 'Attribution', 'Reporting'],
                tasksCompleted: 73,
                currentTask: 'Building performance dashboard',
                efficiency: 94,
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
        agents: [
            {
                id: 'launch-coordinator',
                name: 'Launch Coordinator',
                role: 'Launch Planning & Execution',
                status: 'working',
                skills: ['Launch Strategy', 'Project Management', 'Timeline Planning', 'Stakeholder Management'],
                tasksCompleted: 38,
                currentTask: 'Coordinating launch timeline',
                efficiency: 91,
                avatar: 'rocket'
            },
            {
                id: 'partnership-manager',
                name: 'Partnership Manager',
                role: 'Strategic Partnerships',
                status: 'idle',
                skills: ['Business Development', 'Negotiations', 'Partner Relations', 'Co-marketing'],
                tasksCompleted: 22,
                currentTask: null,
                efficiency: 88,
                avatar: 'handshake'
            },
            {
                id: 'market-researcher',
                name: 'Market Researcher',
                role: 'Market Intelligence',
                status: 'working',
                skills: ['Market Research', 'Competitive Intelligence', 'Trend Analysis', 'Surveys'],
                tasksCompleted: 31,
                currentTask: 'Analyzing market trends',
                efficiency: 93,
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
        agents: [
            {
                id: 'sales-director',
                name: 'Sales Director',
                role: 'Revenue Strategy & Team Leadership',
                status: 'working',
                skills: ['Sales Strategy', 'Revenue Operations', 'Team Leadership', 'Pipeline Management'],
                tasksCompleted: 67,
                currentTask: 'Optimizing sales pipeline metrics',
                efficiency: 96,
                avatar: 'user'
            },
            {
                id: 'account-executive',
                name: 'Account Executive',
                role: 'Enterprise Sales & Closing',
                status: 'working',
                skills: ['Enterprise Sales', 'Contract Negotiation', 'Relationship Building', 'Closing Techniques'],
                tasksCompleted: 89,
                currentTask: 'Preparing enterprise demo presentations',
                efficiency: 94,
                avatar: 'briefcase'
            },
            {
                id: 'sdr',
                name: 'SDR Lead',
                role: 'Outbound Prospecting & Lead Qualification',
                status: 'working',
                skills: ['Prospecting', 'Lead Qualification', 'Cold Outreach', 'CRM Management'],
                tasksCompleted: 156,
                currentTask: 'Running outbound campaign sequences',
                efficiency: 91,
                avatar: 'email'
            },
            {
                id: 'solutions-consultant',
                name: 'Solutions Consultant',
                role: 'Technical Sales & Demos',
                status: 'idle',
                skills: ['Technical Demos', 'Solution Architecture', 'Requirements Analysis', 'POC Management'],
                tasksCompleted: 42,
                currentTask: null,
                efficiency: 97,
                avatar: 'monitor'
            },
            {
                id: 'customer-success',
                name: 'Customer Success Manager',
                role: 'Retention & Expansion',
                status: 'working',
                skills: ['Customer Retention', 'Upselling', 'Onboarding', 'Health Scoring'],
                tasksCompleted: 78,
                currentTask: 'Conducting quarterly business reviews',
                efficiency: 93,
                avatar: 'check'
            }
        ]
    }
};

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
    activeTeam: 'all',
    currentWorkspaceTeam: null,
    orchestrationMode: 'autonomous',
    decisions: [],
    activities: [],
    communications: [],
    tasks: [],
    priorities: [],
    projects: [],
    liveFeed: [],
    liveFeedFilter: 'all',
    apiKeyConfig: {
        anthropic: { configured: false, model: 'claude-3-5-sonnet-latest' },
        openai: { configured: false, model: 'gpt-4o' },
        gemini: { configured: false, model: 'gemini-pro' }
    },
    healthMetrics: {
        lastCheck: null,
        systemStatus: 'operational'
    },
    teamSettings: {},
    // World Controller State - Owner Control
    worldController: {
        worldStatus: 'manual',  // 'paused', 'manual', 'semi_auto', 'autonomous'
        globalPaused: false,
        pausedAt: null,
        pauseReason: null,
        emergencyStop: {
            triggered: false,
            triggeredAt: null,
            reason: null
        },
        teamControls: {
            developer: { paused: false, automationLevel: 'manual', allowedActions: [] },
            design: { paused: false, automationLevel: 'manual', allowedActions: [] },
            communications: { paused: false, automationLevel: 'manual', allowedActions: [] },
            legal: { paused: false, automationLevel: 'manual', allowedActions: [] },
            marketing: { paused: false, automationLevel: 'manual', allowedActions: [] },
            gtm: { paused: false, automationLevel: 'manual', allowedActions: [] },
            sales: { paused: false, automationLevel: 'manual', allowedActions: [] }
        },
        creditProtection: {
            enabled: true,
            dailyLimit: 50.00,
            monthlyLimit: 500.00,
            currentDailySpend: 0,
            currentMonthlySpend: 0,
            autoStopOnLimit: true
        },
        pendingActions: [],
        controlLog: []
    }
};

// Initialize team settings
Object.keys(AgentTeams).forEach(teamId => {
    state.teamSettings[teamId] = {
        model: AgentTeams[teamId].model,
        provider: AgentTeams[teamId].provider,
        apiKeyConfigured: false
    };
});

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
    { id: 'act-001', agent: 'Architect', team: 'developer', message: 'Completed microservices architecture documentation', tag: 'Completed', timestamp: new Date(Date.now() - 1000 * 60 * 2) },
    { id: 'act-002', agent: 'Growth Lead', team: 'marketing', message: 'Launched A/B test for landing page hero section', tag: 'Testing', timestamp: new Date(Date.now() - 1000 * 60 * 8) },
    { id: 'act-003', agent: 'UX Lead', team: 'design', message: 'Finalized mobile navigation prototype', tag: 'Design', timestamp: new Date(Date.now() - 1000 * 60 * 15) },
    { id: 'act-004', agent: 'Compliance Officer', team: 'legal', message: 'Updated privacy policy for GDPR compliance', tag: 'Legal', timestamp: new Date(Date.now() - 1000 * 60 * 23) },
    { id: 'act-005', agent: 'Content Strategist', team: 'communications', message: 'Drafted launch announcement blog post', tag: 'Content', timestamp: new Date(Date.now() - 1000 * 60 * 31) },
    { id: 'act-006', agent: 'Launch Coordinator', team: 'gtm', message: 'Synced launch checklist with all teams', tag: 'Coordination', timestamp: new Date(Date.now() - 1000 * 60 * 42) },
    { id: 'act-007', agent: 'Coder', team: 'developer', message: 'Deployed hotfix for chat widget performance', tag: 'Deployment', timestamp: new Date(Date.now() - 1000 * 60 * 55) },
    { id: 'act-008', agent: 'Motion Designer', team: 'design', message: 'Created animated success state for form submissions', tag: 'Animation', timestamp: new Date(Date.now() - 1000 * 60 * 68) }
];

// Initialize inter-agent communications
state.communications = [
    { id: 'com-001', from: { agent: 'Architect', team: 'developer' }, to: { agent: 'UX Lead', team: 'design' }, message: 'The new API endpoints are ready for integration. I\'ve documented the response schemas - can we sync on the data visualization approach?', timestamp: new Date(Date.now() - 1000 * 60 * 5) },
    { id: 'com-002', from: { agent: 'Growth Lead', team: 'marketing' }, to: { agent: 'Content Strategist', team: 'communications' }, message: 'Conversion data shows 23% higher engagement with urgency messaging. Can we incorporate this into the launch content?', timestamp: new Date(Date.now() - 1000 * 60 * 18) },
    { id: 'com-003', from: { agent: 'Compliance Officer', team: 'legal' }, to: { agent: 'Coder', team: 'developer' }, message: 'Please ensure all user data exports include the new consent audit fields. GDPR requirement effective immediately.', timestamp: new Date(Date.now() - 1000 * 60 * 35) },
    { id: 'com-004', from: { agent: 'Launch Coordinator', team: 'gtm' }, to: { agent: 'Brand Strategist', team: 'marketing' }, message: 'Partner assets received. Please verify brand alignment before we proceed with co-marketing materials.', timestamp: new Date(Date.now() - 1000 * 60 * 52) },
    { id: 'com-005', from: { agent: 'Visual Designer', team: 'design' }, to: { agent: 'Social Media Manager', team: 'communications' }, message: 'New social media templates are uploaded to the shared drive. Optimized for Instagram, Twitter, and LinkedIn.', timestamp: new Date(Date.now() - 1000 * 60 * 71) }
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
// LIVE FEED DATA GENERATION
// ============================================

const thoughtTopics = {
    developer: ['architecture', 'performance', 'security', 'API design', 'database optimization', 'code review', 'testing strategy', 'deployment'],
    design: ['user flow', 'visual hierarchy', 'accessibility', 'animation timing', 'color theory', 'typography', 'responsive design', 'prototyping'],
    communications: ['brand voice', 'engagement metrics', 'content strategy', 'audience targeting', 'SEO optimization', 'social trends', 'messaging'],
    legal: ['compliance', 'data privacy', 'GDPR', 'terms of service', 'intellectual property', 'risk assessment', 'regulatory'],
    marketing: ['conversion rates', 'user acquisition', 'A/B testing', 'funnel optimization', 'brand awareness', 'growth metrics', 'attribution'],
    gtm: ['launch timeline', 'market positioning', 'competitive analysis', 'partnership strategy', 'pricing', 'go-to-market'],
    sales: ['pipeline management', 'lead scoring', 'deal velocity', 'customer success', 'revenue targets', 'enterprise accounts', 'demos']
};

const actionVerbs = ['Analyzing', 'Processing', 'Evaluating', 'Generating', 'Optimizing', 'Reviewing', 'Synthesizing', 'Computing', 'Refining', 'Validating'];
const thinkingPhrases = ['Considering approach for', 'Evaluating options in', 'Reasoning about', 'Weighing trade-offs in', 'Exploring solutions for', 'Assessing impact of'];

function generateLiveFeedItem(teamId) {
    const team = AgentTeams[teamId];
    if (!team) return null;

    const workingAgents = team.agents.filter(a => a.status === 'working');
    if (workingAgents.length === 0) return null;

    const agent = workingAgents[Math.floor(Math.random() * workingAgents.length)];
    const topics = thoughtTopics[teamId] || ['general task'];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    const feedTypes = ['thinking', 'action', 'comms', 'insight'];
    const type = feedTypes[Math.floor(Math.random() * feedTypes.length)];

    let content = '';
    let highlights = [topic];

    switch (type) {
        case 'thinking':
            const thinkingPhrase = thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
            content = `${thinkingPhrase} ${topic}...`;
            break;
        case 'action':
            const actionVerb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)];
            content = `${actionVerb} ${topic} data and generating recommendations`;
            break;
        case 'comms':
            const otherTeams = Object.keys(AgentTeams).filter(t => t !== teamId);
            const targetTeam = otherTeams[Math.floor(Math.random() * otherTeams.length)];
            const targetAgent = AgentTeams[targetTeam].agents[0];
            content = `Requesting input from ${targetAgent.name} (${AgentTeams[targetTeam].name}) regarding ${topic}`;
            highlights.push(targetAgent.name);
            break;
        case 'insight':
            content = `Identified optimization opportunity in ${topic} - potential 15% improvement`;
            highlights.push('optimization');
            break;
    }

    return {
        id: `feed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        agent: agent.name,
        agentId: agent.id,
        team: teamId,
        content,
        highlights,
        timestamp: new Date(),
        processed: Math.random() > 0.3
    };
}

// ============================================
// WORLD CONTROLLER FUNCTIONS - Owner Control
// ============================================

const WORLD_STATES = {
    PAUSED: 'paused',
    MANUAL: 'manual',
    SEMI_AUTO: 'semi_auto',
    AUTONOMOUS: 'autonomous'
};

const AUTOMATION_LEVELS = {
    STOPPED: 'stopped',
    MANUAL: 'manual',
    SUPERVISED: 'supervised',
    AUTONOMOUS: 'autonomous'
};

const ACTION_TYPES = {
    THINK: 'think',
    EXECUTE: 'execute',
    COMMUNICATE: 'communicate',
    REPORT: 'report',
    SYNC: 'sync',
    RESEARCH: 'research',
    CREATE: 'create',
    REVIEW: 'review'
};

// World Controller Functions
function pauseWorld(reason = 'Manual pause by owner') {
    state.worldController.globalPaused = true;
    state.worldController.pausedAt = new Date().toISOString();
    state.worldController.pauseReason = reason;
    state.worldController.worldStatus = WORLD_STATES.PAUSED;

    // Pause all teams
    Object.keys(state.worldController.teamControls).forEach(team => {
        state.worldController.teamControls[team].paused = true;
    });

    addControlLog('WORLD_PAUSED', { reason });
    updateWorldControlUI();
    showToast(`World PAUSED: ${reason}`, 'warning');

    // Add activity
    state.activities.unshift({
        id: `act-${Date.now()}`,
        agent: 'OWNER',
        team: 'system',
        message: `WORLD PAUSED: ${reason}`,
        tag: 'Emergency',
        timestamp: new Date()
    });
    renderActivityFeed();
}

function resumeWorld(targetState = WORLD_STATES.MANUAL) {
    if (state.worldController.emergencyStop.triggered) {
        showToast('Emergency stop active. Reset required.', 'error');
        return false;
    }

    state.worldController.globalPaused = false;
    state.worldController.pausedAt = null;
    state.worldController.pauseReason = null;
    state.worldController.worldStatus = targetState;

    // Resume all teams
    Object.keys(state.worldController.teamControls).forEach(team => {
        state.worldController.teamControls[team].paused = false;
    });

    addControlLog('WORLD_RESUMED', { targetState });
    updateWorldControlUI();
    showToast(`World resumed in ${targetState.toUpperCase()} mode`, 'success');

    state.activities.unshift({
        id: `act-${Date.now()}`,
        agent: 'OWNER',
        team: 'system',
        message: `World resumed in ${targetState} mode`,
        tag: 'System',
        timestamp: new Date()
    });
    renderActivityFeed();
    return true;
}

function setWorldState(newState) {
    if (!Object.values(WORLD_STATES).includes(newState)) {
        showToast('Invalid world state', 'error');
        return false;
    }

    const previousState = state.worldController.worldStatus;
    state.worldController.worldStatus = newState;

    if (newState === WORLD_STATES.PAUSED) {
        state.worldController.globalPaused = true;
        state.worldController.pausedAt = new Date().toISOString();
    } else {
        state.worldController.globalPaused = false;
    }

    addControlLog('WORLD_STATE_CHANGED', { from: previousState, to: newState });
    updateWorldControlUI();
    showToast(`World state: ${newState.toUpperCase()}`, 'info');
    return true;
}

function triggerEmergencyStop(reason = 'Emergency stop by owner') {
    state.worldController.emergencyStop = {
        triggered: true,
        triggeredAt: new Date().toISOString(),
        reason
    };

    pauseWorld(reason);
    addControlLog('EMERGENCY_STOP', { reason });

    // Show emergency modal
    const emergencyModal = document.getElementById('emergencyStopModal');
    if (emergencyModal) {
        emergencyModal.classList.add('active');
    }

    showToast('EMERGENCY STOP ACTIVATED', 'error');
}

function resetEmergencyStop(confirmationCode) {
    if (confirmationCode !== 'CONFIRM_RESET') {
        showToast('Invalid confirmation code', 'error');
        return false;
    }

    state.worldController.emergencyStop = {
        triggered: false,
        triggeredAt: null,
        reason: null
    };

    addControlLog('EMERGENCY_RESET', {});

    const emergencyModal = document.getElementById('emergencyStopModal');
    if (emergencyModal) {
        emergencyModal.classList.remove('active');
    }

    showToast('Emergency stop reset. World remains paused.', 'success');
    return true;
}

function pauseTeam(teamId, reason = 'Manual pause') {
    if (!state.worldController.teamControls[teamId]) {
        showToast(`Unknown team: ${teamId}`, 'error');
        return false;
    }

    state.worldController.teamControls[teamId].paused = true;
    state.worldController.teamControls[teamId].pausedAt = new Date().toISOString();
    state.worldController.teamControls[teamId].pauseReason = reason;

    addControlLog('TEAM_PAUSED', { teamId, reason });
    updateTeamControlsUI();
    showToast(`Team ${teamId} paused`, 'warning');
    return true;
}

function resumeTeam(teamId) {
    if (!state.worldController.teamControls[teamId]) {
        showToast(`Unknown team: ${teamId}`, 'error');
        return false;
    }

    if (state.worldController.globalPaused) {
        showToast('Cannot resume team while world is paused', 'error');
        return false;
    }

    state.worldController.teamControls[teamId].paused = false;
    delete state.worldController.teamControls[teamId].pausedAt;
    delete state.worldController.teamControls[teamId].pauseReason;

    addControlLog('TEAM_RESUMED', { teamId });
    updateTeamControlsUI();
    showToast(`Team ${teamId} resumed`, 'success');
    return true;
}

function setTeamAutomationLevel(teamId, level, allowedActions = []) {
    if (!state.worldController.teamControls[teamId]) {
        return false;
    }

    state.worldController.teamControls[teamId].automationLevel = level;
    state.worldController.teamControls[teamId].allowedActions = allowedActions;

    addControlLog('TEAM_AUTOMATION_CHANGED', { teamId, level, allowedActions });
    updateTeamControlsUI();
    return true;
}

function triggerTeamAction(teamId, actionType, parameters = {}) {
    if (state.worldController.globalPaused) {
        showToast('Cannot trigger action while world is paused', 'error');
        return false;
    }

    if (state.worldController.teamControls[teamId]?.paused) {
        showToast(`Cannot trigger action while team ${teamId} is paused`, 'error');
        return false;
    }

    // Check credit limits
    const creditCheck = checkCreditLimits();
    if (!creditCheck.canProceed) {
        showToast(creditCheck.message, 'error');
        return false;
    }

    const action = {
        id: `action_${Date.now()}`,
        teamId,
        actionType,
        parameters,
        triggeredAt: new Date().toISOString(),
        status: 'triggered'
    };

    addControlLog('ACTION_TRIGGERED', action);
    showToast(`Action ${actionType} triggered for ${teamId}`, 'success');

    // Add to activity feed
    state.activities.unshift({
        id: `act-${Date.now()}`,
        agent: 'OWNER',
        team: teamId,
        message: `Triggered action: ${actionType}`,
        tag: 'Manual',
        timestamp: new Date()
    });
    renderActivityFeed();

    return true;
}

function setCreditLimits(daily, monthly) {
    if (daily !== null) {
        state.worldController.creditProtection.dailyLimit = daily;
    }
    if (monthly !== null) {
        state.worldController.creditProtection.monthlyLimit = monthly;
    }

    addControlLog('CREDIT_LIMITS_UPDATED', {
        dailyLimit: state.worldController.creditProtection.dailyLimit,
        monthlyLimit: state.worldController.creditProtection.monthlyLimit
    });
    updateCreditUI();
    showToast('Credit limits updated', 'success');
}

function recordSpend(amount, source = 'agent_action') {
    state.worldController.creditProtection.currentDailySpend += amount;
    state.worldController.creditProtection.currentMonthlySpend += amount;

    const status = checkCreditLimits();
    updateCreditUI();

    // Auto-pause if limit reached
    if (!status.canProceed && state.worldController.creditProtection.autoStopOnLimit) {
        pauseWorld(`Credit limit reached: ${status.message}`);
    }

    return status;
}

function checkCreditLimits() {
    const cp = state.worldController.creditProtection;
    const dailyUsageRatio = cp.currentDailySpend / cp.dailyLimit;
    const monthlyUsageRatio = cp.currentMonthlySpend / cp.monthlyLimit;

    let status = 'ok';
    let canProceed = true;
    let message = 'Within limits';

    if (dailyUsageRatio >= 1 || monthlyUsageRatio >= 1) {
        status = 'hard_stop';
        canProceed = false;
        message = 'Credit limit reached';
    } else if (dailyUsageRatio >= 0.9 || monthlyUsageRatio >= 0.9) {
        status = 'critical';
        message = 'Critical credit usage';
    } else if (dailyUsageRatio >= 0.75 || monthlyUsageRatio >= 0.75) {
        status = 'caution';
        message = 'High credit usage';
    } else if (dailyUsageRatio >= 0.5 || monthlyUsageRatio >= 0.5) {
        status = 'warning';
        message = 'Moderate credit usage';
    }

    return {
        status,
        canProceed,
        message,
        dailySpent: cp.currentDailySpend,
        dailyLimit: cp.dailyLimit,
        dailyRemaining: cp.dailyLimit - cp.currentDailySpend,
        dailyPercent: Math.round(dailyUsageRatio * 100),
        monthlySpent: cp.currentMonthlySpend,
        monthlyLimit: cp.monthlyLimit,
        monthlyRemaining: cp.monthlyLimit - cp.currentMonthlySpend,
        monthlyPercent: Math.round(monthlyUsageRatio * 100)
    };
}

function addControlLog(action, details) {
    state.worldController.controlLog.unshift({
        timestamp: new Date().toISOString(),
        action,
        details
    });

    // Keep log size manageable
    if (state.worldController.controlLog.length > 100) {
        state.worldController.controlLog = state.worldController.controlLog.slice(0, 100);
    }

    renderControlLog();
}

function canExecuteAction(teamId, actionType) {
    // Emergency stop blocks everything
    if (state.worldController.emergencyStop.triggered) {
        return { allowed: false, reason: 'Emergency stop active', code: 'EMERGENCY_STOP' };
    }

    // Global pause blocks everything
    if (state.worldController.globalPaused) {
        return { allowed: false, reason: 'World is paused', code: 'WORLD_PAUSED' };
    }

    // Team pause blocks team actions
    if (state.worldController.teamControls[teamId]?.paused) {
        return { allowed: false, reason: `Team ${teamId} is paused`, code: 'TEAM_PAUSED' };
    }

    // Credit limits
    const creditCheck = checkCreditLimits();
    if (!creditCheck.canProceed) {
        return { allowed: false, reason: creditCheck.message, code: 'CREDIT_LIMIT' };
    }

    // Check world state and team automation level
    switch (state.worldController.worldStatus) {
        case WORLD_STATES.PAUSED:
            return { allowed: false, reason: 'World is paused', code: 'WORLD_PAUSED' };
        case WORLD_STATES.MANUAL:
            return { allowed: false, reason: 'Manual mode - requires trigger', code: 'REQUIRES_TRIGGER', requiresApproval: true };
        case WORLD_STATES.SEMI_AUTO:
            const teamControl = state.worldController.teamControls[teamId];
            if (teamControl?.allowedActions?.includes(actionType)) {
                return { allowed: true, reason: 'Action allowed in semi-auto' };
            }
            return { allowed: false, reason: 'Action not in allowed list', code: 'REQUIRES_APPROVAL', requiresApproval: true };
        case WORLD_STATES.AUTONOMOUS:
            return { allowed: true, reason: 'Autonomous mode' };
        default:
            return { allowed: false, reason: 'Unknown state', code: 'UNKNOWN' };
    }
}

// UI Update Functions
function updateWorldControlUI() {
    const wc = state.worldController;

    // Update world state indicator in header
    const indicator = document.getElementById('worldStateIndicator');
    if (indicator) {
        indicator.className = 'world-state-indicator';
        const stateText = indicator.querySelector('.world-state-text');
        if (stateText) {
            stateText.textContent = wc.worldStatus.toUpperCase().replace('_', '-');
        }

        if (wc.worldStatus === 'paused') indicator.classList.add('paused');
        else if (wc.worldStatus === 'semi_auto') indicator.classList.add('semi-auto');
        else if (wc.worldStatus === 'autonomous') indicator.classList.add('autonomous');
    }

    // Update pause overlay
    const pauseOverlay = document.getElementById('worldPausedOverlay');
    const pauseReasonText = document.getElementById('pauseReasonText');
    if (pauseOverlay) {
        if (wc.globalPaused && !wc.emergencyStop.triggered) {
            pauseOverlay.classList.add('active');
            if (pauseReasonText) {
                pauseReasonText.textContent = wc.pauseReason || 'All agent operations are halted.';
            }
        } else {
            pauseOverlay.classList.remove('active');
        }
    }

    // Update emergency modal
    const emergencyModal = document.getElementById('emergencyStopModal');
    const emergencyReasonText = document.getElementById('emergencyReasonText');
    if (emergencyModal) {
        if (wc.emergencyStop.triggered) {
            emergencyModal.classList.add('active');
            if (emergencyReasonText) {
                emergencyReasonText.textContent = wc.emergencyStop.reason || 'All agent operations have been immediately halted.';
            }
        } else {
            emergencyModal.classList.remove('active');
        }
    }

    // Update master pause button
    const pauseBtn = document.getElementById('masterPauseBtn');
    if (pauseBtn) {
        const btnText = pauseBtn.querySelector('span');
        if (wc.globalPaused) {
            pauseBtn.classList.add('is-paused');
            if (btnText) btnText.textContent = 'RESUME';
        } else {
            pauseBtn.classList.remove('is-paused');
            if (btnText) btnText.textContent = 'PAUSE';
        }
    }

    // Update emergency stop button
    const emergencyBtn = document.getElementById('emergencyStopBtn');
    if (emergencyBtn) {
        if (wc.emergencyStop.triggered) {
            emergencyBtn.classList.add('active');
        } else {
            emergencyBtn.classList.remove('active');
        }
    }

    // Update system status
    const statusIndicator = document.getElementById('systemStatusIndicator');
    const statusText = document.getElementById('systemStatusText');
    if (statusIndicator && statusText) {
        if (wc.emergencyStop.triggered) {
            statusIndicator.className = 'status-indicator emergency';
            statusText.textContent = 'EMERGENCY STOP';
        } else if (wc.globalPaused) {
            statusIndicator.className = 'status-indicator paused';
            statusText.textContent = 'World Paused';
        } else {
            statusIndicator.className = 'status-indicator online';
            statusText.textContent = 'All Systems Operational';
        }
    }

    // Update state buttons in World Control tab
    document.querySelectorAll('.state-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.state === wc.worldStatus) {
            btn.classList.add('active');
        }
    });

    // Update state description
    const stateDesc = document.getElementById('stateDescription');
    if (stateDesc) {
        const descriptions = {
            paused: 'World is PAUSED. All agent operations are halted.',
            manual: 'Manual mode: You must trigger every action. Full control.',
            semi_auto: 'Semi-auto mode: Agents can perform allowed actions. Major decisions require approval.',
            autonomous: 'Autonomous mode: Agents operate independently. Use with caution.'
        };
        stateDesc.textContent = descriptions[wc.worldStatus] || '';
    }

    updateCreditUI();
    updateTeamControlsUI();
}

function updateCreditUI() {
    const cp = state.worldController.creditProtection;
    const status = checkCreditLimits();

    // Header credit indicator
    const creditIndicator = document.getElementById('creditIndicator');
    const creditValue = document.getElementById('creditValue');
    const creditLimit = document.getElementById('creditLimit');
    if (creditIndicator && creditValue && creditLimit) {
        creditValue.textContent = `$${cp.currentDailySpend.toFixed(2)}`;
        creditLimit.textContent = `/ $${cp.dailyLimit}`;

        creditIndicator.className = 'credit-indicator';
        if (status.status === 'critical' || status.status === 'hard_stop') {
            creditIndicator.classList.add('critical');
        } else if (status.status === 'warning' || status.status === 'caution') {
            creditIndicator.classList.add('warning');
        }
    }

    // Credit bar in World Control tab
    const creditBar = document.getElementById('creditBar');
    if (creditBar) {
        creditBar.style.width = `${Math.min(status.dailyPercent, 100)}%`;
        creditBar.className = 'credit-bar';
        if (status.status === 'critical' || status.status === 'hard_stop') {
            creditBar.classList.add('critical');
        } else if (status.status === 'warning' || status.status === 'caution') {
            creditBar.classList.add('warning');
        }
    }

    // Credit stats
    const spentDisplay = document.getElementById('creditSpentDisplay');
    const remainingDisplay = document.getElementById('creditRemainingDisplay');
    if (spentDisplay) {
        spentDisplay.textContent = `$${cp.currentDailySpend.toFixed(2)} spent today`;
    }
    if (remainingDisplay) {
        remainingDisplay.textContent = `$${status.dailyRemaining.toFixed(2)} remaining`;
        remainingDisplay.className = 'credit-remaining';
        if (status.status === 'critical') remainingDisplay.classList.add('critical');
        else if (status.status === 'warning') remainingDisplay.classList.add('warning');
    }

    // Update limit inputs
    const dailyInput = document.getElementById('dailyLimitInput');
    const monthlyInput = document.getElementById('monthlyLimitInput');
    if (dailyInput) dailyInput.value = cp.dailyLimit;
    if (monthlyInput) monthlyInput.value = cp.monthlyLimit;
}

function updateTeamControlsUI() {
    const container = document.getElementById('teamControlsList');
    if (!container) return;

    const teamColors = {
        developer: '#3b82f6',
        design: '#8b5cf6',
        communications: '#06b6d4',
        legal: '#f59e0b',
        marketing: '#ef4444',
        gtm: '#10b981',
        sales: '#ec4899'
    };

    const teamNames = {
        developer: 'Developer',
        design: 'Design',
        communications: 'Comms',
        legal: 'Legal',
        marketing: 'Marketing',
        gtm: 'GTM',
        sales: 'Sales'
    };

    container.innerHTML = Object.entries(state.worldController.teamControls).map(([teamId, control]) => {
        const isPaused = control.paused;
        const color = teamColors[teamId] || '#888';
        const name = teamNames[teamId] || teamId;
        const badge = AgentTeams[teamId]?.badge || teamId.substring(0, 3).toUpperCase();

        return `
            <div class="team-control-item ${isPaused ? 'paused' : ''}" data-team="${teamId}">
                <div class="team-control-badge" style="background: ${color}">${badge}</div>
                <div class="team-control-info">
                    <div class="team-control-name">${name}</div>
                    <div class="team-control-status">${isPaused ? 'PAUSED' : control.automationLevel}</div>
                </div>
                <select class="team-automation-select" data-team="${teamId}" ${isPaused ? 'disabled' : ''}>
                    <option value="manual" ${control.automationLevel === 'manual' ? 'selected' : ''}>Manual</option>
                    <option value="supervised" ${control.automationLevel === 'supervised' ? 'selected' : ''}>Supervised</option>
                    <option value="autonomous" ${control.automationLevel === 'autonomous' ? 'selected' : ''}>Autonomous</option>
                </select>
                <div class="team-control-actions">
                    ${isPaused ?
                        `<button class="team-control-btn play-btn" data-action="resume" data-team="${teamId}" title="Resume Team">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        </button>` :
                        `<button class="team-control-btn pause-btn" data-action="pause" data-team="${teamId}" title="Pause Team">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        </button>`
                    }
                    <button class="team-control-btn trigger-btn" data-action="trigger" data-team="${teamId}" title="Trigger Action" ${isPaused ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners
    container.querySelectorAll('.team-control-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.dataset.action;
            const teamId = btn.dataset.team;
            if (action === 'pause') pauseTeam(teamId);
            else if (action === 'resume') resumeTeam(teamId);
            else if (action === 'trigger') {
                // Set the trigger form to this team
                const triggerSelect = document.getElementById('triggerTeamSelect');
                if (triggerSelect) triggerSelect.value = teamId;
            }
        });
    });

    container.querySelectorAll('.team-automation-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const teamId = select.dataset.team;
            setTeamAutomationLevel(teamId, select.value);
        });
    });
}

function renderControlLog() {
    const container = document.getElementById('controlLogList');
    if (!container) return;

    const recentLogs = state.worldController.controlLog.slice(0, 20);

    if (recentLogs.length === 0) {
        container.innerHTML = '<p class="empty-message">No control actions yet</p>';
        return;
    }

    container.innerHTML = recentLogs.map(log => {
        const time = new Date(log.timestamp);
        const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const detailsStr = typeof log.details === 'object' ?
            Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(', ') : '';

        return `
            <div class="control-log-item">
                <span class="log-time">${timeStr}</span>
                <span class="log-action">${log.action}</span>
                <span class="log-details">${detailsStr}</span>
            </div>
        `;
    }).join('');
}

function renderPendingActions() {
    const container = document.getElementById('pendingActionsList');
    const badge = document.getElementById('pendingActionsBadge');

    if (!container) return;

    const pending = state.worldController.pendingActions || [];

    if (badge) badge.textContent = pending.length;

    if (pending.length === 0) {
        container.innerHTML = '<p class="empty-message">No pending actions</p>';
        return;
    }

    container.innerHTML = pending.map(action => `
        <div class="pending-action-item" data-id="${action.id}">
            <div class="pending-action-info">
                <div class="pending-action-type">${action.actionType}</div>
                <div class="pending-action-team">${action.teamId}</div>
            </div>
            <div class="pending-action-actions">
                <button class="action-approve-btn" data-id="${action.id}">Approve</button>
                <button class="action-reject-btn" data-id="${action.id}">Reject</button>
            </div>
        </div>
    `).join('');
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

function startTeamLiveFeed(teamId) {
    // Clear existing interval
    if (liveFeedInterval) {
        clearInterval(liveFeedInterval);
    }

    // Clear existing feed
    state.liveFeed = [];

    // Generate initial feed items
    for (let i = 0; i < 5; i++) {
        const item = generateLiveFeedItem(teamId);
        if (item) {
            item.timestamp = new Date(Date.now() - (i * 1000 * 30)); // Stagger timestamps
            state.liveFeed.push(item);
        }
    }

    renderLiveFeed();

    // Start generating new items
    liveFeedInterval = setInterval(() => {
        if (state.currentWorkspaceTeam === teamId) {
            const item = generateLiveFeedItem(teamId);
            if (item) {
                state.liveFeed.unshift(item);
                if (state.liveFeed.length > 20) {
                    state.liveFeed.pop();
                }
                renderLiveFeed();
            }
        }
    }, 3000);
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
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Initial renders
    renderTeamsGrid();
    renderDecisionQueue();
    renderActivityFeed();
    renderPriorityQueue();
    renderProjectList();
    renderCommsLog();
    updateStats();

    // Initialize World Controller UI
    updateWorldControlUI();
    renderControlLog();
    renderPendingActions();

    // Initialize API config panel
    initApiConfigPanel();

    // Start clock
    updateClock();
    setInterval(updateClock, 1000);

    // ============================================
    // WORLD CONTROLLER EVENT LISTENERS
    // ============================================

    // Master Pause Button
    document.getElementById('masterPauseBtn')?.addEventListener('click', () => {
        if (state.worldController.globalPaused) {
            resumeWorld(WORLD_STATES.MANUAL);
        } else {
            pauseWorld('Manual pause by owner');
        }
    });

    // Emergency Stop Button
    document.getElementById('emergencyStopBtn')?.addEventListener('click', () => {
        if (state.worldController.emergencyStop.triggered) {
            // Show confirmation dialog
            const code = prompt('Enter confirmation code to reset emergency stop:');
            if (code) resetEmergencyStop(code);
        } else {
            if (confirm('EMERGENCY STOP: This will immediately halt ALL agent operations. Continue?')) {
                triggerEmergencyStop('Emergency stop triggered by owner');
            }
        }
    });

    // World State Buttons
    document.querySelectorAll('.state-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const newState = btn.dataset.state;
            if (newState === 'paused') {
                pauseWorld('State set to paused');
            } else {
                if (state.worldController.globalPaused) {
                    resumeWorld(newState);
                } else {
                    setWorldState(newState);
                }
            }
        });
    });

    // Credit Limits Update
    document.getElementById('updateCreditLimitsBtn')?.addEventListener('click', () => {
        const daily = parseFloat(document.getElementById('dailyLimitInput')?.value) || 50;
        const monthly = parseFloat(document.getElementById('monthlyLimitInput')?.value) || 500;
        setCreditLimits(daily, monthly);
    });

    // Auto-stop toggle
    document.getElementById('autoStopOnLimit')?.addEventListener('change', (e) => {
        state.worldController.creditProtection.autoStopOnLimit = e.target.checked;
        showToast(`Auto-pause on limit ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
    });

    // Trigger Action Button
    document.getElementById('triggerActionBtn')?.addEventListener('click', () => {
        const teamId = document.getElementById('triggerTeamSelect')?.value;
        const actionType = document.getElementById('triggerActionSelect')?.value;
        if (teamId && actionType) {
            triggerTeamAction(teamId, actionType);
        }
    });

    // Credit indicator click - scroll to World Control tab
    document.getElementById('creditIndicator')?.addEventListener('click', () => {
        // Switch to World Control tab
        document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const worldControlTab = document.querySelector('[data-tab="worldcontrol"]');
        const worldControlContent = document.getElementById('worldcontrolTab');
        if (worldControlTab) worldControlTab.classList.add('active');
        if (worldControlContent) worldControlContent.classList.add('active');
    });

    // Resume from pause overlay
    document.getElementById('resumeFromOverlay')?.addEventListener('click', () => {
        resumeWorld(WORLD_STATES.MANUAL);
        const overlay = document.getElementById('worldPausedOverlay');
        if (overlay) overlay.classList.remove('active');
    });

    // Emergency Reset Button
    document.getElementById('emergencyResetBtn')?.addEventListener('click', () => {
        const code = document.getElementById('emergencyResetCode')?.value;
        if (resetEmergencyStop(code)) {
            document.getElementById('emergencyResetCode').value = '';
        }
    });

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

    // Real-time activity updates
    setInterval(() => {
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

            if (state.activities.length > 20) {
                state.activities.pop();
            }

            renderActivityFeed();
        }
    }, 10000);

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
    openTeamSettingsModal,
    // World Controller exports
    WORLD_STATES,
    AUTOMATION_LEVELS,
    ACTION_TYPES,
    pauseWorld,
    resumeWorld,
    setWorldState,
    triggerEmergencyStop,
    resetEmergencyStop,
    pauseTeam,
    resumeTeam,
    setTeamAutomationLevel,
    triggerTeamAction,
    setCreditLimits,
    recordSpend,
    checkCreditLimits,
    canExecuteAction,
    updateWorldControlUI
};
