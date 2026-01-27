/**
 * Agents Repository
 * =================
 *
 * Persistent storage for agent teams, agents, tasks, and decisions.
 * Replaces in-memory stores for serverless persistence.
 */

const db = require('../client');

// =============================================================================
// CONSTANTS
// =============================================================================

const TaskPriorities = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const TaskStatuses = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  BLOCKED: 'blocked',
};

const DecisionStatuses = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DEFERRED: 'deferred',
};

const AgentStatuses = {
  IDLE: 'idle',
  WORKING: 'working',
  OFFLINE: 'offline',
  ERROR: 'error',
};

// Priority ordering for sort keys
const PRIORITY_ORDER = {
  critical: '0',
  high: '1',
  medium: '2',
  low: '3',
};

// =============================================================================
// TEAMS
// =============================================================================

/**
 * Create or update a team
 */
async function upsertTeam(team) {
  const now = db.timestamp();

  const item = {
    PK: db.pk('TEAM', team.id),
    SK: 'METADATA',

    gsi1pk: 'TEAMS',
    gsi1sk: db.pk('TEAM', team.id),

    teamId: team.id,
    name: team.name,
    badge: team.badge,
    color: team.color,
    description: team.description || '',
    orchestrationStatus: team.orchestrationStatus || 'paused',
    automationLevel: team.automationLevel || 'manual',
    allowedActions: team.allowedActions || [],
    defaultModel: team.defaultModel || 'claude-3-5-haiku-latest',
    defaultProvider: team.defaultProvider || 'anthropic',

    createdAt: team.createdAt || now,
    updatedAt: now,

    _entityType: 'TEAM',
  };

  await db.putItem(item);
  return item;
}

/**
 * Get team by ID
 */
async function getTeam(teamId) {
  return db.getItem({
    PK: db.pk('TEAM', teamId),
    SK: 'METADATA',
  });
}

/**
 * Get all teams
 */
async function getAllTeams() {
  const result = await db.queryGSI1({
    KeyConditionExpression: 'gsi1pk = :pk',
    ExpressionAttributeValues: {
      ':pk': 'TEAMS',
    },
  });

  return result.items;
}

/**
 * Get team with all agents, tasks, and decisions
 */
async function getTeamWithData(teamId) {
  const result = await db.query({
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': db.pk('TEAM', teamId),
    },
  });

  const data = {
    team: null,
    agents: [],
    tasks: [],
    decisions: [],
    activities: [],
  };

  for (const item of result.items) {
    if (item.SK === 'METADATA') {
      data.team = item;
    } else if (item.SK.startsWith('AGENT#')) {
      data.agents.push(item);
    } else if (item.SK.startsWith('TASK#')) {
      data.tasks.push(item);
    } else if (item.SK.startsWith('DECISION#')) {
      data.decisions.push(item);
    } else if (item.SK.startsWith('ACTIVITY#')) {
      data.activities.push(item);
    }
  }

  return data;
}

// =============================================================================
// AGENTS
// =============================================================================

/**
 * Create or update an agent
 */
async function upsertAgent(teamId, agent) {
  const now = db.timestamp();
  const agentId = agent.id || db.uuid();

  const item = {
    PK: db.pk('TEAM', teamId),
    SK: db.sk('AGENT', agentId),

    gsi1pk: db.pk('AGENT', agentId),
    gsi1sk: 'METADATA',

    gsi2pk: db.pk('AGENT_STATUS', agent.status || AgentStatuses.IDLE),
    gsi2sk: db.sk(teamId, agentId),

    agentId,
    teamId,
    name: agent.name,
    role: agent.role,
    avatar: agent.avatar || null,
    modelProvider: agent.modelProvider || 'anthropic',
    model: agent.model || 'claude-3-5-haiku-latest',
    systemPrompt: agent.systemPrompt || null,
    status: agent.status || AgentStatuses.IDLE,
    currentTask: agent.currentTask || null,
    capabilities: agent.capabilities || [],
    permissions: agent.permissions || [],

    tasksCompleted: agent.tasksCompleted || 0,
    totalTokensUsed: agent.totalTokensUsed || 0,
    totalCost: agent.totalCost || 0,
    averageTaskTime: agent.averageTaskTime || 0,

    createdAt: agent.createdAt || now,
    updatedAt: now,
    lastActiveAt: agent.lastActiveAt || null,

    _entityType: 'AGENT',
  };

  await db.putItem(item);
  return item;
}

