/**
 * Agent State - Unified State Management
 * =======================================
 *
 * TRUE single source of truth for the entire agent ecosystem.
 * All modules import from here instead of defining their own state.
 *
 * Consolidates:
 * - Team definitions & prompts (previously split across 3 files)
 * - Orchestration state (previously in orchestrate.js)
 * - World controller state (previously in world-controller.js)
 * - Tasks, decisions, activities, communications
 * - Agent memory (execution history for improvement over time)
 * - DynamoDB persistence hooks (wired to repositories)
 *
 * Architecture principle: Every state mutation goes through exported
 * functions here. No module maintains its own shadow copy.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

const WORLD_STATES = {
  PAUSED: 'paused',
  MANUAL: 'manual',
  SEMI_AUTO: 'semi_auto',
  AUTONOMOUS: 'autonomous',
};

const AUTOMATION_LEVELS = {
  STOPPED: 'stopped',
  MANUAL: 'manual',
  SUPERVISED: 'supervised',
  AUTONOMOUS: 'autonomous',
};

const ACTION_TYPES = {
  THINK: 'think',
  EXECUTE: 'execute',
  COMMUNICATE: 'communicate',
  REPORT: 'report',
  SYNC: 'sync',
  RESEARCH: 'research',
  CREATE: 'create',
  REVIEW: 'review',
};

const TASK_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  BLOCKED: 'blocked',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

const DECISION_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DEFERRED: 'deferred',
};

const CREDIT_THRESHOLDS = {
  WARNING: 0.5,
  CAUTION: 0.75,
  CRITICAL: 0.9,
  HARD_STOP: 1.0,
};

// =============================================================================
// TEAM DEFINITIONS WITH FULL PROMPTS (single source)
// =============================================================================

const TEAM_PROMPTS = {
  developer: {
    name: 'Developer Team',
    badge: 'DEV',
    color: '#8b5cf6',
    systemPrompt: `You are the Developer Team lead coordinating Architect, Coder, and QA Engineer agents for FUSE.
Your focus: platform development, code quality, system architecture.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
    agents: ['Architect', 'Coder', 'QA Engineer'],
    agentDefinitions: [
      { id: 'architect', name: 'Architect', role: 'System Architecture & Design', status: 'idle' },
      { id: 'coder', name: 'Coder', role: 'Implementation & Code Quality', status: 'idle' },
      { id: 'qa-engineer', name: 'QA Engineer', role: 'Testing & Quality Assurance', status: 'idle' },
    ],
  },
  design: {
    name: 'Design Team',
    badge: 'DSN',
    color: '#3b82f6',
    systemPrompt: `You are the Design Team lead coordinating UX Lead, Visual Designer, and Motion Designer for FUSE.
Your focus: user experience, visual design, animations, brand consistency.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
    agents: ['UX Lead', 'Visual Designer', 'Motion Designer'],
    agentDefinitions: [
      { id: 'ux-lead', name: 'UX Lead', role: 'User Experience & Flows', status: 'idle' },
      { id: 'visual-designer', name: 'Visual Designer', role: 'Visual Design & Brand', status: 'idle' },
      { id: 'motion-designer', name: 'Motion Designer', role: 'Animations & Interactions', status: 'idle' },
    ],
  },
  communications: {
    name: 'Communications Team',
    badge: 'COM',
    color: '#06b6d4',
    systemPrompt: `You are the Communications Team lead coordinating Content Strategist, Copywriter, and Social Manager for FUSE.
Your focus: content strategy, brand voice, social media engagement.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
    agents: ['Content Strategist', 'Copywriter', 'Social Manager'],
    agentDefinitions: [
      { id: 'content-strategist', name: 'Content Strategist', role: 'Content Planning & Voice', status: 'idle' },
      { id: 'copywriter', name: 'Copywriter', role: 'Persuasive Copy & Messaging', status: 'idle' },
      { id: 'social-manager', name: 'Social Media Manager', role: 'Community & Engagement', status: 'idle' },
    ],
  },
  legal: {
    name: 'Legal Team',
    badge: 'LGL',
    color: '#f59e0b',
    systemPrompt: `You are the Legal Team lead coordinating Compliance Officer, Contract Analyst, and IP Counsel for FUSE.
Your focus: regulatory compliance, contracts, intellectual property protection.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
    agents: ['Compliance Officer', 'Contract Analyst', 'IP Counsel'],
    agentDefinitions: [
      { id: 'compliance-officer', name: 'Compliance Officer', role: 'Regulatory Compliance', status: 'idle' },
      { id: 'contract-analyst', name: 'Contract Analyst', role: 'Terms & Agreements', status: 'idle' },
      { id: 'ip-counsel', name: 'IP Counsel', role: 'Intellectual Property', status: 'idle' },
    ],
  },
  marketing: {
    name: 'Marketing Team',
    badge: 'MKT',
    color: '#ef4444',
    systemPrompt: `You are the Marketing Team lead coordinating Growth Lead, Brand Strategist, and Analytics Expert for FUSE.
Your focus: user acquisition, brand positioning, growth metrics.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
    agents: ['Growth Lead', 'Brand Strategist', 'Analytics Expert'],
    agentDefinitions: [
      { id: 'growth-lead', name: 'Growth Lead', role: 'Acquisition & Retention', status: 'idle' },
      { id: 'brand-strategist', name: 'Brand Strategist', role: 'Brand Identity & Positioning', status: 'idle' },
      { id: 'analytics-expert', name: 'Analytics Expert', role: 'Data & Performance', status: 'idle' },
    ],
  },
  gtm: {
    name: 'Go-to-Market Team',
    badge: 'GTM',
    color: '#10b981',
    systemPrompt: `You are the GTM Team lead coordinating Launch Coordinator, Partnership Manager, and Market Researcher for FUSE.
Your focus: product launch, strategic partnerships, market intelligence.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
    agents: ['Launch Coordinator', 'Partnership Manager', 'Market Researcher'],
    agentDefinitions: [
      { id: 'launch-coordinator', name: 'Launch Coordinator', role: 'Launch Planning & Execution', status: 'idle' },
      { id: 'partnership-manager', name: 'Partnership Manager', role: 'Strategic Partnerships', status: 'idle' },
      { id: 'market-researcher', name: 'Market Researcher', role: 'Market Intelligence', status: 'idle' },
    ],
  },
  sales: {
    name: 'Sales Team',
    badge: 'SLS',
    color: '#ec4899',
    systemPrompt: `You are the Sales Team lead coordinating Sales Director, Account Executive, SDR Lead, Solutions Consultant, and Customer Success for FUSE.
Your focus: revenue growth, pipeline management, customer relationships.
Respond with brief, actionable status updates (2-3 sentences max).
Format: [AGENT_NAME]: [Brief status/action]`,
    agents: ['Sales Director', 'Account Executive', 'SDR Lead', 'Solutions Consultant', 'Customer Success'],
    agentDefinitions: [
      { id: 'sales-director', name: 'Sales Director', role: 'Revenue Strategy & Team Leadership', status: 'idle' },
      { id: 'account-executive', name: 'Account Executive', role: 'Enterprise Sales & Closing', status: 'idle' },
      { id: 'sdr', name: 'SDR Lead', role: 'Outbound Prospecting & Lead Qualification', status: 'idle' },
      { id: 'solutions-consultant', name: 'Solutions Consultant', role: 'Technical Sales & Demos', status: 'idle' },
      { id: 'customer-success', name: 'Customer Success Manager', role: 'Retention & Expansion', status: 'idle' },
    ],
  },
};

// Build DEFAULT_TEAMS from TEAM_PROMPTS (backward compat)
const DEFAULT_TEAMS = {};
for (const [id, prompt] of Object.entries(TEAM_PROMPTS)) {
  DEFAULT_TEAMS[id] = {
    id,
    name: prompt.name,
    badge: prompt.badge,
    color: prompt.color,
    agents: JSON.parse(JSON.stringify(prompt.agentDefinitions)),
  };
}

// =============================================================================
// UNIFIED STATE
// =============================================================================

const state = {
  // ---- Team Data ----
  teams: JSON.parse(JSON.stringify(DEFAULT_TEAMS)),

  // ---- Task Management ----
  tasks: [],
  decisions: [],
  communications: [],
  activities: [],

  // ---- Orchestration (single source, replaces orchestrate.js orchestrationState) ----
  orchestration: {
    teamStatuses: {},
    worldState: WORLD_STATES.PAUSED,
    totalOrchestrations: 0,
    executionInProgress: false,
    lastExecutionTime: null,
    lastActivity: null,
  },

  // ---- World Controller (single source, replaces world-controller.js worldState) ----
  worldController: {
    globalPaused: false,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    teamControls: {},
    creditProtection: {
      enabled: true,
      dailyLimit: parseFloat(process.env.DAILY_BUDGET_LIMIT) || 50.0,
      monthlyLimit: parseFloat(process.env.MONTHLY_BUDGET_LIMIT) || 500.0,
      currentDailySpend: 0,
      currentMonthlySpend: 0,
      autoStopOnLimit: true,
      warningThreshold: CREDIT_THRESHOLDS.WARNING,
      hardStopThreshold: CREDIT_THRESHOLDS.HARD_STOP,
    },
    pendingActions: [],
    controlLog: [],
    automationSchedule: {
      enabled: false,
      windows: [],
      timezone: 'UTC',
    },
    emergencyStop: {
      triggered: false,
      triggeredAt: null,
      reason: null,
      requiresManualReset: true,
    },
  },

  // ---- Agent Memory (for improvement over time) ----
  memory: {
    executionHistory: [],     // Last N execution summaries
    ownerFeedback: [],        // Accumulated owner corrections/preferences
    learnedGuidelines: [],    // Guidelines discovered from feedback
    toolUsagePatterns: {},    // Track tool sequence frequencies
  },

  // ---- Orchestration Mode (legacy compat) ----
  orchestrationMode: 'manual',

  // ---- API Key Config ----
  apiKeyConfig: {
    anthropic: { configured: false, model: 'claude-3-5-haiku-latest', lastUpdated: null },
    openai: { configured: false, model: 'gpt-4-turbo', lastUpdated: null },
    gemini: { configured: false, model: 'gemini-pro', lastUpdated: null },
  },

  // ---- Health ----
  healthMetrics: {
    lastHealthCheck: null,
    systemLoad: 0,
    memoryUsage: 0,
    apiLatency: {},
  },
};

// Initialize team statuses and controls from TEAM_PROMPTS
for (const teamId of Object.keys(TEAM_PROMPTS)) {
  state.orchestration.teamStatuses[teamId] = {
    status: 'paused',
    lastRun: null,
    runCount: 0,
    lastActivities: [],
  };
  state.worldController.teamControls[teamId] = {
    paused: false,
    automationLevel: AUTOMATION_LEVELS.MANUAL,
    allowedActions: [],
  };
}

// Limits
const LIMITS = {
  MAX_TASKS: 100,
  MAX_DECISIONS: 50,
  MAX_ACTIVITIES: 200,
  MAX_COMMUNICATIONS: 100,
  MAX_MEMORY_ENTRIES: 50,
  MAX_FEEDBACK_ENTRIES: 100,
  MAX_CONTROL_LOG: 1000,
  MAX_PENDING_ACTIONS: 100,
};

// =============================================================================
// PERSISTENCE LAYER (DynamoDB)
// =============================================================================

let persistenceEnabled = false;
let agentsRepo = null;

/**
 * Initialize persistence. Call once at startup if DynamoDB is configured.
 * Gracefully degrades to in-memory if DynamoDB is unavailable.
 */
