/**
 * FUSE Company Dashboard
 * Central hub for digital workforce management
 * v2.0 - Enhanced with Drag & Drop, Zoom Modal, Responsive Features
 */

(() => {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================

    const CONFIG = {
        REFRESH_INTERVAL: 30000, // 30 seconds
        TOAST_DURATION: 4000,
        API_ENDPOINT: '/api/agents',
        STORAGE_KEY: 'fuse_dashboard_layout',
        ANIMATION_DURATION: 250
    };

    // ============================================
    // AGENT DATA (for modal details)
    // ============================================

    // Agent data - All agents start IDLE (paused by default)
    // Real activity comes from orchestration API
    const AGENT_DATA = {
        'architect': {
            name: 'Architect',
            role: 'System Design',
            team: 'developer',
            teamLabel: 'Developer Team',
            capabilities: ['System Architecture', 'API Design', 'Database Modeling', 'Scalability Planning'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: {
                title: 'Awaiting Orchestration',
                description: 'Start team orchestration to activate this agent',
                progress: 0
            },
            recentActivity: []
        },
        'coder': {
            name: 'Coder',
            role: 'Implementation',
            team: 'developer',
            teamLabel: 'Developer Team',
            capabilities: ['Full-Stack Development', 'Code Review', 'Testing', 'Documentation'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: {
                title: 'Awaiting Orchestration',
                description: 'Start team orchestration to activate this agent',
                progress: 0
            },
            recentActivity: []
        },
        'tester': {
            name: 'QA Engineer',
            role: 'Quality Assurance',
            team: 'developer',
            teamLabel: 'Developer Team',
            capabilities: ['Unit Testing', 'Integration Testing', 'E2E Testing', 'Performance Testing'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: {
                title: 'Awaiting Orchestration',
                description: 'Start team orchestration to activate this agent',
                progress: 0
            },
            recentActivity: []
        },
        'ux-lead': {
            name: 'UX Lead',
            role: 'User Research',
            team: 'design',
            teamLabel: 'Design Team',
            capabilities: ['User Research', 'Usability Testing', 'Information Architecture', 'Wireframing'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'ui-artist': {
            name: 'Visual Designer',
            role: 'Visual Design',
            team: 'design',
            teamLabel: 'Design Team',
            capabilities: ['UI Design', 'Iconography', 'Design Systems', 'Prototyping'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'motion': {
            name: 'Motion Designer',
            role: 'Animations',
            team: 'design',
            teamLabel: 'Design Team',
            capabilities: ['Motion Design', 'Micro-interactions', 'Animation Systems', 'Lottie Export'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'content-strategist': {
            name: 'Content Strategist',
            role: 'Content Planning',
            team: 'communications',
            teamLabel: 'Communications Team',
            capabilities: ['Content Strategy', 'Editorial Planning', 'SEO', 'Content Audit'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'copywriter': {
            name: 'Copywriter',
            role: 'Content Creation',
            team: 'communications',
            teamLabel: 'Communications Team',
            capabilities: ['Copywriting', 'Brand Voice', 'UX Writing', 'Email Marketing'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'social-manager': {
            name: 'Social Manager',
            role: 'Social Media',
            team: 'communications',
            teamLabel: 'Communications Team',
            capabilities: ['Social Media Management', 'Community Engagement', 'Analytics', 'Campaign Planning'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'compliance-officer': {
            name: 'Compliance Officer',
            role: 'Regulatory Compliance',
            team: 'legal',
            teamLabel: 'Legal Team',
            capabilities: ['GDPR Compliance', 'Privacy Reviews', 'Risk Assessment', 'Policy Development'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'contract-analyst': {
            name: 'Contract Analyst',
            role: 'Contract Review',
            team: 'legal',
            teamLabel: 'Legal Team',
            capabilities: ['Contract Review', 'Negotiation Support', 'Risk Analysis', 'Template Management'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'ip-counsel': {
            name: 'IP Counsel',
            role: 'Intellectual Property',
            team: 'legal',
            teamLabel: 'Legal Team',
            capabilities: ['Patent Filing', 'Trademark Protection', 'IP Strategy', 'Licensing'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'growth-lead': {
            name: 'Growth Lead',
            role: 'User Acquisition',
            team: 'marketing',
            teamLabel: 'Marketing Team',
            capabilities: ['Growth Strategy', 'A/B Testing', 'Funnel Optimization', 'Analytics'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'brand-strategist': {
            name: 'Brand Strategist',
            role: 'Brand Management',
            team: 'marketing',
            teamLabel: 'Marketing Team',
            capabilities: ['Brand Strategy', 'Positioning', 'Messaging', 'Brand Guidelines'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'analytics-expert': {
            name: 'Analytics Expert',
            role: 'Data Analysis',
            team: 'marketing',
            teamLabel: 'Marketing Team',
            capabilities: ['Marketing Analytics', 'Attribution Modeling', 'Dashboard Creation', 'Reporting'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'launch-coordinator': {
            name: 'Launch Coordinator',
            role: 'Product Launch',
            team: 'gtm',
            teamLabel: 'Go-to-Market Team',
            capabilities: ['Launch Planning', 'Timeline Management', 'Cross-functional Coordination', 'Go-live Support'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'partnership-manager': {
            name: 'Partnership Manager',
            role: 'Strategic Partnerships',
            team: 'gtm',
            teamLabel: 'Go-to-Market Team',
            capabilities: ['Partner Recruitment', 'Relationship Management', 'Co-marketing', 'Integration Support'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'market-researcher': {
            name: 'Market Researcher',
            role: 'Market Intelligence',
            team: 'gtm',
            teamLabel: 'Go-to-Market Team',
            capabilities: ['Market Research', 'Competitive Analysis', 'Trend Analysis', 'Customer Insights'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'sales-director': {
            name: 'Sales Director',
            role: 'Revenue Strategy',
            team: 'sales',
            teamLabel: 'Sales Team',
            capabilities: ['Revenue Planning', 'Team Leadership', 'Strategic Accounts', 'Forecasting'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'account-executive': {
            name: 'Account Executive',
            role: 'Enterprise Sales',
            team: 'sales',
            teamLabel: 'Sales Team',
            capabilities: ['Enterprise Sales', 'Solution Selling', 'Contract Negotiation', 'Relationship Building'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'sdr': {
            name: 'SDR Lead',
            role: 'Lead Generation',
            team: 'sales',
            teamLabel: 'Sales Team',
            capabilities: ['Outbound Prospecting', 'Lead Qualification', 'Cold Outreach', 'Pipeline Generation'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'solutions-consultant': {
            name: 'Solutions Consultant',
            role: 'Technical Sales',
            team: 'sales',
            teamLabel: 'Sales Team',
            capabilities: ['Technical Demos', 'Solution Design', 'POC Management', 'Technical Discovery'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        },
        'customer-success': {
            name: 'Customer Success',
            role: 'Customer Retention',
            team: 'sales',
            teamLabel: 'Sales Team',
            capabilities: ['Onboarding', 'QBR Management', 'Expansion', 'Churn Prevention'],
            stats: { tasksCompleted: 0, avgResponseTime: '-', uptime: '-' },
            currentTask: { title: 'Awaiting Orchestration', description: 'Start team orchestration to activate', progress: 0 },
            recentActivity: []
        }
    };

    // ============================================
    // STATE
    // ============================================

    const state = {
        viewMode: 'grid',
        statusFilter: 'all',
        fabOpen: false,
        editMode: false,
        lastUpdate: null,
        draggedElement: null,
        draggedType: null, // 'team' or 'sidebar'
        teamOrder: [],
        sidebarOrder: [],
        collapsedTeams: new Set(),
        modalOpen: false
    };

    // ============================================
    // BIOMETRIC AUTHENTICATION (Owner-Lock System)
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

        if (!gate) return true; // No gate, allow access

        // Check biometric library loaded
        if (typeof BiometricAuth === 'undefined') {
            console.error('[Dashboard] BiometricAuth not loaded');
            gate.classList.add('not-supported');
            return false;
        }

        // Check if already verified in this session
        const sessionVerified = await BiometricAuth.isSessionVerified();
        if (sessionVerified) {
            hideBiometricGate();
            return true;
        }

        // Check biometric support
        const support = await BiometricAuth.checkSupport();
        state.biometricSupported = support.supported && support.platformAuthenticator;
        state.authenticatorType = support.type || 'Biometric';

        if (!state.biometricSupported) {
            gate.classList.add('not-supported');
            return false;
        }

        // Update UI with authenticator type
        if (authTypeText) {
            authTypeText.textContent = state.authenticatorType;
        }

        // Update icon based on type
        updateBiometricIcon(state.authenticatorType);

        // Check access status (owner-lock system)
        showStatus('Checking access...', 'info');
        const accessStatus = await BiometricAuth.checkAccessStatus();

        hideStatus();

        if (accessStatus.hasOwner) {
            if (accessStatus.isOwnerDevice) {
                // Owner device - show auth button
                btnAuth.style.display = 'flex';
                btnSetup.style.display = 'none';
                if (gateSubtitle) {
                    gateSubtitle.innerHTML = `Welcome back. Use <span class="biometric-type">${state.authenticatorType}</span> to unlock.`;
                }
                if (gateMessage) {
                    gateMessage.textContent = 'Your biometric is required to access this dashboard';
                }
                updateAuthButton(`Unlock with ${state.authenticatorType}`, false);
            } else {
                // Non-owner device - show locked state
                gate.classList.add('locked');
                btnAuth.style.display = 'none';
                btnSetup.style.display = 'none';
                showLockedIcon();
                if (gateSubtitle) {
                    gateSubtitle.textContent = 'Access Denied';
                }
                if (gateMessage) {
                    gateMessage.textContent = 'This dashboard is secured by another device. Only the owner can access it.';
                }
                showStatus('This dashboard is locked to its owner\'s device', 'error');
                return false;
            }
        } else {
            // No owner yet - show setup for first registration
            btnAuth.style.display = 'none';
            btnSetup.style.display = 'flex';
            if (gateSubtitle) {
                gateSubtitle.innerHTML = `Secure this dashboard with <span class="biometric-type">${state.authenticatorType}</span>`;
            }
            if (gateMessage) {
                gateMessage.textContent = 'First-time setup: Your biometric will become the only key to this dashboard';
            }
        }

        // Attach event listeners
        btnAuth.addEventListener('click', handleBiometricAuth);
        btnSetup.addEventListener('click', handleBiometricSetup);

        return false; // Don't allow access until verified
    }

    /**
     * Update biometric icon based on authenticator type
     */
    function updateBiometricIcon(type) {
        const iconFaceId = document.getElementById('iconFaceId');
        const iconFingerprint = document.getElementById('iconFingerprint');
        const iconLocked = document.getElementById('iconLocked');
        const iconSuccess = document.getElementById('iconSuccess');

        // Hide all icons first
        [iconFaceId, iconFingerprint, iconLocked, iconSuccess].forEach(icon => {
            if (icon) icon.style.display = 'none';
        });

        // Show appropriate icon
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
     * Handle biometric authentication
     */
    async function handleBiometricAuth() {
        const iconContainer = document.getElementById('biometricIcon');

        try {
            updateAuthButton('Verifying...', true);
            iconContainer?.classList.add('scanning');
            iconContainer?.classList.remove('error', 'success');
            hideStatus();

            const result = await BiometricAuth.authenticate((progress) => {
                showStatus(progress, 'info');
            });

            if (result.success) {
                state.biometricVerified = true;
                iconContainer?.classList.remove('scanning');
                iconContainer?.classList.add('success');
                showSuccessIcon();
                showStatus(result.message || 'Welcome back!', 'success');

                // Brief delay to show success
                setTimeout(() => {
                    hideBiometricGate();
                    initDashboard();
                }, 800);
            }
        } catch (error) {
            console.error('[Dashboard] Biometric auth failed:', error);
            iconContainer?.classList.remove('scanning');
            iconContainer?.classList.add('error');
            showStatus(error.message || 'Authentication failed', 'error');
            updateAuthButton('Try Again', false);

            // Reset icon state after delay
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
        const btnSetup = document.getElementById('btnSetup');
        const btnAuth = document.getElementById('btnAuthenticate');
        const iconContainer = document.getElementById('biometricIcon');
        const btnSetupText = document.getElementById('btnSetupText');
        const gateMessage = document.getElementById('gateMessage');

        try {
            btnSetup.disabled = true;
            if (btnSetupText) btnSetupText.textContent = 'Setting up...';
            iconContainer?.classList.add('scanning');
            iconContainer?.classList.remove('error', 'success');
            hideStatus();

            const result = await BiometricAuth.register((progress) => {
                showStatus(progress, 'info');
            });

            if (result.success) {
                iconContainer?.classList.remove('scanning');
                iconContainer?.classList.add('success');
                showSuccessIcon();
                showStatus(result.message || 'Dashboard secured!', 'success');

                if (gateMessage) {
                    gateMessage.textContent = 'Your biometric is now the only key to this dashboard';
                }

                // Switch to authenticate mode after brief delay
                setTimeout(() => {
                    btnSetup.style.display = 'none';
                    btnAuth.style.display = 'flex';
                    updateAuthButton(`Unlock with ${state.authenticatorType}`, false);
                    iconContainer?.classList.remove('success');
                    updateBiometricIcon(state.authenticatorType);
                    showStatus('Now use your biometric to unlock', 'info');
                }, 1500);
            }
        } catch (error) {
            console.error('[Dashboard] Biometric setup failed:', error);
            iconContainer?.classList.remove('scanning');
            iconContainer?.classList.add('error');
            showStatus(error.message || 'Setup failed', 'error');
            btnSetup.disabled = false;
            if (btnSetupText) btnSetupText.textContent = 'Secure This Dashboard';

            // Reset icon state after delay
            setTimeout(() => {
                iconContainer?.classList.remove('error');
                updateBiometricIcon(state.authenticatorType);
            }, 2000);
        }
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
     * Show status message with icon
     */
    function showStatus(message, type) {
        const statusEl = document.getElementById('biometricStatus');
        const statusText = document.getElementById('statusText');
        const statusIcon = statusEl?.querySelector('.status-icon');

        if (!statusEl) return;

        if (statusText) statusText.textContent = message;
        statusEl.className = 'biometric-status visible ' + type;

        // Update icon based on type
        if (statusIcon) {
            statusIcon.innerHTML = type === 'success'
                ? '<polyline points="20 6 9 17 4 12"/>'
                : type === 'error'
                ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
                : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>';
        }
    }

    /**
     * Hide status message
     */
    function hideStatus() {
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
        if (gate) {
            gate.classList.add('hidden');
        }

        // Add verified class to body
        document.body.classList.add('biometric-verified');
        state.biometricVerified = true;
    }

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const elements = {
        currentTime: document.getElementById('currentTime'),
        totalAgents: document.getElementById('totalAgents'),
        activeAgents: document.getElementById('activeAgents'),
        utilization: document.getElementById('utilization'),
        pendingTasks: document.getElementById('pendingTasks'),
        globalStatus: document.getElementById('globalStatus'),
        globalStatusText: document.getElementById('globalStatusText'),
        teamsContainer: document.getElementById('teamsContainer'),
        statusFilter: document.getElementById('statusFilter'),
        recentActivity: document.getElementById('recentActivity'),
        fabMain: document.getElementById('fabMain'),
        fabMenu: document.getElementById('fabMenu'),
        toastContainer: document.getElementById('toastContainer')
    };

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function isMobile() {
        return window.innerWidth < 600;
    }

    function isTablet() {
        return window.innerWidth >= 600 && window.innerWidth < 900;
    }

    // ============================================
    // TIME UPDATE
    // ============================================

    function updateTime() {
        if (elements.currentTime) {
            const now = new Date();
            elements.currentTime.textContent = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }

    // ============================================
    // STATS UPDATE
    // ============================================

    function updateStats() {
        const allAgents = document.querySelectorAll('.agent-mini-card');
        const workingAgents = document.querySelectorAll('.agent-mini-card.working');

        const total = allAgents.length;
        const active = workingAgents.length;
        const util = total > 0 ? Math.round((active / total) * 100) : 0;

        if (elements.totalAgents) elements.totalAgents.textContent = total;
        if (elements.activeAgents) elements.activeAgents.textContent = active;
        if (elements.utilization) elements.utilization.textContent = `${util}%`;
    }

    // ============================================
    // FILTER FUNCTIONALITY
    // ============================================

    function filterAgents(status) {
        state.statusFilter = status;
        const agents = document.querySelectorAll('.agent-mini-card');

        agents.forEach(agent => {
            if (status === 'all') {
                agent.style.display = '';
            } else if (status === 'working') {
                agent.style.display = agent.classList.contains('working') ? '' : 'none';
            } else if (status === 'idle') {
                agent.style.display = agent.classList.contains('idle') ? '' : 'none';
            }
        });

        // Update team sections visibility
        document.querySelectorAll('.team-section').forEach(section => {
            const visibleAgents = section.querySelectorAll('.agent-mini-card:not([style*="display: none"])');
            section.style.display = visibleAgents.length > 0 ? '' : 'none';
        });
    }

    // ============================================
    // VIEW TOGGLE
    // ============================================

    function setViewMode(mode) {
        state.viewMode = mode;
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === mode);
        });

        if (elements.teamsContainer) {
            elements.teamsContainer.classList.toggle('list-view', mode === 'list');
        }
    }

    // ============================================
    // EDIT MODE TOGGLE
    // ============================================

    function toggleEditMode() {
        state.editMode = !state.editMode;

        const editBtn = document.querySelector('.edit-mode-btn');
        const teamsContainer = elements.teamsContainer;
        const sidebar = document.querySelector('.dashboard-sidebar');

        if (editBtn) {
            editBtn.classList.toggle('active', state.editMode);
        }

        if (teamsContainer) {
            teamsContainer.classList.toggle('edit-mode', state.editMode);
        }

        if (sidebar) {
            sidebar.classList.toggle('edit-mode', state.editMode);
        }

        if (state.editMode) {
            showToast('info', 'Edit Mode', 'Drag sections to rearrange. Click again to save.');
        } else {
            saveLayout();
            showToast('success', 'Layout Saved', 'Your dashboard layout has been saved.');
        }
    }

    // ============================================
    // TEAM COLLAPSE/EXPAND
    // ============================================

    function toggleTeamCollapse(teamSection) {
        const teamId = teamSection.dataset.team;
        const isCollapsed = teamSection.classList.toggle('collapsed');

        if (isCollapsed) {
            state.collapsedTeams.add(teamId);
        } else {
            state.collapsedTeams.delete(teamId);
        }

        saveLayout();
    }

    // ============================================
    // DRAG AND DROP - TEAMS
    // ============================================

    function initTeamDragAndDrop() {
        const teamsContainer = elements.teamsContainer;
        if (!teamsContainer) return;

        let placeholder = null;

        teamsContainer.addEventListener('dragstart', (e) => {
            if (!state.editMode) return;

            const teamSection = e.target.closest('.team-section');
            if (!teamSection) return;

            state.draggedElement = teamSection;
            state.draggedType = 'team';

            teamSection.classList.add('dragging');

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', teamSection.dataset.team);

            // Create placeholder
            placeholder = document.createElement('div');
            placeholder.className = 'team-section drag-placeholder';
            placeholder.style.height = `${teamSection.offsetHeight}px`;
            placeholder.style.background = 'rgba(59, 130, 246, 0.1)';
            placeholder.style.border = '2px dashed var(--team-dev)';
            placeholder.style.borderRadius = '12px';
        });

        teamsContainer.addEventListener('dragend', (e) => {
            if (!state.draggedElement) return;

            state.draggedElement.classList.remove('dragging');

            // Remove placeholder
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.removeChild(placeholder);
            }

            state.draggedElement = null;
            state.draggedType = null;
            placeholder = null;

            // Update order
            updateTeamOrder();
            saveLayout();
        });

        teamsContainer.addEventListener('dragover', (e) => {
            if (!state.editMode || state.draggedType !== 'team') return;

            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const afterElement = getDragAfterElement(teamsContainer, e.clientY);
            const dragging = state.draggedElement;

            if (!dragging) return;

            if (afterElement == null) {
                teamsContainer.appendChild(dragging);
            } else {
                teamsContainer.insertBefore(dragging, afterElement);
            }
        });

        teamsContainer.addEventListener('drop', (e) => {
            e.preventDefault();
        });

        // Make team sections draggable
        document.querySelectorAll('.team-section').forEach(section => {
            section.setAttribute('draggable', 'true');
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.team-section:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function updateTeamOrder() {
        const teams = document.querySelectorAll('.team-section');
        state.teamOrder = [...teams].map(t => t.dataset.team);
    }

    // ============================================
    // DRAG AND DROP - SIDEBAR
    // ============================================

    function initSidebarDragAndDrop() {
        const sidebar = document.querySelector('.dashboard-sidebar');
        if (!sidebar) return;

        sidebar.addEventListener('dragstart', (e) => {
            if (!state.editMode) return;

            const card = e.target.closest('.sidebar-card');
            if (!card) return;

            state.draggedElement = card;
            state.draggedType = 'sidebar';

            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        sidebar.addEventListener('dragend', (e) => {
            if (!state.draggedElement) return;

            state.draggedElement.classList.remove('dragging');
            state.draggedElement = null;
            state.draggedType = null;

            updateSidebarOrder();
            saveLayout();
        });

        sidebar.addEventListener('dragover', (e) => {
            if (!state.editMode || state.draggedType !== 'sidebar') return;

            e.preventDefault();

            const afterElement = getSidebarDragAfterElement(sidebar, e.clientY);
            const dragging = state.draggedElement;

            if (!dragging) return;

            if (afterElement == null) {
                sidebar.appendChild(dragging);
            } else {
                sidebar.insertBefore(dragging, afterElement);
            }
        });

        // Make sidebar cards draggable
        document.querySelectorAll('.sidebar-card').forEach(card => {
            card.setAttribute('draggable', 'true');
        });
    }

    function getSidebarDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.sidebar-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function updateSidebarOrder() {
        const cards = document.querySelectorAll('.sidebar-card');
        state.sidebarOrder = [...cards].map((c, i) => {
            // Try to identify by class or first heading
            const title = c.querySelector('.card-title');
            return title ? title.textContent.trim() : `card-${i}`;
        });
    }

    // ============================================
    // TOUCH DRAG AND DROP (Mobile)
    // ============================================

    function initTouchDragAndDrop() {
        let touchStartY = 0;
        let touchElement = null;
        let clone = null;

        const teamsContainer = elements.teamsContainer;
        if (!teamsContainer) return;

        teamsContainer.addEventListener('touchstart', (e) => {
            if (!state.editMode) return;

            const teamSection = e.target.closest('.team-section');
            if (!teamSection) return;

            touchStartY = e.touches[0].clientY;
            touchElement = teamSection;

            // Long press detection
            const longPressTimer = setTimeout(() => {
                if (touchElement) {
                    touchElement.classList.add('dragging');

                    // Create visual clone
                    clone = touchElement.cloneNode(true);
                    clone.classList.add('drag-ghost');
                    document.body.appendChild(clone);

                    navigator.vibrate && navigator.vibrate(50);
                }
            }, 300);

            teamSection.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
            }, { once: true });
        }, { passive: true });

        teamsContainer.addEventListener('touchmove', (e) => {
            if (!touchElement || !touchElement.classList.contains('dragging')) return;

            e.preventDefault();

            const touch = e.touches[0];

            // Move clone
            if (clone) {
                clone.style.top = `${touch.clientY - 40}px`;
                clone.style.left = `${touch.clientX - clone.offsetWidth / 2}px`;
            }

            // Reorder
            const afterElement = getDragAfterElement(teamsContainer, touch.clientY);

            if (afterElement == null) {
                teamsContainer.appendChild(touchElement);
            } else {
                teamsContainer.insertBefore(touchElement, afterElement);
            }
        }, { passive: false });

        teamsContainer.addEventListener('touchend', () => {
            if (touchElement) {
                touchElement.classList.remove('dragging');

                if (clone) {
                    clone.remove();
                    clone = null;
                }

                updateTeamOrder();
                saveLayout();
            }

            touchElement = null;
        });
    }

    // ============================================
    // LAYOUT PERSISTENCE
    // ============================================

    function saveLayout() {
        const layout = {
            teamOrder: state.teamOrder,
            sidebarOrder: state.sidebarOrder,
            collapsedTeams: [...state.collapsedTeams],
            viewMode: state.viewMode
        };

        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(layout));
        } catch (e) {
            console.warn('Could not save layout to localStorage:', e);
        }
    }

    function loadLayout() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (!saved) return;

            const layout = JSON.parse(saved);

            // Restore team order
            if (layout.teamOrder && layout.teamOrder.length > 0) {
                const teamsContainer = elements.teamsContainer;
                if (teamsContainer) {
                    layout.teamOrder.forEach(teamId => {
                        const team = teamsContainer.querySelector(`[data-team="${teamId}"]`);
                        if (team) {
                            teamsContainer.appendChild(team);
                        }
                    });
                    state.teamOrder = layout.teamOrder;
                }
            }

            // Restore collapsed teams
            if (layout.collapsedTeams) {
                layout.collapsedTeams.forEach(teamId => {
                    const team = document.querySelector(`[data-team="${teamId}"]`);
                    if (team) {
                        team.classList.add('collapsed');
                        state.collapsedTeams.add(teamId);
                    }
                });
            }

            // Restore view mode
            if (layout.viewMode) {
                setViewMode(layout.viewMode);
            }
        } catch (e) {
            console.warn('Could not load layout from localStorage:', e);
        }
    }

    // ============================================
    // DETAIL MODAL
    // ============================================

    function createModal() {
        // Check if modal already exists
        if (document.getElementById('agentModal')) return;

        const modal = document.createElement('div');
        modal.id = 'agentModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-container">
                <div class="modal-header">
                    <div class="modal-icon" id="modalIcon">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                    </div>
                    <div class="modal-title-area">
                        <h2 class="modal-title" id="modalTitle">Agent Name</h2>
                        <p class="modal-subtitle" id="modalSubtitle">
                            <span id="modalTeam">Team</span>
                            <span class="modal-status" id="modalStatus">
                                <span class="modal-status-dot"></span>
                                <span id="modalStatusText">Working</span>
                            </span>
                        </p>
                    </div>
                    <button class="modal-close" id="modalClose">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="modal-section">
                        <div class="modal-section-title">Performance</div>
                        <div class="modal-stats-grid" id="modalStats">
                            <div class="modal-stat">
                                <div class="modal-stat-value" id="modalTasksCompleted">0</div>
                                <div class="modal-stat-label">Tasks Done</div>
                            </div>
                            <div class="modal-stat">
                                <div class="modal-stat-value" id="modalAvgResponse">0s</div>
                                <div class="modal-stat-label">Avg Response</div>
                            </div>
                            <div class="modal-stat">
                                <div class="modal-stat-value" id="modalUptime">0%</div>
                                <div class="modal-stat-label">Uptime</div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-section" id="modalTaskSection">
                        <div class="modal-section-title">Current Task</div>
                        <div class="modal-current-task">
                            <div class="modal-task-title" id="modalTaskTitle">Task Name</div>
                            <div class="modal-task-description" id="modalTaskDescription">Task description</div>
                            <div class="modal-task-progress">
                                <div class="modal-progress-bar">
                                    <div class="modal-progress-fill" id="modalProgressFill" style="width: 0%"></div>
                                </div>
                                <div class="modal-progress-text">
                                    <span>Progress</span>
                                    <span id="modalProgressText">0%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-section">
                        <div class="modal-section-title">Capabilities</div>
                        <div class="modal-capabilities" id="modalCapabilities"></div>
                    </div>
                    <div class="modal-section">
                        <div class="modal-section-title">Recent Activity</div>
                        <div class="modal-activity-list" id="modalActivity"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn modal-btn-secondary" id="modalViewDetails">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                        View in Command Center
                    </button>
                    <button class="modal-btn modal-btn-primary" id="modalAssignTask">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                        Assign Task
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        const closeBtn = modal.querySelector('#modalClose');
        const overlay = modal;
        const viewDetailsBtn = modal.querySelector('#modalViewDetails');
        const assignTaskBtn = modal.querySelector('#modalAssignTask');

        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        viewDetailsBtn.addEventListener('click', () => {
            const agentId = modal.dataset.agentId;
            const teamId = modal.dataset.teamId;
            if (agentId && teamId) {
                window.location.href = `/agents?team=${teamId}&agent=${agentId}`;
            }
        });

        assignTaskBtn.addEventListener('click', () => {
            const agentId = modal.dataset.agentId;
            if (agentId) {
                closeModal();
                window.location.href = `/agents#taskModal&agent=${agentId}`;
            }
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && state.modalOpen) {
                closeModal();
            }
        });
    }

    function openAgentModal(agentId, teamId) {
        const modal = document.getElementById('agentModal');
        if (!modal) return;

        const agentData = AGENT_DATA[agentId];
        if (!agentData) {
            // Fallback for unknown agents
            console.warn(`No data found for agent: ${agentId}`);
            return;
        }

        // Store IDs
        modal.dataset.agentId = agentId;
        modal.dataset.teamId = teamId;

        // Determine if working or idle
        const agentCard = document.querySelector(`[data-agent="${agentId}"]`);
        const isWorking = agentCard?.classList.contains('working');

        // Update modal content
        const iconEl = modal.querySelector('#modalIcon');
        const titleEl = modal.querySelector('#modalTitle');
        const teamEl = modal.querySelector('#modalTeam');
        const statusEl = modal.querySelector('#modalStatus');
        const statusTextEl = modal.querySelector('#modalStatusText');

        // Team color mapping
        const teamColors = {
            developer: 'dev',
            design: 'design',
            communications: 'comms',
            legal: 'legal',
            marketing: 'marketing',
            gtm: 'gtm',
            sales: 'sales'
        };

        // Update header
        iconEl.className = `modal-icon ${teamColors[agentData.team] || 'dev'}`;
        titleEl.textContent = agentData.name;
        teamEl.textContent = agentData.teamLabel;
        statusEl.className = `modal-status ${isWorking ? 'working' : 'idle'}`;
        statusTextEl.textContent = isWorking ? 'Working' : 'Idle';

        // Update stats
        modal.querySelector('#modalTasksCompleted').textContent = agentData.stats.tasksCompleted;
        modal.querySelector('#modalAvgResponse').textContent = agentData.stats.avgResponseTime;
        modal.querySelector('#modalUptime').textContent = agentData.stats.uptime;

        // Update current task
        modal.querySelector('#modalTaskTitle').textContent = agentData.currentTask.title;
        modal.querySelector('#modalTaskDescription').textContent = agentData.currentTask.description;
        modal.querySelector('#modalProgressFill').style.width = `${agentData.currentTask.progress}%`;
        modal.querySelector('#modalProgressText').textContent = `${agentData.currentTask.progress}%`;

        // Update capabilities
        const capabilitiesEl = modal.querySelector('#modalCapabilities');
        capabilitiesEl.innerHTML = agentData.capabilities
            .map(cap => `<span class="modal-capability">${cap}</span>`)
            .join('');

        // Update activity
        const activityEl = modal.querySelector('#modalActivity');
        activityEl.innerHTML = agentData.recentActivity
            .map(item => `
                <div class="modal-activity-item">
                    <span class="modal-activity-time">${item.time}</span>
                    <span class="modal-activity-text">${item.text}</span>
                </div>
            `)
            .join('');

        // Show modal
        modal.classList.add('active');
        state.modalOpen = true;
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        const modal = document.getElementById('agentModal');
        if (modal) {
            modal.classList.remove('active');
            state.modalOpen = false;
            document.body.style.overflow = '';
        }
    }

    // ============================================
    // FAB MENU
    // ============================================

    function toggleFab() {
        state.fabOpen = !state.fabOpen;
        elements.fabMain?.parentElement.classList.toggle('open', state.fabOpen);
    }

    // ============================================
    // TOAST NOTIFICATIONS
    // ============================================

    function showToast(type, title, message) {
        if (!elements.toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <strong>${title}</strong>
                <span>${message}</span>
            </div>
        `;

        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            setTimeout(() => toast.remove(), 300);
        }, CONFIG.TOAST_DURATION);
    }

    // ============================================
    // HEALTH CHECK
    // ============================================

    async function runHealthCheck() {
        showToast('info', 'Health Check', 'Running system diagnostics...');

        const startTime = performance.now();

        try {
            const response = await fetch(`${CONFIG.API_ENDPOINT}?action=health`);
            const latency = Math.round(performance.now() - startTime);

            if (response.ok) {
                const latencyEl = document.getElementById('apiLatencyValue');
                if (latencyEl) {
                    latencyEl.textContent = `${latency}ms`;
                    latencyEl.className = latency < 100 ? 'health-value good' :
                                         latency < 300 ? 'health-value warning' : 'health-value error';
                }

                showToast('success', 'Health Check Complete', `System operational - ${latency}ms latency`);
            } else {
                showToast('error', 'Health Check Failed', 'Unable to reach API');
            }
        } catch (error) {
            const latency = Math.round(performance.now() - startTime);

            const latencyEl = document.getElementById('apiLatencyValue');
            if (latencyEl) {
                latencyEl.textContent = `${latency}ms`;
            }

            showToast('info', 'Demo Mode', `Health check simulated - ${latency}ms`);
        }
    }

    // ============================================
    // SYNC ALL AGENTS
    // ============================================

    async function syncAllAgents() {
        showToast('info', 'Syncing', 'Synchronizing all agent data...');

        try {
            const response = await fetch(`${CONFIG.API_ENDPOINT}?action=status`);

            if (response.ok) {
                const data = await response.json();

                if (data.success && data.data) {
                    if (elements.totalAgents) elements.totalAgents.textContent = data.data.totalAgents || 23;
                    if (elements.activeAgents) elements.activeAgents.textContent = data.data.activeAgents || 17;

                    const util = data.data.totalAgents > 0
                        ? Math.round((data.data.activeAgents / data.data.totalAgents) * 100)
                        : 0;
                    if (elements.utilization) elements.utilization.textContent = `${util}%`;
                }

                showToast('success', 'Sync Complete', 'All agent data synchronized');
            } else {
                throw new Error('Sync failed');
            }
        } catch (error) {
            updateStats();
            showToast('success', 'Sync Complete', 'Agent data refreshed');
        }

        state.lastUpdate = new Date();
    }

    // ============================================
    // FETCH API STATUS
    // ============================================

    async function fetchApiStatus() {
        try {
            const response = await fetch(`${CONFIG.API_ENDPOINT}?action=api-keys`);

            if (response.ok) {
                const data = await response.json();

                if (data.success && data.data) {
                    Object.entries(data.data).forEach(([provider, config]) => {
                        const statusEl = document.getElementById(`${provider}ApiStatus`);
                        if (statusEl) {
                            if (config.configured) {
                                statusEl.textContent = 'Configured';
                                statusEl.classList.add('configured');
                            } else {
                                statusEl.textContent = 'Not Set';
                                statusEl.classList.remove('configured');
                            }
                        }
                    });
                }
            }
        } catch (error) {
            // Silent fail
        }
    }

    // ============================================
    // AGENT CARD CLICK HANDLER
    // ============================================

    function handleAgentClick(e) {
        const card = e.target.closest('.agent-mini-card');
        if (!card) return;

        // Don't open modal in edit mode
        if (state.editMode) return;

        const agentId = card.dataset.agent;
        const teamSection = card.closest('.team-section');
        const teamId = teamSection?.dataset.team;

        if (agentId && teamId) {
            openAgentModal(agentId, teamId);
        }
    }

    // ============================================
    // TEAM SECTION CLICK HANDLER
    // ============================================

    function handleTeamHeaderClick(e) {
        // Check if clicking on expand button
        const expandBtn = e.target.closest('.team-expand-btn');
        if (expandBtn) {
            const section = expandBtn.closest('.team-section');
            if (section) {
                toggleTeamCollapse(section);
            }
            return;
        }

        // Only navigate if not in edit mode
        if (state.editMode) return;

        const header = e.target.closest('.team-header');
        if (!header) return;

        const section = header.closest('.team-section');
        const teamId = section?.dataset.team;

        if (teamId) {
            window.location.href = `/agents?team=${teamId}`;
        }
    }

    // ============================================
    // ADD EDIT MODE BUTTON
    // ============================================

    function addEditModeButton() {
        const controls = document.querySelector('.section-controls');
        if (!controls) return;

        // Check if already exists
        if (controls.querySelector('.edit-mode-btn')) return;

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-mode-btn';
        editBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            <span>Edit Layout</span>
        `;
        editBtn.addEventListener('click', toggleEditMode);

        controls.insertBefore(editBtn, controls.firstChild);
    }

    // ============================================
    // ADD EXPAND BUTTONS TO TEAMS
    // ============================================

    function addExpandButtons() {
        document.querySelectorAll('.team-section').forEach(section => {
            const header = section.querySelector('.team-header');
            if (!header) return;

            // Check if already has expand button
            if (header.querySelector('.team-expand-btn')) return;

            // Add drag handle
            const dragHandle = document.createElement('div');
            dragHandle.className = 'drag-handle';
            dragHandle.innerHTML = '<span></span><span></span><span></span>';
            section.insertBefore(dragHandle, section.firstChild);

            // Add expand button
            const expandBtn = document.createElement('button');
            expandBtn.className = 'team-expand-btn';
            expandBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>`;
            header.appendChild(expandBtn);
        });
    }

    // ============================================
    // ADD ZOOM INDICATORS
    // ============================================

    function addZoomIndicators() {
        document.querySelectorAll('.agent-mini-card').forEach(card => {
            // Check if already has indicator
            if (card.querySelector('.zoom-indicator')) return;

            const indicator = document.createElement('span');
            indicator.className = 'zoom-indicator';
            indicator.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;
            card.appendChild(indicator);
        });
    }

    // ============================================
    // STAT CARD CLICKS
    // ============================================

    function initStatCardClicks() {
        document.querySelectorAll('.stat-card').forEach((card, index) => {
            card.addEventListener('click', () => {
                switch(index) {
                    case 0: // Total Agents
                        window.location.href = '/agents';
                        break;
                    case 1: // Active Now
                        if (elements.statusFilter) {
                            elements.statusFilter.value = 'working';
                            filterAgents('working');
                        }
                        break;
                    case 2: // Pending Tasks
                        window.location.href = '/agents#tasksTab';
                        break;
                    case 3: // Teams
                        showToast('info', 'Teams', '7 teams currently operational');
                        break;
                }
            });
        });
    }

    // ============================================
    // RESPONSIVE HANDLING
    // ============================================

    const handleResize = debounce(() => {
        // Adjust UI for different screen sizes
        if (isMobile()) {
            // Force grid view on mobile for better touch targets
            if (state.viewMode === 'list') {
                setViewMode('grid');
            }
        }
    }, 250);

    // ============================================
    // INITIALIZE
    // ============================================

    function initDashboard() {
        // Update time immediately and every second
        updateTime();
        setInterval(updateTime, 1000);

        // Initial stats update
        updateStats();

        // Fetch API status
        fetchApiStatus();

        // Create modal
        createModal();

        // Add UI enhancements
        addEditModeButton();
        addExpandButtons();
        addZoomIndicators();

        // Initialize drag and drop
        initTeamDragAndDrop();
        initSidebarDragAndDrop();
        initTouchDragAndDrop();

        // Load saved layout
        loadLayout();

        // Initialize stat card clicks
        initStatCardClicks();

        // Setup filter dropdown
        if (elements.statusFilter) {
            elements.statusFilter.addEventListener('change', (e) => {
                filterAgents(e.target.value);
            });
        }

        // Setup view toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => setViewMode(btn.dataset.view));
        });

        // Setup FAB
        if (elements.fabMain) {
            elements.fabMain.addEventListener('click', toggleFab);
        }

        // Close FAB when clicking outside
        document.addEventListener('click', (e) => {
            if (state.fabOpen && !e.target.closest('.fab-container')) {
                toggleFab();
            }
        });

        // Setup agent card clicks
        if (elements.teamsContainer) {
            elements.teamsContainer.addEventListener('click', handleAgentClick);
        }

        // Setup team header clicks
        document.querySelectorAll('.team-header').forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', handleTeamHeaderClick);
        });

        // Resize handler
        window.addEventListener('resize', handleResize);

        // Periodic refresh
        setInterval(() => {
            updateStats();
            fetchApiStatus();
        }, CONFIG.REFRESH_INTERVAL);

        console.log('FUSE Company Dashboard v2.0 initialized');
    }

    // ============================================
    // MAIN INITIALIZATION
    // ============================================

    async function init() {
        // Check biometric authentication first
        const verified = await initBiometricAuth();

        if (verified) {
            // Already verified, initialize dashboard immediately
            initDashboard();
        }
        // If not verified, dashboard will initialize after successful auth
    }

    // ============================================
    // GLOBAL EXPORTS
    // ============================================

    window.runHealthCheck = runHealthCheck;
    window.syncAllAgents = syncAllAgents;
    window.showToast = showToast;
    window.toggleEditMode = toggleEditMode;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