/**
 * Get agent by ID
 */
async function getAgent(agentId) {
  const result = await db.queryGSI1({
    KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk = :sk',
    ExpressionAttributeValues: {
      ':pk': db.pk('AGENT', agentId),
      ':sk': 'METADATA',
    },
    Limit: 1,
  });

  return result.items[0] || null;
}

/**
 * Get all agents for a team
 */
async function getTeamAgents(teamId) {
  const result = await db.query({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': db.pk('TEAM', teamId),
      ':prefix': 'AGENT#',
    },
  });

  return result.items;
}

/**
 * Update agent status
 */
async function updateAgentStatus(teamId, agentId, status, currentTask = null) {
  const now = db.timestamp();

  return db.updateItem(
    {
      PK: db.pk('TEAM', teamId),
      SK: db.sk('AGENT', agentId),
    },
    {
      status,
      currentTask,
      lastActiveAt: now,
      updatedAt: now,
      gsi2pk: db.pk('AGENT_STATUS', status),
    }
  );
}

/**
 * Get agents by status
 */
async function getAgentsByStatus(status) {
  const result = await db.queryGSI2({
    KeyConditionExpression: 'gsi2pk = :pk',
    ExpressionAttributeValues: {
      ':pk': db.pk('AGENT_STATUS', status),
    },
  });

  return result.items;
}

// =============================================================================
// TASKS
// =============================================================================

/**
 * Create a task
 */
async function createTask(task) {
  const now = db.timestamp();
  const taskId = task.id || db.uuid();
  const priorityOrder = PRIORITY_ORDER[task.priority || 'medium'] + now;

  const item = {
    PK: db.pk('TEAM', task.teamId),
    SK: db.sk('TASK', taskId),

    gsi1pk: db.pk('TASK_STATUS', task.status || TaskStatuses.PENDING),
    gsi1sk: db.sk(priorityOrder, taskId),

    gsi2pk: db.pk('TASK', taskId),
    gsi2sk: 'METADATA',

    taskId,
    teamId: task.teamId,
    title: task.title,
    description: task.description || '',
    priority: task.priority || TaskPriorities.MEDIUM,
    priorityOrder,
    assignedAgents: task.assignedAgents || [],
    createdBy: task.createdBy || 'system',
    status: task.status || TaskStatuses.PENDING,
    blockedReason: task.blockedReason || null,
    progress: task.progress || 0,
    subtasks: task.subtasks || [],
    result: task.result || null,
    output: task.output || null,
    artifacts: task.artifacts || [],

    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    dueAt: task.dueAt || null,

    tokensUsed: 0,
    estimatedCost: task.estimatedCost || 0,
    actualCost: 0,

    _entityType: 'TASK',
  };

  await db.putItem(item);
  return item;
}

/**
 * Get task by ID
 */
async function getTask(taskId) {
  const result = await db.queryGSI2({
    KeyConditionExpression: 'gsi2pk = :pk AND gsi2sk = :sk',
    ExpressionAttributeValues: {
      ':pk': db.pk('TASK', taskId),
      ':sk': 'METADATA',
    },
    Limit: 1,
  });

  return result.items[0] || null;
}

/**
 * Get all tasks for a team
 */
async function getTeamTasks(teamId, status = null) {
  const params = {
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': db.pk('TEAM', teamId),
      ':prefix': 'TASK#',
    },
  };

  if (status) {
    params.FilterExpression = '#status = :status';
    params.ExpressionAttributeNames = { '#status': 'status' };
    params.ExpressionAttributeValues[':status'] = status;
  }

  const result = await db.query(params);
  return result.items;
}

/**
 * Get tasks by status (across all teams)
 */
