/**
 * World Controller - Master Control System for Agentic Ecosystem
 *
 * Provides complete owner control over the entire agent world:
 * - Global pause/resume functionality
 * - Team-level pause controls
 * - World state machine (manual/semi-auto/autonomous)
 * - Action triggers per team
 * - Credit protection hard stops
 * - Automation scheduling controls
 */

// World States
const WORLD_STATES = {
    PAUSED: 'paused', // Everything stopped - no agent activity
    MANUAL: 'manual', // Owner must trigger every action
    SEMI_AUTO: 'semi_auto', // Selective automation with approval gates
    AUTONOMOUS: 'autonomous', // Full autonomy (use with caution)
};

// Team Automation Levels
const AUTOMATION_LEVELS = {
    STOPPED: 'stopped', // Team completely stopped
    MANUAL: 'manual', // All actions require approval
    SUPERVISED: 'supervised', // Major decisions need approval
    AUTONOMOUS: 'autonomous', // Team operates independently
};

// Action Types that can be triggered
const ACTION_TYPES = {
    THINK: 'think', // Agent thinking/analysis
    EXECUTE: 'execute', // Execute a task
    COMMUNICATE: 'communicate', // Inter-agent communication
    REPORT: 'report', // Generate report/status
    SYNC: 'sync', // Sync with other teams
    RESEARCH: 'research', // Research/gather information
    CREATE: 'create', // Create deliverables
    REVIEW: 'review', // Review work
};

// Credit Protection Thresholds
const CREDIT_THRESHOLDS = {
    WARNING: 0.5, // 50% - Yellow warning
    CAUTION: 0.75, // 75% - Orange caution
    CRITICAL: 0.9, // 90% - Red critical
    HARD_STOP: 1.0, // 100% - Auto-pause everything
};

/**
 * World Controller State
 * Persisted state for the entire ecosystem control
 */
let worldState = {
    // Global Controls
    worldStatus: WORLD_STATES.MANUAL, // Default to MANUAL - owner has full control
    globalPaused: false,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,

    // Team-Level Controls
    teamControls: {
        developer: { paused: false, automationLevel: AUTOMATION_LEVELS.MANUAL, allowedActions: [] },
        design: { paused: false, automationLevel: AUTOMATION_LEVELS.MANUAL, allowedActions: [] },
        communications: {
            paused: false,
            automationLevel: AUTOMATION_LEVELS.MANUAL,
            allowedActions: [],
        },
        legal: { paused: false, automationLevel: AUTOMATION_LEVELS.MANUAL, allowedActions: [] },
        marketing: { paused: false, automationLevel: AUTOMATION_LEVELS.MANUAL, allowedActions: [] },
        gtm: { paused: false, automationLevel: AUTOMATION_LEVELS.MANUAL, allowedActions: [] },
        sales: { paused: false, automationLevel: AUTOMATION_LEVELS.MANUAL, allowedActions: [] },
    },

    // Credit Protection
    creditProtection: {
        enabled: true,
        dailyLimit: 50.0, // $50 daily limit
        monthlyLimit: 500.0, // $500 monthly limit
        currentDailySpend: 0,
        currentMonthlySpend: 0,
        autoStopOnLimit: true, // Auto-pause when limit reached
        warningThreshold: CREDIT_THRESHOLDS.WARNING,
        hardStopThreshold: CREDIT_THRESHOLDS.HARD_STOP,
    },

    // Action Queue - pending manual approvals
    pendingActions: [],

    // Audit Trail
    controlLog: [],

    // Scheduled Automation Windows (for semi-auto mode)
    automationSchedule: {
        enabled: false,
        windows: [], // Array of { start: 'HH:MM', end: 'HH:MM', teams: [], actions: [] }
        timezone: 'UTC',
    },

    // Emergency Controls
    emergencyStop: {
        triggered: false,
        triggeredAt: null,
        reason: null,
        requiresManualReset: true,
    },
};

/**
 * GLOBAL PAUSE CONTROLS
 */

