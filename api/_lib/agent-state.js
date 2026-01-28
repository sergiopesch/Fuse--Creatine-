/**
 * Agent State - Unified State Management
 * =======================================
 *
 * Single source of truth for the agent ecosystem state.
 * Consolidates the previously separate state stores in:
 * - agents.js (agentState)
 * - orchestrate.js (orchestrationState)
 * - world-controller.js (worldState)
 *
 * All modules import from here instead of defining their own state.
 * This fixes the triple state desynchronization problem.
 *
 * State is in-memory with optional DynamoDB persistence.
 * Set ENABLE_DB_PERSISTENCE=true to enable database sync.
 */

// =============================================================================
// PERSISTENCE CONFIGURATION
// =============================================================================

const PERSISTENCE_ENABLED = process.env.ENABLE_DB_PERSISTENCE === 'true';
const SYNC_DEBOUNCE_MS = 1000; // Debounce writes to avoid excessive DB calls

let db = null;
let syncTimeout = null;
let pendingSyncOperations = new Set();

/**
 * Lazy-load database module to avoid initialization errors when DB not configured
 */
function getDb() {
  if (!db && PERSISTENCE_ENABLED) {
    try {
      db = require('./db');
    } catch (error) {
      console.warn('[agent-state] Database module not available:', error.message);
      return null;
    }
  }
  return db;
}

// =============================================================================
// TEAM DEFINITIONS
// =============================================================================

const DEFAULT_TEAMS = {
  developer: {
    id: 'developer',
    name: 'Developer Team',
    badge: 'DEV',
    color: '#8b5cf6',
    agents: [
      { id: 'architect', name: 'Architect', role: 'System Architecture & Design', status: 'idle' },
      { id: 'coder', name: 'Coder', role: 'Implementation & Code Quality', status: 'idle' },
      { id: 'qa-engineer', name: 'QA Engineer', role: 'Testing & Quality Assurance', status: 'idle' },
    ],
  },
  design: {
    id: 'design',
    name: 'Design Team',
    badge: 'DSN',
    color: '#3b82f6',
    agents: [
      { id: 'ux-lead', name: 'UX Lead', role: 'User Experience & Flows', status: 'idle' },
      { id: 'visual-designer', name: 'Visual Designer', role: 'Visual Design & Brand', status: 'idle' },
      { id: 'motion-designer', name: 'Motion Designer', role: 'Animations & Interactions', status: 'idle' },
    ],
  },
  communications: {
    id: 'communications',
    name: 'Communications Team',
    badge: 'COM',
    color: '#06b6d4',
    agents: [
      { id: 'content-strategist', name: 'Content Strategist', role: 'Content Planning & Voice', status: 'idle' },
      { id: 'copywriter', name: 'Copywriter', role: 'Persuasive Copy & Messaging', status: 'idle' },
      { id: 'social-manager', name: 'Social Media Manager', role: 'Community & Engagement', status: 'idle' },
    ],
  },
  legal: {
    id: 'legal',
    name: 'Legal Team',
    badge: 'LGL',
    color: '#f59e0b',
    agents: [
      { id: 'compliance-officer', name: 'Compliance Officer', role: 'Regulatory Compliance', status: 'idle' },
      { id: 'contract-analyst', name: 'Contract Analyst', role: 'Terms & Agreements', status: 'idle' },
      { id: 'ip-counsel', name: 'IP Counsel', role: 'Intellectual Property', status: 'idle' },
    ],
  },
  marketing: {
    id: 'marketing',
    name: 'Marketing Team',
    badge: 'MKT',
    color: '#ef4444',
    agents: [
      { id: 'growth-lead', name: 'Growth Lead', role: 'Acquisition & Retention', status: 'idle' },
      { id: 'brand-strategist', name: 'Brand Strategist', role: 'Brand Identity & Positioning', status: 'idle' },
      { id: 'analytics-expert', name: 'Analytics Expert', role: 'Data & Performance', status: 'idle' },
    ],
  },
  gtm: {
    id: 'gtm',
    name: 'Go-to-Market Team',
    badge: 'GTM',
    color: '#10b981',
    agents: [
      { id: 'launch-coordinator', name: 'Launch Coordinator', role: 'Launch Planning & Execution', status: 'idle' },
      { id: 'partnership-manager', name: 'Partnership Manager', role: 'Strategic Partnerships', status: 'idle' },
      { id: 'market-researcher', name: 'Market Researcher', role: 'Market Intelligence', status: 'idle' },
    ],
  },
  sales: {
    id: 'sales',
    name: 'Sales Team',
    badge: 'SLS',
    color: '#ec4899',
    agents: [
      { id: 'sales-director', name: 'Sales Director', role: 'Revenue Strategy & Team Leadership', status: 'idle' },
      { id: 'account-executive', name: 'Account Executive', role: 'Enterprise Sales & Closing', status: 'idle' },
      { id: 'sdr', name: 'SDR Lead', role: 'Outbound Prospecting & Lead Qualification', status: 'idle' },
      { id: 'solutions-consultant', name: 'Solutions Consultant', role: 'Technical Sales & Demos', status: 'idle' },
      { id: 'customer-success', name: 'Customer Success Manager', role: 'Retention & Expansion', status: 'idle' },
    ],
  },
};