async function getTasksByStatus(status, limit = 100) {
  const result = await db.queryGSI1({
    KeyConditionExpression: 'gsi1pk = :pk',
    ExpressionAttributeValues: {
      ':pk': db.pk('TASK_STATUS', status),
    },
    Limit: limit,
  });

  return result.items;
}

/**
 * Update task status
 */
async function updateTaskStatus(teamId, taskId, status, updates = {}) {
  const now = db.timestamp();
  const task = await getTask(taskId);

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const priorityOrder = PRIORITY_ORDER[task.priority] + task.createdAt;

  const updateData = {
    status,
    updatedAt: now,
    gsi1pk: db.pk('TASK_STATUS', status),
    gsi1sk: db.sk(priorityOrder, taskId),
    ...updates,
  };

  if (status === TaskStatuses.IN_PROGRESS && !task.startedAt) {
    updateData.startedAt = now;
  }

  if (status === TaskStatuses.COMPLETED) {
    updateData.completedAt = now;
    updateData.progress = 100;
  }

  return db.updateItem(
    {
      PK: db.pk('TEAM', teamId),
      SK: db.sk('TASK', taskId),
    },
    updateData
  );
}

/**
 * Update task progress
 */
async function updateTaskProgress(teamId, taskId, progress, output = null) {
  const now = db.timestamp();

  const updateData = {
    progress: Math.min(100, Math.max(0, progress)),
    updatedAt: now,
  };

  if (output !== null) {
    updateData.output = output;
  }

  return db.updateItem(
    {
      PK: db.pk('TEAM', teamId),
      SK: db.sk('TASK', taskId),
    },
    updateData
  );
}

/**
 * Delete a task
 */
async function deleteTask(teamId, taskId) {
  return db.deleteItem({
    PK: db.pk('TEAM', teamId),
    SK: db.sk('TASK', taskId),
  });
}

// =============================================================================
// DECISIONS
// =============================================================================

/**
 * Create a decision request
 */
async function createDecision(decision) {
  const now = db.timestamp();
  const decisionId = decision.id || db.uuid();
  const priority = decision.priority || TaskPriorities.MEDIUM;

  const item = {
    PK: db.pk('TEAM', decision.teamId),
    SK: db.sk('DECISION', decisionId),

    gsi1pk: db.pk('DECISION_STATUS', decision.status || DecisionStatuses.PENDING),
    gsi1sk: db.sk(PRIORITY_ORDER[priority], now, decisionId),

    gsi2pk: db.pk('DECISION', decisionId),
    gsi2sk: 'METADATA',

    decisionId,
    teamId: decision.teamId,
    title: decision.title,
    description: decision.description || '',
    priority,
    impact: decision.impact || '',
    requestedBy: decision.requestedBy,
    relatedTask: decision.relatedTask || null,
    details: decision.details || {},
    options: decision.options || [],
    status: decision.status || DecisionStatuses.PENDING,

    resolvedAt: null,
    resolvedBy: null,
    selectedOption: null,
    resolution: null,

    createdAt: now,
    expiresAt: decision.expiresAt || null,

    _entityType: 'DECISION',
  };

  await db.putItem(item);
  return item;
}

/**
 * Get decision by ID
 */
async function getDecision(decisionId) {
  const result = await db.queryGSI2({
    KeyConditionExpression: 'gsi2pk = :pk AND gsi2sk = :sk',
    ExpressionAttributeValues: {
      ':pk': db.pk('DECISION', decisionId),
      ':sk': 'METADATA',
    },
    Limit: 1,
  });

  return result.items[0] || null;
}

/**
 * Get pending decisions (approval queue)
 */
async function getPendingDecisions(limit = 50) {
  const result = await db.queryGSI1({
    KeyConditionExpression: 'gsi1pk = :pk',
    ExpressionAttributeValues: {
      ':pk': db.pk('DECISION_STATUS', DecisionStatuses.PENDING),
    },
    Limit: limit,
  });

  return result.items;
}

/**
 * Resolve a decision
 */