function initPersistence() {
  try {
    if (process.env.DYNAMODB_TABLE_NAME || process.env.DYNAMODB_ENDPOINT) {
      agentsRepo = require('./db/repositories/agents');
      persistenceEnabled = true;
      console.log('[AgentState] DynamoDB persistence enabled');
    }
  } catch (e) {
    console.warn('[AgentState] DynamoDB not available, using in-memory only:', e.message);
    persistenceEnabled = false;
  }
}

/**
 * Persist a task to DynamoDB (fire-and-forget, doesn't block).
 */
function persistTask(task) {
  if (!persistenceEnabled || !agentsRepo) return;
  agentsRepo.createTask(task).catch(e => {
    console.warn('[AgentState] Failed to persist task:', e.message);
  });
}

function persistTaskUpdate(taskId, teamId, status, updates) {
  if (!persistenceEnabled || !agentsRepo) return;
  agentsRepo.updateTaskStatus(teamId, taskId, status, updates).catch(e => {
    console.warn('[AgentState] Failed to persist task update:', e.message);
  });
}

function persistDecision(decision) {
  if (!persistenceEnabled || !agentsRepo) return;
  agentsRepo.createDecision(decision).catch(e => {
    console.warn('[AgentState] Failed to persist decision:', e.message);
  });
}