function pauseWorld(reason = 'Manual pause by owner', pausedBy = 'owner') {
    worldState.globalPaused = true;
    worldState.pausedAt = new Date().toISOString();
    worldState.pausedBy = pausedBy;
    worldState.pauseReason = reason;
    worldState.worldStatus = WORLD_STATES.PAUSED;

    // Pause all teams
    Object.keys(worldState.teamControls).forEach(team => {
        worldState.teamControls[team].paused = true;
    });

    logControlAction('WORLD_PAUSED', { reason, pausedBy });

    return {
        success: true,
        message: 'World paused successfully',
        state: getWorldStatus(),
    };
}

function resumeWorld(resumedBy = 'owner', targetState = WORLD_STATES.MANUAL) {
    if (worldState.emergencyStop.triggered && worldState.emergencyStop.requiresManualReset) {
        return {
            success: false,
            message: 'Emergency stop is active. Manual reset required.',
            emergencyStop: worldState.emergencyStop,
        };
    }

    worldState.globalPaused = false;
    worldState.pausedAt = null;
    worldState.pausedBy = null;
    worldState.pauseReason = null;
    worldState.worldStatus = targetState;

    // Resume all teams (but respect their individual automation levels)
    Object.keys(worldState.teamControls).forEach(team => {
        worldState.teamControls[team].paused = false;
    });

    logControlAction('WORLD_RESUMED', { resumedBy, targetState });

    return {
        success: true,
        message: `World resumed in ${targetState} mode`,
        state: getWorldStatus(),
    };
}

function setWorldState(newState, changedBy = 'owner') {
    if (!Object.values(WORLD_STATES).includes(newState)) {
        return {
            success: false,
            message: `Invalid world state: ${newState}`,
            validStates: Object.values(WORLD_STATES),
        };
    }

    const previousState = worldState.worldStatus;
    worldState.worldStatus = newState;

    if (newState === WORLD_STATES.PAUSED) {
        worldState.globalPaused = true;
        worldState.pausedAt = new Date().toISOString();
    } else {
        worldState.globalPaused = false;
    }

    logControlAction('WORLD_STATE_CHANGED', {
        from: previousState,
        to: newState,
        changedBy,
    });

    return {
        success: true,
        message: `World state changed from ${previousState} to ${newState}`,
        state: getWorldStatus(),
    };
}

/**
 * TEAM-LEVEL CONTROLS
 */

function pauseTeam(teamId, reason = 'Manual pause', pausedBy = 'owner') {
    if (!worldState.teamControls[teamId]) {
        return {
            success: false,
            message: `Unknown team: ${teamId}`,
            validTeams: Object.keys(worldState.teamControls),
        };
    }

    worldState.teamControls[teamId].paused = true;
    worldState.teamControls[teamId].pausedAt = new Date().toISOString();
    worldState.teamControls[teamId].pauseReason = reason;

    logControlAction('TEAM_PAUSED', { teamId, reason, pausedBy });

    return {
        success: true,
        message: `Team ${teamId} paused`,
        teamState: worldState.teamControls[teamId],
    };
}

function resumeTeam(teamId, resumedBy = 'owner') {
    if (!worldState.teamControls[teamId]) {
        return {
            success: false,
            message: `Unknown team: ${teamId}`,
        };
    }

    if (worldState.globalPaused) {
        return {
            success: false,
            message: 'Cannot resume team while world is paused. Resume world first.',
        };
    }

    worldState.teamControls[teamId].paused = false;
    delete worldState.teamControls[teamId].pausedAt;
    delete worldState.teamControls[teamId].pauseReason;

    logControlAction('TEAM_RESUMED', { teamId, resumedBy });

    return {
        success: true,
        message: `Team ${teamId} resumed`,
        teamState: worldState.teamControls[teamId],
    };
}