async function resolveDecision(teamId, decisionId, resolution) {
  const now = db.timestamp();
  const decision = await getDecision(decisionId);

  if (!decision) {
    throw new Error(`Decision not found: ${decisionId}`);
  }

  const updateData = {
    status: resolution.status,
    resolvedAt: now,
    resolvedBy: resolution.resolvedBy,
    selectedOption: resolution.selectedOption || null,
    resolution: resolution.resolution || null,
    gsi1pk: db.pk('DECISION_STATUS', resolution.status),
    gsi1sk: db.sk(PRIORITY_ORDER[decision.priority], now, decisionId),
  };

  return db.updateItem(
    {
      PK: db.pk('TEAM', teamId),
      SK: db.sk('DECISION', decisionId),
    },
    updateData
  );
}

// =============================================================================
// ACTIVITIES
// =============================================================================

/**
 * Log an activity
 */
async function logActivity(activity) {
  const now = db.timestamp();
  const activityId = db.uuid();

  const item = {
    PK: db.pk('TEAM', activity.teamId),
    SK: db.sk('ACTIVITY', now, activityId),

    gsi1pk: 'ACTIVITIES',
    gsi1sk: db.sk(now, activityId),

    activityId,
    teamId: activity.teamId,
    agentId: activity.agentId,
    message: activity.message,
    tag: activity.tag || 'general',
    type: activity.type || 'info',
    relatedTask: activity.relatedTask || null,
    relatedDecision: activity.relatedDecision || null,
    metadata: activity.metadata || {},

    timestamp: now,

    // TTL: Keep for 30 days
    ttl: db.ttl(30),

    _entityType: 'ACTIVITY',
  };

  await db.putItem(item);
  return item;
}

/**
 * Get recent activities for a team
 */
async function getTeamActivities(teamId, limit = 100) {
  const result = await db.query({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': db.pk('TEAM', teamId),
      ':prefix': 'ACTIVITY#',
    },
    ScanIndexForward: false,
    Limit: limit,
  });

  return result.items;
}

/**
 * Get recent activities across all teams
 */
async function getAllActivities(limit = 100) {
  const result = await db.queryGSI1({
    KeyConditionExpression: 'gsi1pk = :pk',
    ExpressionAttributeValues: {
      ':pk': 'ACTIVITIES',
    },
    ScanIndexForward: false,
    Limit: limit,
  });

  return result.items;
}

// =============================================================================
// COMMUNICATIONS
// =============================================================================

/**
 * Log a communication between agents
 */
async function logCommunication(comm) {
  const now = db.timestamp();
  const commId = db.uuid();
  const date = db.dateKey();

  const item = {
    PK: db.pk('COMM', date),
    SK: db.sk(now, commId),

    gsi1pk: comm.thread ? db.pk('THREAD', comm.thread) : null,
    gsi1sk: comm.thread ? db.sk(now, commId) : null,

    commId,
    from: comm.from,
    to: comm.to,
    message: comm.message,
    type: comm.type || 'notification',
    relatedTask: comm.relatedTask || null,
    thread: comm.thread || null,

    timestamp: now,

    // TTL: Keep for 7 days
    ttl: db.ttl(7),

    _entityType: 'COMMUNICATION',
  };

  await db.putItem(item);
  return item;
}

/**
 * Get communications for a date
 */
async function getCommunications(date = null, limit = 50) {
  const targetDate = date || db.dateKey();

  const result = await db.query({
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': db.pk('COMM', targetDate),
    },
    ScanIndexForward: false,
    Limit: limit,
  });

  return result.items;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Constants
  TaskPriorities,
  TaskStatuses,
  DecisionStatuses,
  AgentStatuses,

  // Teams
  upsertTeam,
  getTeam,
  getAllTeams,
  getTeamWithData,

  // Agents
  upsertAgent,
  getAgent,
  getTeamAgents,
  updateAgentStatus,
  getAgentsByStatus,

  // Tasks
  createTask,
  getTask,
  getTeamTasks,
  getTasksByStatus,
  updateTaskStatus,
  updateTaskProgress,
  deleteTask,

  // Decisions
  createDecision,
  getDecision,
  getPendingDecisions,
  resolveDecision,

  // Activities
  logActivity,
  getTeamActivities,
  getAllActivities,

  // Communications
  logCommunication,
  getCommunications,
};