// =============================================================================
// TEAM PROMPTS (for orchestration)
// =============================================================================

const TEAM_PROMPTS = {
  developer: {
    name: 'Developer Team',
    agents: ['Architect', 'Coder', 'QA Engineer'],
  },
  design: {
    name: 'Design Team',
    agents: ['UX Lead', 'Visual Designer', 'Motion Designer'],
  },
  communications: {
    name: 'Communications Team',
    agents: ['Content Strategist', 'Copywriter', 'Social Manager'],
  },
  legal: {
    name: 'Legal Team',
    agents: ['Compliance Officer', 'Contract Analyst', 'IP Counsel'],
  },
  marketing: {
    name: 'Marketing Team',
    agents: ['Growth Lead', 'Brand Strategist', 'Analytics Expert'],
  },
  gtm: {
    name: 'Go-to-Market Team',
    agents: ['Launch Coordinator', 'Partnership Manager', 'Market Researcher'],
  },
  sales: {
    name: 'Sales Team',
    agents: ['Sales Director', 'Account Executive', 'SDR Lead', 'Solutions Consultant', 'Customer Success'],
  },
};

// =============================================================================
// UNIFIED STATE
// =============================================================================

const state = {
  // ---- Team Data (replaces agents.js agentState.teams) ----
  teams: JSON.parse(JSON.stringify(DEFAULT_TEAMS)),

  // ---- Task Management (replaces agents.js agentState.tasks/decisions) ----
  tasks: [],
  decisions: [],
  communications: [],
  activities: [],

  // ---- Orchestration (replaces orchestrate.js orchestrationState) ----
  orchestration: {
    teamStatuses: {
      developer: { status: 'paused', lastRun: null, runCount: 0, lastActivities: [] },
      design: { status: 'paused', lastRun: null, runCount: 0, lastActivities: [] },
      communications: { status: 'paused', lastRun: null, runCount: 0, lastActivities: [] },
      legal: { status: 'paused', lastRun: null, runCount: 0, lastActivities: [] },
      marketing: { status: 'paused', lastRun: null, runCount: 0, lastActivities: [] },
      gtm: { status: 'paused', lastRun: null, runCount: 0, lastActivities: [] },
      sales: { status: 'paused', lastRun: null, runCount: 0, lastActivities: [] },
    },
    worldState: 'paused',
    totalOrchestrations: 0,
    executionInProgress: false,
    lastExecutionTime: null,
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

// Limits
const LIMITS = {
  MAX_TASKS: 100,
  MAX_DECISIONS: 50,
  MAX_ACTIVITIES: 200,
  MAX_COMMUNICATIONS: 100,
};

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

// =============================================================================
// STATE MUTATORS (WRITE)
// =============================================================================

function addTask(task) {
  state.tasks.unshift(task);
  if (state.tasks.length > LIMITS.MAX_TASKS) {
    state.tasks.length = LIMITS.MAX_TASKS;
  }
  // Sync to database
  schedulePersistenceSync({ type: 'upsertTask', data: task });
  return task;
}

function updateTask(taskId, updates) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    Object.assign(task, updates, { updatedAt: new Date().toISOString() });
    // Sync to database
    schedulePersistenceSync({
      type: 'updateTask',
      data: { teamId: task.teamId, taskId, status: task.status, updates },
    });
  }
  return task;
}