function setTeamAutomationLevel(teamId, level, allowedActions = []) {
    if (!worldState.teamControls[teamId]) {
        return {
            success: false,
            message: `Unknown team: ${teamId}`,
        };
    }

    if (!Object.values(AUTOMATION_LEVELS).includes(level)) {
        return {
            success: false,
            message: `Invalid automation level: ${level}`,
            validLevels: Object.values(AUTOMATION_LEVELS),
        };
    }

    // Validate allowed actions
    const validActions = allowedActions.filter(a => Object.values(ACTION_TYPES).includes(a));

    const previousLevel = worldState.teamControls[teamId].automationLevel;
    worldState.teamControls[teamId].automationLevel = level;
    worldState.teamControls[teamId].allowedActions = validActions;

    logControlAction('TEAM_AUTOMATION_CHANGED', {
        teamId,
        from: previousLevel,
        to: level,
        allowedActions: validActions,
    });

    return {
        success: true,
        message: `Team ${teamId} automation set to ${level}`,
        teamState: worldState.teamControls[teamId],
    };
}

/**
 * ACTION TRIGGERS - Manual execution control
 */

function triggerTeamAction(teamId, actionType, parameters = {}) {
    if (!worldState.teamControls[teamId]) {
        return {
            success: false,
            message: `Unknown team: ${teamId}`,
        };
    }

    if (!Object.values(ACTION_TYPES).includes(actionType)) {
        return {
            success: false,
            message: `Invalid action type: ${actionType}`,
            validActions: Object.values(ACTION_TYPES),
        };
    }

    // Check if world/team is paused
    if (worldState.globalPaused) {
        return {
            success: false,
            message: 'Cannot trigger action while world is paused',
        };
    }

    if (worldState.teamControls[teamId].paused) {
        return {
            success: false,
            message: `Cannot trigger action while team ${teamId} is paused`,
        };
    }

    // Check credit limits before executing
    const creditCheck = checkCreditLimits();
    if (!creditCheck.canProceed) {
        return {
            success: false,
            message: creditCheck.message,
            creditStatus: creditCheck,
        };
    }

    const action = {
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        teamId,
        actionType,
        parameters,
        triggeredAt: new Date().toISOString(),
        triggeredBy: 'owner',
        status: 'triggered',
        estimatedCost: estimateActionCost(actionType),
    };

    logControlAction('ACTION_TRIGGERED', action);

    return {
        success: true,
        message: `Action ${actionType} triggered for team ${teamId}`,
        action,
    };
}

function queueAction(teamId, actionType, parameters = {}, requiresApproval = true) {
    const action = {
        id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        teamId,
        actionType,
        parameters,
        queuedAt: new Date().toISOString(),
        status: requiresApproval ? 'pending_approval' : 'queued',
        estimatedCost: estimateActionCost(actionType),
    };

    worldState.pendingActions.push(action);

    logControlAction('ACTION_QUEUED', action);

    return {
        success: true,
        message: `Action queued for ${requiresApproval ? 'approval' : 'execution'}`,
        action,
    };
}

function approveAction(actionId) {
    const actionIndex = worldState.pendingActions.findIndex(a => a.id === actionId);

    if (actionIndex === -1) {
        return {
            success: false,
            message: `Action not found: ${actionId}`,
        };
    }

    const action = worldState.pendingActions[actionIndex];
    action.status = 'approved';
    action.approvedAt = new Date().toISOString();

    // Remove from pending and trigger
    worldState.pendingActions.splice(actionIndex, 1);

    logControlAction('ACTION_APPROVED', action);

    return triggerTeamAction(action.teamId, action.actionType, action.parameters);
}

function rejectAction(actionId, reason = 'Rejected by owner') {
    const actionIndex = worldState.pendingActions.findIndex(a => a.id === actionId);

    if (actionIndex === -1) {
        return {
            success: false,
            message: `Action not found: ${actionId}`,
        };
    }

    const action = worldState.pendingActions[actionIndex];
    action.status = 'rejected';
    action.rejectedAt = new Date().toISOString();
    action.rejectionReason = reason;

    worldState.pendingActions.splice(actionIndex, 1);

    logControlAction('ACTION_REJECTED', action);

    return {
        success: true,
        message: 'Action rejected',
        action,
    };
}

function getPendingActions() {
    return {
        count: worldState.pendingActions.length,
        actions: worldState.pendingActions,
        totalEstimatedCost: worldState.pendingActions.reduce(
            (sum, a) => sum + (a.estimatedCost || 0),
            0
        ),
    };
}

/**
 * CREDIT PROTECTION SYSTEM
 */