function persistActivity(activity) {
  if (!persistenceEnabled || !agentsRepo) return;
  agentsRepo.logActivity({
    teamId: activity.teamId,
    agentId: activity.agent,
    message: activity.message,
    tag: activity.tag,
  }).catch(e => {
    console.warn('[AgentState] Failed to persist activity:', e.message);
  });
}

function persistCommunication(comm) {
  if (!persistenceEnabled || !agentsRepo) return;
  agentsRepo.logCommunication(comm).catch(e => {
    console.warn('[AgentState] Failed to persist communication:', e.message);
  });
}

/**
 * Load persisted state from DynamoDB on cold start.
 */
async function loadPersistedState() {
  if (!persistenceEnabled || !agentsRepo) return;

  try {
    // Load active tasks
    const pendingTasks = await agentsRepo.getTasksByStatus('pending', 50);
    const inProgressTasks = await agentsRepo.getTasksByStatus('in_progress', 50);
    const loadedTasks = [...pendingTasks, ...inProgressTasks];
    if (loadedTasks.length > 0) {
      // Merge loaded tasks with in-memory (in-memory takes priority for duplicates)
      const existingIds = new Set(state.tasks.map(t => t.id || t.taskId));
      for (const task of loadedTasks) {
        const id = task.taskId || task.id;
        if (!existingIds.has(id)) {
          state.tasks.push({
            id: id,
            title: task.title,
            description: task.description || '',
            priority: task.priority || 'medium',
            status: task.status || 'pending',
            teamId: task.teamId,
            assignedAgents: task.assignedAgents || [],
            createdBy: task.createdBy || 'system',
            progress: task.progress || 0,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt || task.createdAt,
          });
        }
      }
      console.log(`[AgentState] Loaded ${loadedTasks.length} tasks from DynamoDB`);
    }

    // Load pending decisions
    const pendingDecisions = await agentsRepo.getPendingDecisions(50);
    if (pendingDecisions.length > 0) {
      const existingDecIds = new Set(state.decisions.map(d => d.id || d.decisionId));
      for (const dec of pendingDecisions) {
        const id = dec.decisionId || dec.id;
        if (!existingDecIds.has(id)) {
          state.decisions.push({
            id: id,
            title: dec.title,
            description: dec.description || '',
            priority: dec.priority || 'medium',
            status: dec.status || 'pending',
            teamId: dec.teamId,
            requestedBy: dec.requestedBy,
            impact: dec.impact || '',
            options: dec.options || [],
            createdAt: dec.createdAt,
          });
        }
      }
      console.log(`[AgentState] Loaded ${pendingDecisions.length} decisions from DynamoDB`);
    }

    // Load recent activities
    const recentActivities = await agentsRepo.getAllActivities(50);
    if (recentActivities.length > 0) {
      const existingActIds = new Set(state.activities.map(a => a.id || a.activityId));
      for (const act of recentActivities) {
        const id = act.activityId || act.id;
        if (!existingActIds.has(id)) {
          state.activities.push({
            id: id,
            agent: act.agentId || act.agent || 'System',
            teamId: act.teamId,
            message: act.message,
            tag: act.tag || 'general',
            timestamp: act.timestamp,
            isReal: true,
          });
        }
      }
      console.log(`[AgentState] Loaded ${recentActivities.length} activities from DynamoDB`);
    }
  } catch (e) {
    console.warn('[AgentState] Failed to load persisted state:', e.message);
  }
}