function removeTask(taskId) {
  const index = state.tasks.findIndex(t => t.id === taskId);
  if (index !== -1) {
    const removed = state.tasks.splice(index, 1)[0];
    // Sync to database
    schedulePersistenceSync({ type: 'deleteTask', data: { teamId: removed.teamId, taskId } });
    return removed;
  }
  return null;
}

function addDecision(decision) {
  state.decisions.unshift(decision);
  if (state.decisions.length > LIMITS.MAX_DECISIONS) {
    state.decisions.length = LIMITS.MAX_DECISIONS;
  }
  // Sync to database
  schedulePersistenceSync({ type: 'upsertDecision', data: decision });
  return decision;
}

function updateDecision(decisionId, updates) {
  const decision = state.decisions.find(d => d.id === decisionId);
  if (decision) {
    Object.assign(decision, updates);
    // If resolving, sync resolution to database
    if (updates.status && updates.status !== 'pending') {
      schedulePersistenceSync({
        type: 'resolveDecision',
        data: {
          teamId: decision.teamId,
          decisionId,
          resolution: {
            status: updates.status,
            resolvedBy: updates.resolvedBy,
            selectedOption: updates.selectedOption,
            resolution: updates.resolution,
          },
        },
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
  // Sync to database
  schedulePersistenceSync({ type: 'logActivity', data: activity });
  return activity;
}

function addCommunication(comm) {
  state.communications.unshift(comm);
  if (state.communications.length > LIMITS.MAX_COMMUNICATIONS) {
    state.communications.length = LIMITS.MAX_COMMUNICATIONS;
  }
  // Sync to database
  schedulePersistenceSync({ type: 'logCommunication', data: comm });
  return comm;
}

function setTeamOrchestrationStatus(teamId, status) {
  if (state.orchestration.teamStatuses[teamId]) {
    Object.assign(state.orchestration.teamStatuses[teamId], status);
  }
}

function setWorldState(worldState) {
  state.orchestration.worldState = worldState;
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
// CONTEXT BUILDER HELPER
// Build the state context object that agent-tools and context-builder consume
// =============================================================================

function buildStateContext(creditStatus) {
  // Build a teams map that includes orchestration status
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
    emergencyStop: false,
  };
}

// =============================================================================
// SYNC HELPERS (for writing back from agent loop results)
// =============================================================================

/**
 * Sync results from an agent loop execution back into the unified state.
 * The agent loop operates on a state context snapshot. This function
 * merges any new items (tasks, decisions, activities, comms) back.
 */
function syncFromAgentLoop(loopResult, stateContext) {
  // Merge new tasks (agent-created tasks have 'task-agent-' prefix)
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

  // Update task statuses (agent may have updated existing tasks)
  for (const ctxTask of stateContext.tasks || []) {
    if (existingTaskIds.has(ctxTask.id)) {
      updateTask(ctxTask.id, {
        status: ctxTask.status,
        progress: ctxTask.progress,
        result: ctxTask.result,
      });
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
// PERSISTENCE LAYER
// =============================================================================

/**
 * Schedule a debounced sync to the database
 */
function schedulePersistenceSync(operation) {
  if (!PERSISTENCE_ENABLED) return;

  pendingSyncOperations.add(operation);

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(async () => {
    const operations = [...pendingSyncOperations];
    pendingSyncOperations.clear();
    await executePersistenceSync(operations);
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Execute pending persistence operations
 */
async function executePersistenceSync(operations) {
  const database = getDb();
  if (!database) return;

  for (const op of operations) {
    try {
      switch (op.type) {
        case 'upsertTask':
          await database.agents.createTask(op.data);
          break;
        case 'updateTask':
          await database.agents.updateTaskStatus(op.data.teamId, op.data.taskId, op.data.status, op.data.updates);
          break;
        case 'deleteTask':
          await database.agents.deleteTask(op.data.teamId, op.data.taskId);
          break;
        case 'upsertDecision':
          await database.agents.createDecision(op.data);
          break;
        case 'resolveDecision':
          await database.agents.resolveDecision(op.data.teamId, op.data.decisionId, op.data.resolution);
          break;
        case 'logActivity':
          await database.agents.logActivity(op.data);
          break;
        case 'logCommunication':
          await database.agents.logCommunication(op.data);
          break;
        case 'upsertTeam':
          await database.agents.upsertTeam(op.data);
          break;
        default:
          console.warn(`[agent-state] Unknown persistence operation: ${op.type}`);
      }
    } catch (error) {
      console.error(`[agent-state] Persistence error for ${op.type}:`, error.message);
    }
  }
}

/**
 * Load state from database on startup
 */
async function loadStateFromDatabase() {
  const database = getDb();
  if (!database) {
    console.log('[agent-state] Persistence disabled, using in-memory state only');
    return false;
  }

  try {
    console.log('[agent-state] Loading state from database...');

    // Load teams
    const teams = await database.agents.getAllTeams();
    if (teams && teams.length > 0) {
      for (const team of teams) {
        if (state.teams[team.teamId]) {
          state.teams[team.teamId] = {
            ...state.teams[team.teamId],
            ...team,
          };

          // Update orchestration status
          if (state.orchestration.teamStatuses[team.teamId]) {
            state.orchestration.teamStatuses[team.teamId].status = team.orchestrationStatus || 'paused';
          }
        }
      }
    }

    // Load pending tasks
    const pendingTasks = await database.agents.getTasksByStatus('pending', 100);
    const inProgressTasks = await database.agents.getTasksByStatus('in_progress', 100);
    const allTasks = [...pendingTasks, ...inProgressTasks];

    if (allTasks.length > 0) {
      state.tasks = allTasks.map(t => ({
        id: t.taskId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
        teamId: t.teamId,
        assignedAgents: t.assignedAgents || [],
        createdBy: t.createdBy,
        progress: t.progress || 0,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        result: t.result,
      }));
    }

    // Load pending decisions
    const pendingDecisions = await database.agents.getPendingDecisions(50);
    if (pendingDecisions.length > 0) {
      state.decisions = pendingDecisions.map(d => ({
        id: d.decisionId,
        title: d.title,
        description: d.description,
        priority: d.priority,
        impact: d.impact,
        options: d.options || [],
        status: d.status,
        teamId: d.teamId,
        requestedBy: d.requestedBy,
        createdAt: d.createdAt,
      }));
    }

    // Load recent activities
    const activities = await database.agents.getAllActivities(200);
    if (activities.length > 0) {
      state.activities = activities.map(a => ({
        id: a.activityId,
        agent: a.agentId,
        teamId: a.teamId,
        message: a.message,
        tag: a.tag,
        timestamp: a.timestamp,
        isReal: true,
        source: 'database',
      }));
    }

    console.log(`[agent-state] Loaded: ${allTasks.length} tasks, ${pendingDecisions.length} decisions, ${activities.length} activities`);
    return true;
  } catch (error) {
    console.error('[agent-state] Failed to load state from database:', error.message);
    return false;
  }
}

/**
 * Force immediate sync to database (for graceful shutdown)
 */
async function flushToDatabase() {
  if (!PERSISTENCE_ENABLED) return;

  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }

  if (pendingSyncOperations.size > 0) {
    const operations = [...pendingSyncOperations];
    pendingSyncOperations.clear();
    await executePersistenceSync(operations);
  }
}

/**
 * Check if persistence is enabled
 */
function isPersistenceEnabled() {
  return PERSISTENCE_ENABLED;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Constants
  DEFAULT_TEAMS,
  TEAM_PROMPTS,
  LIMITS,

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

  // Context
  buildStateContext,
  syncFromAgentLoop,

  // Stats
  countTotalAgents,
  countActiveAgents,

  // Persistence
  loadStateFromDatabase,
  flushToDatabase,
  isPersistenceEnabled,
  schedulePersistenceSync,
};