function setCreditLimits(daily = null, monthly = null) {
    if (daily !== null) {
        worldState.creditProtection.dailyLimit = daily;
    }
    if (monthly !== null) {
        worldState.creditProtection.monthlyLimit = monthly;
    }

    logControlAction('CREDIT_LIMITS_UPDATED', {
        dailyLimit: worldState.creditProtection.dailyLimit,
        monthlyLimit: worldState.creditProtection.monthlyLimit,
    });

    return {
        success: true,
        message: 'Credit limits updated',
        creditProtection: worldState.creditProtection,
    };
}

function recordSpend(amount, source = 'agent_action') {
    worldState.creditProtection.currentDailySpend += amount;
    worldState.creditProtection.currentMonthlySpend += amount;

    const status = checkCreditLimits();

    // Auto-pause if limit reached
    if (!status.canProceed && worldState.creditProtection.autoStopOnLimit) {
        pauseWorld(`Credit limit reached: ${status.message}`, 'credit_protection');
    }

    logControlAction('SPEND_RECORDED', {
        amount,
        source,
        dailySpend: worldState.creditProtection.currentDailySpend,
        monthlySpend: worldState.creditProtection.currentMonthlySpend,
    });

    return status;
}

function checkCreditLimits() {
    const cp = worldState.creditProtection;
    const dailyUsageRatio = cp.currentDailySpend / cp.dailyLimit;
    const monthlyUsageRatio = cp.currentMonthlySpend / cp.monthlyLimit;

    let status = 'ok';
    let canProceed = true;
    let message = 'Within limits';

    if (dailyUsageRatio >= cp.hardStopThreshold || monthlyUsageRatio >= cp.hardStopThreshold) {
        status = 'hard_stop';
        canProceed = false;
        message = 'Credit limit reached - all operations stopped';
    } else if (
        dailyUsageRatio >= CREDIT_THRESHOLDS.CRITICAL ||
        monthlyUsageRatio >= CREDIT_THRESHOLDS.CRITICAL
    ) {
        status = 'critical';
        message = 'Critical credit usage - approaching limit';
    } else if (
        dailyUsageRatio >= CREDIT_THRESHOLDS.CAUTION ||
        monthlyUsageRatio >= CREDIT_THRESHOLDS.CAUTION
    ) {
        status = 'caution';
        message = 'High credit usage - use caution';
    } else if (
        dailyUsageRatio >= CREDIT_THRESHOLDS.WARNING ||
        monthlyUsageRatio >= CREDIT_THRESHOLDS.WARNING
    ) {
        status = 'warning';
        message = 'Moderate credit usage';
    }

    return {
        status,
        canProceed,
        message,
        daily: {
            spent: cp.currentDailySpend,
            limit: cp.dailyLimit,
            remaining: cp.dailyLimit - cp.currentDailySpend,
            usagePercent: Math.round(dailyUsageRatio * 100),
        },
        monthly: {
            spent: cp.currentMonthlySpend,
            limit: cp.monthlyLimit,
            remaining: cp.monthlyLimit - cp.currentMonthlySpend,
            usagePercent: Math.round(monthlyUsageRatio * 100),
        },
    };
}

function resetDailySpend() {
    worldState.creditProtection.currentDailySpend = 0;
    logControlAction('DAILY_SPEND_RESET', {});
    return { success: true, message: 'Daily spend reset' };
}

function resetMonthlySpend() {
    worldState.creditProtection.currentMonthlySpend = 0;
    logControlAction('MONTHLY_SPEND_RESET', {});
    return { success: true, message: 'Monthly spend reset' };
}

/**
 * EMERGENCY CONTROLS
 */

function triggerEmergencyStop(reason = 'Emergency stop triggered') {
    worldState.emergencyStop = {
        triggered: true,
        triggeredAt: new Date().toISOString(),
        reason,
        requiresManualReset: true,
    };

    // Immediately pause everything
    pauseWorld(reason, 'emergency_stop');

    logControlAction('EMERGENCY_STOP', { reason });

    return {
        success: true,
        message: 'EMERGENCY STOP ACTIVATED - All operations halted',
        emergencyStop: worldState.emergencyStop,
    };
}