// Auto-initialize persistence on module load
initPersistence();

// =============================================================================
// STATE ACCESSORS (READ)
// =============================================================================

function getState() {
  return state;
}

function getTeams() {
  return state.teams;
}

function getTeam(teamId) {
  return state.teams[teamId] || null;
}

function getTeamPrompt(teamId) {
  return TEAM_PROMPTS[teamId] || null;
}

function getAllTeamPrompts() {
  return TEAM_PROMPTS;
}

function getTasks(filter = {}) {
  let tasks = state.tasks;
  if (filter.teamId) tasks = tasks.filter(t => t.teamId === filter.teamId);
  if (filter.status) tasks = tasks.filter(t => t.status === filter.status);
  return tasks;
}

function getDecisions(filter = {}) {
  let decisions = state.decisions;
  if (filter.teamId) decisions = decisions.filter(d => d.teamId === filter.teamId);
  if (filter.status) decisions = decisions.filter(d => d.status === filter.status);
  return decisions;
}

function getActivities(filter = {}) {
  let activities = state.activities;
  if (filter.teamId) activities = activities.filter(a => a.teamId === filter.teamId);
  const limit = filter.limit || 50;
  return activities.slice(0, limit);
}

function getCommunications(filter = {}) {
  let comms = state.communications;
  if (filter.teamId) {
    comms = comms.filter(c => c.from?.teamId === filter.teamId || c.to?.teamId === filter.teamId);
  }
  return comms;
}

