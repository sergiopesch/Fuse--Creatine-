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
 *
 * REFACTORED: All state now lives in agent-state.js (single source of truth).
 * This module is pure business logic operating on the shared state.
 */

const agentState = require('./agent-state');

// Re-export constants from agent-state for backward compatibility
const {
    WORLD_STATES,
    AUTOMATION_LEVELS,
    ACTION_TYPES,
    CREDIT_THRESHOLDS,
} = agentState;

// =============================================================================
// HELPERS (internal)
// =============================================================================

function logControlAction(action, details) {
    agentState.addControlLogEntry({
        timestamp: new Date().toISOString(),
        action,
        details,
    });
}

function estimateActionCost(actionType) {
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

// =============================================================================
// GLOBAL PAUSE CONTROLS
// =============================================================================

function pauseWorld(reason = 'Manual pause by owner', pausedBy = 'owner') {
    const wc = agentState.getWorldControllerState();

    agentState.setWorldControllerField('globalPaused', true);
    agentState.setWorldControllerField('pausedAt', new Date().toISOString());
    agentState.setWorldControllerField('pausedBy', pausedBy);
    agentState.setWorldControllerField('pauseReason', reason);

    // Pause all teams
    const teams = agentState.getAllTeamPrompts();
    for (const teamId of Object.keys(teams)) {
        agentState.setTeamControl(teamId, { paused: true });
    }

    // Update orchestration world state
    agentState.setWorldState(WORLD_STATES.PAUSED);

    logControlAction('WORLD_PAUSED', { reason, pausedBy });

    return {
        success: true,
        message: 'World paused successfully',
        state: getWorldStatus(),
    };
}

function resumeWorld(resumedBy = 'owner', targetState = WORLD_STATES.MANUAL) {
    const wc = agentState.getWorldControllerState();

    if (wc.emergencyStop.triggered && wc.emergencyStop.requiresManualReset) {
        return {
            success: false,
            message: 'Emergency stop is active. Manual reset required.',
            emergencyStop: wc.emergencyStop,
        };
    }

    agentState.setWorldControllerField('globalPaused', false);
    agentState.setWorldControllerField('pausedAt', null);
    agentState.setWorldControllerField('pausedBy', null);
    agentState.setWorldControllerField('pauseReason', null);

    // Resume all teams
    const teams = agentState.getAllTeamPrompts();
    for (const teamId of Object.keys(teams)) {
        agentState.setTeamControl(teamId, { paused: false });
    }

    // Update orchestration world state
    agentState.setWorldState(targetState);

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

    const wc = agentState.getWorldControllerState();
    const orchestration = agentState.getOrchestrationState();
    const previousState = orchestration.worldState;

    // Update orchestration world state
    agentState.setWorldState(newState);

    if (newState === WORLD_STATES.PAUSED) {
        agentState.setWorldControllerField('globalPaused', true);
        agentState.setWorldControllerField('pausedAt', new Date().toISOString());
    } else {
        agentState.setWorldControllerField('globalPaused', false);
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

// =============================================================================
// TEAM-LEVEL CONTROLS
// =============================================================================

function pauseTeam(teamId, reason = 'Manual pause', pausedBy = 'owner') {
    const control = agentState.getTeamControl(teamId);
    if (!control) {
        return {
            success: false,
            message: `Unknown team: ${teamId}`,
            validTeams: Object.keys(agentState.getAllTeamPrompts()),
        };
    }

    agentState.setTeamControl(teamId, {
        paused: true,
        pausedAt: new Date().toISOString(),
        pauseReason: reason,
    });

    logControlAction('TEAM_PAUSED', { teamId, reason, pausedBy });

    return {
        success: true,
        message: `Team ${teamId} paused`,
        teamState: agentState.getTeamControl(teamId),
    };
}

function resumeTeam(teamId, resumedBy = 'owner') {
    const control = agentState.getTeamControl(teamId);
    if (!control) {
        return {
            success: false,
            message: `Unknown team: ${teamId}`,
        };
    }

    const wc = agentState.getWorldControllerState();
    if (wc.globalPaused) {
        return {
            success: false,
            message: 'Cannot resume team while world is paused. Resume world first.',
        };
    }

    agentState.setTeamControl(teamId, {
        paused: false,
        pausedAt: undefined,
        pauseReason: undefined,
    });

    logControlAction('TEAM_RESUMED', { teamId, resumedBy });

    return {
        success: true,
        message: `Team ${teamId} resumed`,
        teamState: agentState.getTeamControl(teamId),
    };
}

function setTeamAutomationLevel(teamId, level, allowedActions = []) {
    const control = agentState.getTeamControl(teamId);
    if (!control) {
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

    const validActions = allowedActions.filter(a => Object.values(ACTION_TYPES).includes(a));
    const previousLevel = control.automationLevel;

    agentState.setTeamControl(teamId, {
        automationLevel: level,
        allowedActions: validActions,
    });

    logControlAction('TEAM_AUTOMATION_CHANGED', {
        teamId,
        from: previousLevel,
        to: level,
        allowedActions: validActions,
    });

    return {
        success: true,
        message: `Team ${teamId} automation set to ${level}`,
        teamState: agentState.getTeamControl(teamId),
    };
}

// =============================================================================
// ACTION TRIGGERS
// =============================================================================

function triggerTeamAction(teamId, actionType, parameters = {}) {
    const control = agentState.getTeamControl(teamId);
    if (!control) {
        return { success: false, message: `Unknown team: ${teamId}` };
    }

    if (!Object.values(ACTION_TYPES).includes(actionType)) {
        return {
            success: false,
            message: `Invalid action type: ${actionType}`,
            validActions: Object.values(ACTION_TYPES),
        };
    }

    const wc = agentState.getWorldControllerState();

    if (wc.globalPaused) {
        return { success: false, message: 'Cannot trigger action while world is paused' };
    }

    if (control.paused) {
        return { success: false, message: `Cannot trigger action while team ${teamId} is paused` };
    }

    const creditCheck = checkCreditLimits();
    if (!creditCheck.canProceed) {
        return { success: false, message: creditCheck.message, creditStatus: creditCheck };
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

    agentState.addPendingAction(action);
    logControlAction('ACTION_QUEUED', action);

    return {
        success: true,
        message: `Action queued for ${requiresApproval ? 'approval' : 'execution'}`,
        action,
    };
}

function approveAction(actionId) {
    const pending = agentState.getPendingActions();
    const action = pending.find(a => a.id === actionId);

    if (!action) {
        return { success: false, message: `Action not found: ${actionId}` };
    }

    action.status = 'approved';
    action.approvedAt = new Date().toISOString();

    agentState.removePendingAction(actionId);
    logControlAction('ACTION_APPROVED', action);

    return triggerTeamAction(action.teamId, action.actionType, action.parameters);
}

function rejectAction(actionId, reason = 'Rejected by owner') {
    const pending = agentState.getPendingActions();
    const action = pending.find(a => a.id === actionId);

    if (!action) {
        return { success: false, message: `Action not found: ${actionId}` };
    }

    action.status = 'rejected';
    action.rejectedAt = new Date().toISOString();
    action.rejectionReason = reason;

    agentState.removePendingAction(actionId);
    logControlAction('ACTION_REJECTED', action);

    return { success: true, message: 'Action rejected', action };
}

function getPendingActions() {
    const pending = agentState.getPendingActions();
    return {
        count: pending.length,
        actions: pending,
        totalEstimatedCost: pending.reduce((sum, a) => sum + (a.estimatedCost || 0), 0),
    };
}

// =============================================================================
// CREDIT PROTECTION SYSTEM
// =============================================================================

function setCreditLimits(daily = null, monthly = null) {
    const wc = agentState.getWorldControllerState();
    const cp = { ...wc.creditProtection };

    if (daily !== null) cp.dailyLimit = daily;
    if (monthly !== null) cp.monthlyLimit = monthly;

    agentState.setWorldControllerField('creditProtection', cp);

    logControlAction('CREDIT_LIMITS_UPDATED', {
        dailyLimit: cp.dailyLimit,
        monthlyLimit: cp.monthlyLimit,
    });

    return {
        success: true,
        message: 'Credit limits updated',
        creditProtection: cp,
    };
}

function recordSpend(amount, source = 'agent_action') {
    const wc = agentState.getWorldControllerState();
    const cp = { ...wc.creditProtection };

    cp.currentDailySpend += amount;
    cp.currentMonthlySpend += amount;

    agentState.setWorldControllerField('creditProtection', cp);

    const status = checkCreditLimits();

    if (!status.canProceed && cp.autoStopOnLimit) {
        pauseWorld(`Credit limit reached: ${status.message}`, 'credit_protection');
    }

    logControlAction('SPEND_RECORDED', {
        amount,
        source,
        dailySpend: cp.currentDailySpend,
        monthlySpend: cp.currentMonthlySpend,
    });

    return status;
}

function checkCreditLimits() {
    const wc = agentState.getWorldControllerState();
    const cp = wc.creditProtection;

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
    const wc = agentState.getWorldControllerState();
    const cp = { ...wc.creditProtection, currentDailySpend: 0 };
    agentState.setWorldControllerField('creditProtection', cp);
    logControlAction('DAILY_SPEND_RESET', {});
    return { success: true, message: 'Daily spend reset' };
}

function resetMonthlySpend() {
    const wc = agentState.getWorldControllerState();
    const cp = { ...wc.creditProtection, currentMonthlySpend: 0 };
    agentState.setWorldControllerField('creditProtection', cp);
    logControlAction('MONTHLY_SPEND_RESET', {});
    return { success: true, message: 'Monthly spend reset' };
}

// =============================================================================
// EMERGENCY CONTROLS
// =============================================================================

function triggerEmergencyStop(reason = 'Emergency stop triggered') {
    agentState.setWorldControllerField('emergencyStop', {
        triggered: true,
        triggeredAt: new Date().toISOString(),
        reason,
        requiresManualReset: true,
    });

    pauseWorld(reason, 'emergency_stop');
    logControlAction('EMERGENCY_STOP', { reason });

    return {
        success: true,
        message: 'EMERGENCY STOP ACTIVATED - All operations halted',
        emergencyStop: agentState.getWorldControllerState().emergencyStop,
    };
}

function resetEmergencyStop(resetBy = 'owner', confirmationCode = null) {
    if (!confirmationCode || confirmationCode !== 'CONFIRM_RESET') {
        return {
            success: false,
            message: 'Emergency stop reset requires confirmation code: CONFIRM_RESET',
        };
    }

    agentState.setWorldControllerField('emergencyStop', {
        triggered: false,
        triggeredAt: null,
        reason: null,
        requiresManualReset: true,
    });

    logControlAction('EMERGENCY_STOP_RESET', { resetBy });

    return {
        success: true,
        message: 'Emergency stop reset. World remains paused - resume when ready.',
        state: getWorldStatus(),
    };
}

// =============================================================================
// AUTOMATION SCHEDULING
// =============================================================================

function setAutomationSchedule(enabled, windows = [], timezone = 'UTC') {
    agentState.setWorldControllerField('automationSchedule', {
        enabled,
        windows,
        timezone,
    });

    logControlAction('AUTOMATION_SCHEDULE_UPDATED', { enabled, windows, timezone });

    return {
        success: true,
        message: `Automation schedule ${enabled ? 'enabled' : 'disabled'}`,
        schedule: agentState.getWorldControllerState().automationSchedule,
    };
}

function addAutomationWindow(start, end, teams = [], actions = []) {
    const wc = agentState.getWorldControllerState();
    const allTeamIds = Object.keys(agentState.getAllTeamPrompts());

    const window = {
        id: `window_${Date.now()}`,
        start,
        end,
        teams: teams.length ? teams : allTeamIds,
        actions: actions.length ? actions : Object.values(ACTION_TYPES),
    };

    const schedule = { ...wc.automationSchedule };
    schedule.windows = [...schedule.windows, window];
    agentState.setWorldControllerField('automationSchedule', schedule);

    logControlAction('AUTOMATION_WINDOW_ADDED', window);

    return { success: true, message: 'Automation window added', window };
}

function removeAutomationWindow(windowId) {
    const wc = agentState.getWorldControllerState();
    const schedule = { ...wc.automationSchedule };
    const index = schedule.windows.findIndex(w => w.id === windowId);

    if (index === -1) {
        return { success: false, message: 'Window not found' };
    }

    schedule.windows = schedule.windows.filter(w => w.id !== windowId);
    agentState.setWorldControllerField('automationSchedule', schedule);

    logControlAction('AUTOMATION_WINDOW_REMOVED', { windowId });

    return { success: true, message: 'Automation window removed' };
}

function isWithinAutomationWindow(teamId = null, actionType = null) {
    const wc = agentState.getWorldControllerState();
    if (!wc.automationSchedule.enabled) return false;

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    for (const window of wc.automationSchedule.windows) {
        if (currentTime >= window.start && currentTime <= window.end) {
            if (teamId && !window.teams.includes(teamId)) continue;
            if (actionType && !window.actions.includes(actionType)) continue;
            return true;
        }
    }

    return false;
}

// =============================================================================
// PERMISSION CHECK
// =============================================================================

function canExecuteAction(teamId, actionType) {
    const wc = agentState.getWorldControllerState();
    const orchestration = agentState.getOrchestrationState();

    if (wc.emergencyStop.triggered) {
        return { allowed: false, reason: 'Emergency stop active', code: 'EMERGENCY_STOP' };
    }

    if (wc.globalPaused) {
        return { allowed: false, reason: 'World is paused', code: 'WORLD_PAUSED' };
    }

    const teamControl = agentState.getTeamControl(teamId);
    if (teamControl?.paused) {
        return { allowed: false, reason: `Team ${teamId} is paused`, code: 'TEAM_PAUSED' };
    }

    const creditCheck = checkCreditLimits();
    if (!creditCheck.canProceed) {
        return { allowed: false, reason: creditCheck.message, code: 'CREDIT_LIMIT' };
    }

    const automationLevel = teamControl?.automationLevel || AUTOMATION_LEVELS.MANUAL;

    switch (orchestration.worldState) {
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
            if (isWithinAutomationWindow(teamId, actionType)) {
                if (teamControl && teamControl.allowedActions.includes(actionType)) {
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

// =============================================================================
// STATUS AND REPORTING
// =============================================================================

function getWorldStatus() {
    const wc = agentState.getWorldControllerState();
    const orchestration = agentState.getOrchestrationState();

    return {
        worldStatus: orchestration.worldState,
        globalPaused: wc.globalPaused,
        pausedAt: wc.pausedAt,
        pauseReason: wc.pauseReason,
        emergencyStop: wc.emergencyStop,
        teamControls: wc.teamControls,
        creditStatus: checkCreditLimits(),
        pendingActionsCount: wc.pendingActions.length,
        automationSchedule: wc.automationSchedule,
    };
}

function getTeamStatus(teamId) {
    const control = agentState.getTeamControl(teamId);
    if (!control) {
        return { success: false, message: `Unknown team: ${teamId}` };
    }

    return {
        teamId,
        ...control,
        canExecute: canExecuteAction(teamId, 'execute').allowed,
    };
}

function getControlLog(limit = 50) {
    const wc = agentState.getWorldControllerState();
    return wc.controlLog.slice(-limit);
}

// =============================================================================
// EXPORTS
// =============================================================================

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

    // State access (for API backward compat)
    getState: () => agentState.getWorldControllerState(),
    setState: (newState) => {
        for (const [key, value] of Object.entries(newState)) {
            agentState.setWorldControllerField(key, value);
        }
    },
};