function resetEmergencyStop(resetBy = 'owner', confirmationCode = null) {
    // Require confirmation for safety
    if (!confirmationCode || confirmationCode !== 'CONFIRM_RESET') {
        return {
            success: false,
            message: 'Emergency stop reset requires confirmation code: CONFIRM_RESET',
        };
    }

    worldState.emergencyStop = {
        triggered: false,
        triggeredAt: null,
        reason: null,
        requiresManualReset: true,
    };

    logControlAction('EMERGENCY_STOP_RESET', { resetBy });

    return {
        success: true,
        message: 'Emergency stop reset. World remains paused - resume when ready.',
        state: getWorldStatus(),
    };
}

/**
 * AUTOMATION SCHEDULING (for semi-auto mode)
 */

function setAutomationSchedule(enabled, windows = [], timezone = 'UTC') {
    worldState.automationSchedule = {
        enabled,
        windows,
        timezone,
    };

    logControlAction('AUTOMATION_SCHEDULE_UPDATED', worldState.automationSchedule);

    return {
        success: true,
        message: `Automation schedule ${enabled ? 'enabled' : 'disabled'}`,
        schedule: worldState.automationSchedule,
    };
}

function addAutomationWindow(start, end, teams = [], actions = []) {
    const window = {
        id: `window_${Date.now()}`,
        start,
        end,
        teams: teams.length ? teams : Object.keys(worldState.teamControls),
        actions: actions.length ? actions : Object.values(ACTION_TYPES),
    };

    worldState.automationSchedule.windows.push(window);

    logControlAction('AUTOMATION_WINDOW_ADDED', window);

    return {
        success: true,
        message: 'Automation window added',
        window,
    };
}

function removeAutomationWindow(windowId) {
    const index = worldState.automationSchedule.windows.findIndex(w => w.id === windowId);

    if (index === -1) {
        return { success: false, message: 'Window not found' };
    }

    worldState.automationSchedule.windows.splice(index, 1);

    logControlAction('AUTOMATION_WINDOW_REMOVED', { windowId });

    return { success: true, message: 'Automation window removed' };
}

function isWithinAutomationWindow(teamId = null, actionType = null) {
    if (!worldState.automationSchedule.enabled) {
        return false;
    }

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    for (const window of worldState.automationSchedule.windows) {
        if (currentTime >= window.start && currentTime <= window.end) {
            if (teamId && !window.teams.includes(teamId)) continue;
            if (actionType && !window.actions.includes(actionType)) continue;
            return true;
        }
    }

    return false;
}

/**
 * CHECK IF ACTION IS ALLOWED
 * Central permission check for all agent actions
 */

function canExecuteAction(teamId, actionType) {
    // Emergency stop blocks everything
    if (worldState.emergencyStop.triggered) {
        return {
            allowed: false,
            reason: 'Emergency stop active',
            code: 'EMERGENCY_STOP',
        };
    }

    // Global pause blocks everything
    if (worldState.globalPaused) {
        return {
            allowed: false,
            reason: 'World is paused',
            code: 'WORLD_PAUSED',
        };
    }

    // Team pause blocks team actions
    if (worldState.teamControls[teamId]?.paused) {
        return {
            allowed: false,
            reason: `Team ${teamId} is paused`,
            code: 'TEAM_PAUSED',
        };
    }

    // Credit limits
    const creditCheck = checkCreditLimits();
    if (!creditCheck.canProceed) {
        return {
            allowed: false,
            reason: creditCheck.message,
            code: 'CREDIT_LIMIT',
        };
    }

    const teamControl = worldState.teamControls[teamId];
    const automationLevel = teamControl?.automationLevel || AUTOMATION_LEVELS.MANUAL;

    // Check based on world state and team automation level
    switch (worldState.worldStatus) {
        case WORLD_STATES.PAUSED:
            return { allowed: false, reason: 'World is paused', code: 'WORLD_PAUSED' };

        case WORLD_STATES.MANUAL:
            return {
                allowed: false,
                reason: 'Manual mode - action requires owner trigger',
                code: 'REQUIRES_TRIGGER',
                requiresApproval: true,
            };

        case WORLD_STATES.SEMI_AUTO:
            // Check if in automation window
            if (isWithinAutomationWindow(teamId, actionType)) {
                // Check if action is in team's allowed actions
                if (teamControl.allowedActions.includes(actionType)) {
                    return { allowed: true, reason: 'Within automation window and allowed' };
                }
            }
            return {
                allowed: false,
                reason: 'Semi-auto mode - action not in allowed list or outside automation window',
                code: 'REQUIRES_APPROVAL',
                requiresApproval: true,
            };

        case WORLD_STATES.AUTONOMOUS:
            if (automationLevel === AUTOMATION_LEVELS.STOPPED) {
                return { allowed: false, reason: 'Team automation stopped', code: 'TEAM_STOPPED' };
            }
            if (automationLevel === AUTOMATION_LEVELS.MANUAL) {
                return {
                    allowed: false,
                    reason: 'Team in manual mode',
                    code: 'REQUIRES_TRIGGER',
                    requiresApproval: true,
                };
            }
            return { allowed: true, reason: 'Autonomous mode' };

        default:
            return { allowed: false, reason: 'Unknown world state', code: 'UNKNOWN' };
    }
}