function getOrchestrationState() {
  return state.orchestration;
}

function getTeamOrchestrationStatus(teamId) {
  return state.orchestration.teamStatuses[teamId] || null;
}

function getWorldControllerState() {
  return state.worldController;
}

function getMemory() {
  return state.memory;
}

// =============================================================================
// STATE MUTATORS (WRITE)
// =============================================================================

function addTask(task) {
  state.tasks.unshift(task);
  if (state.tasks.length > LIMITS.MAX_TASKS) {
    state.tasks.length = LIMITS.MAX_TASKS;
  }
  persistTask(task);
  return task;
}

function updateTask(taskId, updates) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    const prevStatus = task.status;
    Object.assign(task, updates, { updatedAt: new Date().toISOString() });
    if (updates.status) {
      persistTaskUpdate(taskId, task.teamId, updates.status, updates);
    }
  }
  return task;
}

function removeTask(taskId) {
  const index = state.tasks.findIndex(t => t.id === taskId);
  if (index !== -1) {
    const removed = state.tasks.splice(index, 1)[0];
    // Persist deletion
    if (persistenceEnabled && agentsRepo) {
      agentsRepo.deleteTask(removed.teamId, taskId).catch(e => {
        console.warn('[AgentState] Failed to persist task deletion:', e.message);
      });
    }
    return removed;
  }
  return null;
}

function addDecision(decision) {
  state.decisions.unshift(decision);
  if (state.decisions.length > LIMITS.MAX_DECISIONS) {
    state.decisions.length = LIMITS.MAX_DECISIONS;
  }
  persistDecision(decision);
  return decision;
}

function updateDecision(decisionId, updates) {
  const decision = state.decisions.find(d => d.id === decisionId);
  if (decision) {
    Object.assign(decision, updates);
    // Persist resolution
    if (persistenceEnabled && agentsRepo && updates.status) {
      agentsRepo.resolveDecision(decision.teamId, decisionId, {
        status: updates.status,
        resolvedBy: updates.resolvedBy || 'system',
        selectedOption: updates.selectedOption || null,
        resolution: updates.resolution || null,
      }).catch(e => {
        console.warn('[AgentState] Failed to persist decision update:', e.message);
      });
    }
  }
  return decision;
}

function removeDecision(decisionId) {
  const index = state.decisions.findIndex(d => d.id === decisionId);
  if (index !== -1) {
    return state.decisions.splice(index, 1)[0];
  }
  return null;
}

function addActivity(activity) {
  state.activities.unshift(activity);
  if (state.activities.length > LIMITS.MAX_ACTIVITIES) {
    state.activities.length = LIMITS.MAX_ACTIVITIES;
  }
  persistActivity(activity);
  return activity;
}

function addCommunication(comm) {
  state.communications.unshift(comm);
  if (state.communications.length > LIMITS.MAX_COMMUNICATIONS) {
    state.communications.length = LIMITS.MAX_COMMUNICATIONS;
  }
  persistCommunication(comm);
  return comm;
}

function setTeamOrchestrationStatus(teamId, status) {
  if (state.orchestration.teamStatuses[teamId]) {
    Object.assign(state.orchestration.teamStatuses[teamId], status);
  }
}

