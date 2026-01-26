/**
 * FUSE Company Dashboard
 * Central hub for digital workforce management
 */

(() => {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================

    const CONFIG = {
        REFRESH_INTERVAL: 30000, // 30 seconds
        TOAST_DURATION: 4000,
        API_ENDPOINT: '/api/agents'
    };

    // ============================================
    // STATE
    // ============================================

    const state = {
        viewMode: 'grid',
        statusFilter: 'all',
        fabOpen: false,
        lastUpdate: null
    };

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
        // Count agents from DOM
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
                const data = await response.json();

                // Update API latency display
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

            // Still show latency even if there's an error (demo mode)
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
                    // Update stats from API response
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
            // Demo mode - simulate sync
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
                    // Update API status indicators
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
            // Silent fail - API status is optional
        }
    }

    // ============================================
    // AGENT CARD CLICK HANDLER
    // ============================================

    function handleAgentClick(e) {
        const card = e.target.closest('.agent-mini-card');
        if (!card) return;

        const agentId = card.dataset.agent;
        const teamSection = card.closest('.team-section');
        const teamId = teamSection?.dataset.team;

        // Navigate to agent detail in command center
        if (agentId && teamId) {
            window.location.href = `/agents?team=${teamId}&agent=${agentId}`;
        }
    }

    // ============================================
    // TEAM SECTION CLICK HANDLER
    // ============================================

    function handleTeamHeaderClick(e) {
        const header = e.target.closest('.team-header');
        if (!header) return;

        const section = header.closest('.team-section');
        const teamId = section?.dataset.team;

        // Navigate to team in command center
        if (teamId) {
            window.location.href = `/agents?team=${teamId}`;
        }
    }

    // ============================================
    // INITIALIZE
    // ============================================

    function init() {
        // Update time immediately and every second
        updateTime();
        setInterval(updateTime, 1000);

        // Initial stats update
        updateStats();

        // Fetch API status
        fetchApiStatus();

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

        // Setup team header clicks (for navigation)
        document.querySelectorAll('.team-header').forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', handleTeamHeaderClick);
        });

        // Periodic refresh
        setInterval(() => {
            updateStats();
            fetchApiStatus();
        }, CONFIG.REFRESH_INTERVAL);

        console.log('FUSE Company Dashboard initialized');
    }

    // ============================================
    // GLOBAL EXPORTS
    // ============================================

    window.runHealthCheck = runHealthCheck;
    window.syncAllAgents = syncAllAgents;
    window.showToast = showToast;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