/**
 * STATUS AND REPORTING
 */

function getWorldStatus() {
    return {
        worldStatus: worldState.worldStatus,
        globalPaused: worldState.globalPaused,
        pausedAt: worldState.pausedAt,
        pauseReason: worldState.pauseReason,
        emergencyStop: worldState.emergencyStop,
        teamControls: worldState.teamControls,
        creditStatus: checkCreditLimits(),
        pendingActionsCount: worldState.pendingActions.length,
        automationSchedule: worldState.automationSchedule,
    };
}

function getTeamStatus(teamId) {
    if (!worldState.teamControls[teamId]) {
        return { success: false, message: `Unknown team: ${teamId}` };
    }

    return {
        teamId,
        ...worldState.teamControls[teamId],
        canExecute: canExecuteAction(teamId, 'execute').allowed,
    };
}

function getControlLog(limit = 50) {
    return worldState.controlLog.slice(-limit);
}

/**
 * HELPER FUNCTIONS
 */

function logControlAction(action, details) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        details,
    };

    worldState.controlLog.push(logEntry);

    // Keep log size manageable
    if (worldState.controlLog.length > 1000) {
        worldState.controlLog = worldState.controlLog.slice(-500);
    }
}

function estimateActionCost(actionType) {
    // Rough cost estimates per action type (in dollars)
    const costEstimates = {
        [ACTION_TYPES.THINK]: 0.01,
        [ACTION_TYPES.EXECUTE]: 0.05,
        [ACTION_TYPES.COMMUNICATE]: 0.02,
        [ACTION_TYPES.REPORT]: 0.03,
        [ACTION_TYPES.SYNC]: 0.01,
        [ACTION_TYPES.RESEARCH]: 0.1,
        [ACTION_TYPES.CREATE]: 0.15,
        [ACTION_TYPES.REVIEW]: 0.05,
    };

    return costEstimates[actionType] || 0.05;
}

// Export everything
module.exports = {
    // Constants
    WORLD_STATES,
    AUTOMATION_LEVELS,
    ACTION_TYPES,
    CREDIT_THRESHOLDS,

    // Global Controls
    pauseWorld,
    resumeWorld,
    setWorldState,

    // Team Controls
    pauseTeam,
    resumeTeam,
    setTeamAutomationLevel,

    // Action Triggers
    triggerTeamAction,
    queueAction,
    approveAction,
    rejectAction,
    getPendingActions,

    // Credit Protection
    setCreditLimits,
    recordSpend,
    checkCreditLimits,
    resetDailySpend,
    resetMonthlySpend,

    // Emergency Controls
    triggerEmergencyStop,
    resetEmergencyStop,

    // Automation Scheduling
    setAutomationSchedule,
    addAutomationWindow,
    removeAutomationWindow,
    isWithinAutomationWindow,

    // Permission Check
    canExecuteAction,

    // Status
    getWorldStatus,
    getTeamStatus,
    getControlLog,

    // State access (for API)
    getState: () => worldState,
    setState: newState => {
        worldState = { ...worldState, ...newState };
    },
};