function setWorldState(worldState) {
  state.orchestration.worldState = worldState;
  state.orchestrationMode = worldState;
}

function setOrchestrationFlag(key, value) {
  state.orchestration[key] = value;
}

function updateAgentStatus(teamId, agentId, status, currentTask) {
  const team = state.teams[teamId];
  if (!team) return null;
  const agent = team.agents.find(a => a.id === agentId);
  if (agent) {
    agent.status = status;
    agent.currentTask = currentTask || null;
  }
  return agent;
}

// =============================================================================
// WORLD CONTROLLER MUTATORS
// =============================================================================

function getWorldControllerField(field) {
  return state.worldController[field];
}

function setWorldControllerField(field, value) {
  state.worldController[field] = value;
}

function getTeamControl(teamId) {
  return state.worldController.teamControls[teamId] || null;
}

function setTeamControl(teamId, updates) {
  if (state.worldController.teamControls[teamId]) {
    Object.assign(state.worldController.teamControls[teamId], updates);
  }
}

function addControlLogEntry(entry) {
  state.worldController.controlLog.push(entry);
  if (state.worldController.controlLog.length > LIMITS.MAX_CONTROL_LOG) {
    state.worldController.controlLog = state.worldController.controlLog.slice(-500);
  }
}

function addPendingAction(action) {
  state.worldController.pendingActions.push(action);
  if (state.worldController.pendingActions.length > LIMITS.MAX_PENDING_ACTIONS) {
    state.worldController.pendingActions.length = LIMITS.MAX_PENDING_ACTIONS;
  }
}

function removePendingAction(actionId) {
  const index = state.worldController.pendingActions.findIndex(a => a.id === actionId);
  if (index !== -1) {
    return state.worldController.pendingActions.splice(index, 1)[0];
  }
  return null;
}

function getPendingActions() {
  return state.worldController.pendingActions;
}

// =============================================================================
// AGENT MEMORY (for improvement over time)
// =============================================================================

function addExecutionMemory(entry) {
  state.memory.executionHistory.unshift({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  if (state.memory.executionHistory.length > LIMITS.MAX_MEMORY_ENTRIES) {
    state.memory.executionHistory.length = LIMITS.MAX_MEMORY_ENTRIES;
  }
}

function addOwnerFeedback(feedback) {
  state.memory.ownerFeedback.unshift({
    ...feedback,
    timestamp: new Date().toISOString(),
  });
  if (state.memory.ownerFeedback.length > LIMITS.MAX_FEEDBACK_ENTRIES) {
    state.memory.ownerFeedback.length = LIMITS.MAX_FEEDBACK_ENTRIES;
  }
}

function addLearnedGuideline(guideline) {
  state.memory.learnedGuidelines.push(guideline);
}

function trackToolUsage(toolSequence, teamId) {
  const key = toolSequence.join('→');
  if (!state.memory.toolUsagePatterns[key]) {
    state.memory.toolUsagePatterns[key] = { count: 0, teams: new Set() };
  }
  state.memory.toolUsagePatterns[key].count++;
  if (teamId) {
    // Convert Set to array for serialization
    const teams = state.memory.toolUsagePatterns[key].teams;
    if (teams instanceof Set) {
      teams.add(teamId);
    }
  }
}

// =============================================================================
// CONTEXT BUILDER HELPER
// =============================================================================

function buildStateContext(creditStatus) {
  const teams = {};
  for (const [id, team] of Object.entries(state.teams)) {
    const orchStatus = state.orchestration.teamStatuses[id];
    teams[id] = {
      name: team.name,
      status: orchStatus?.status || 'paused',
      agents: team.agents.map(a => `${a.name} (${a.role})`),
      runCount: orchStatus?.runCount || 0,
      lastRun: orchStatus?.lastRun || null,
    };
  }

  return {
    teams,
    tasks: state.tasks,
    decisions: state.decisions,
    activities: state.activities,
    communications: state.communications,
    worldState: state.orchestration.worldState,
    creditStatus: creditStatus || { status: 'ok', message: 'Within limits' },
    emergencyStop: state.worldController.emergencyStop.triggered,
    memory: {
      recentExecutions: state.memory.executionHistory.slice(0, 5),
      ownerGuidelines: state.memory.learnedGuidelines,
      recentFeedback: state.memory.ownerFeedback.slice(0, 3),
    },
  };
}

// =============================================================================
// SYNC HELPERS
// =============================================================================

function syncFromAgentLoop(loopResult, stateContext) {
  // Merge new tasks
  const existingTaskIds = new Set(state.tasks.map(t => t.id));
  const newTasks = (stateContext.tasks || []).filter(t => !existingTaskIds.has(t.id));
  for (const task of newTasks) {
    addTask(task);
  }

  // Merge new decisions
  const existingDecisionIds = new Set(state.decisions.map(d => d.id));
  const newDecisions = (stateContext.decisions || []).filter(d => !existingDecisionIds.has(d.id));
  for (const decision of newDecisions) {
    addDecision(decision);
  }

  // Merge new activities
  const existingActivityIds = new Set(state.activities.map(a => a.id));
  const newActivities = (stateContext.activities || []).filter(a => !existingActivityIds.has(a.id));
  for (const activity of newActivities) {
    addActivity(activity);
  }

  // Merge new communications
  const existingCommIds = new Set(state.communications.map(c => c.id));
  const newComms = (stateContext.communications || []).filter(c => !existingCommIds.has(c.id));
  for (const comm of newComms) {
    addCommunication(comm);
  }

  // Update task statuses
  for (const ctxTask of stateContext.tasks || []) {
    if (existingTaskIds.has(ctxTask.id)) {
      updateTask(ctxTask.id, {
        status: ctxTask.status,
        progress: ctxTask.progress,
        result: ctxTask.result,
      });
    }
  }

  // Record execution in memory
  if (loopResult) {
    addExecutionMemory({
      teamId: loopResult.teamId,
      teamName: loopResult.teamName,
      completed: loopResult.completed,
      iterations: loopResult.iterations,
      summary: loopResult.completionSummary,
      toolCalls: (loopResult.toolCalls || []).map(tc => tc.tool),
      tasksCreated: loopResult.tasksCreated?.length || 0,
      decisionsCreated: loopResult.decisionsCreated?.length || 0,
    });

    // Track tool usage patterns
    const toolSequence = (loopResult.toolCalls || []).map(tc => tc.tool);
    if (toolSequence.length > 0) {
      trackToolUsage(toolSequence, loopResult.teamId);
    }
  }
}

// =============================================================================
// STATISTICS
// =============================================================================

function countTotalAgents() {
  return Object.values(state.teams).reduce((count, team) => count + team.agents.length, 0);
}

function countActiveAgents() {
  return Object.values(state.teams).reduce(
    (count, team) => count + team.agents.filter(a => a.status === 'working').length,
    0
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Constants
  DEFAULT_TEAMS,
  TEAM_PROMPTS,
  LIMITS,
  WORLD_STATES,
  AUTOMATION_LEVELS,
  ACTION_TYPES,
  TASK_STATUSES,
  DECISION_STATUSES,
  CREDIT_THRESHOLDS,

  // Persistence
  initPersistence,
  loadPersistedState,

  // State access
  getState,
  getTeams,
  getTeam,
  getTeamPrompt,
  getAllTeamPrompts,
  getTasks,
  getDecisions,
  getActivities,
  getCommunications,
  getOrchestrationState,
  getTeamOrchestrationStatus,
  getWorldControllerState,
  getMemory,

  // State mutation
  addTask,
  updateTask,
  removeTask,
  addDecision,
  updateDecision,
  removeDecision,
  addActivity,
  addCommunication,
  setTeamOrchestrationStatus,
  setWorldState,
  setOrchestrationFlag,
  updateAgentStatus,

  // World controller
  getWorldControllerField,
  setWorldControllerField,
  getTeamControl,
  setTeamControl,
  addControlLogEntry,
  addPendingAction,
  removePendingAction,
  getPendingActions,

  // Memory
  addExecutionMemory,
  addOwnerFeedback,
  addLearnedGuideline,
  trackToolUsage,

  // Context
  buildStateContext,
  syncFromAgentLoop,

  // Stats
  countTotalAgents,
  countActiveAgents,
};
