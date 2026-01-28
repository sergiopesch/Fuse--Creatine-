/**
 * Agent Tools - Tool Definitions & Execution Handlers
 * ====================================================
 *
 * Defines the tools that agents can use during agentic loops.
 * Each tool maps to an atomic operation on the system state.
 *
 * Design principles (from Agent-Native Architecture guide):
 * - One conceptual action per tool
 * - Judgment stays in prompts, not tool logic
 * - Primitives + domain shortcuts, not workflow bundles
 * - Full CRUD parity with UI actions
 */

// =============================================================================
// TOOL DEFINITIONS (Claude API format)
// =============================================================================

const AGENT_TOOLS = [
  // -------------------------------------------------------------------------
  // OBSERVATION TOOLS
  // -------------------------------------------------------------------------
  {
    name: 'get_system_state',
    description:
      'Get a snapshot of the current system state including world status, all team statuses, pending task counts, recent activity, and credit usage. Call this first to understand context before taking action.',
    input_schema: {
      type: 'object',
      properties: {
        include: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['world', 'teams', 'tasks', 'decisions', 'activities', 'credits'],
          },
          description: 'Sections to include. Defaults to all if omitted.',
        },
      },
    },
  },
  {
    name: 'get_tasks',
    description: 'List tasks, optionally filtered by team or status. Returns task details including assignees and progress.',
    input_schema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Filter by team ID' },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'cancelled', 'blocked'],
          description: 'Filter by status',
        },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'get_decisions',
    description: 'List decisions, optionally filtered by status. Use to check for pending approvals or resolved decisions.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected', 'deferred'],
          description: 'Filter by status',
        },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'get_team_info',
    description:
      'Get detailed information about a specific team: its agents, their statuses, recent activities, and assigned tasks.',
    input_schema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'The team ID to look up' },
      },
      required: ['teamId'],
    },
  },
  {
    name: 'get_recent_activity',
    description: 'Get the most recent activity feed across all teams. Shows what has been happening in the system.',
    input_schema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Filter to a specific team (optional)' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
  },

  // -------------------------------------------------------------------------
  // ACTION TOOLS
  // -------------------------------------------------------------------------
  {
    name: 'create_task',
    description:
      'Create a new task and assign it to a team. Tasks represent concrete work to be done. Be specific about deliverables.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Brief, specific task title' },
        description: { type: 'string', description: 'Detailed description of what needs to be done' },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Task priority (default: medium)',
        },
        teamId: { type: 'string', description: 'Team to assign this task to' },
        assignedAgents: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific agent names to assign (optional)',
        },
      },
      required: ['title', 'teamId'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Update the status or progress of an existing task. Use to mark tasks as started, completed, blocked, etc.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID to update' },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'cancelled', 'blocked'],
          description: 'New status',
        },
        progress: { type: 'number', description: 'Progress percentage 0-100' },
        result: { type: 'string', description: 'Result summary or output (for completed tasks)' },
      },
      required: ['taskId', 'status'],
    },
  },
  {
    name: 'create_decision_request',
    description:
      'Request a decision from the owner. Use for high-impact choices, budget approvals, strategic direction, or anything requiring human judgment.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Clear, concise decision title' },
        description: { type: 'string', description: 'Context and rationale for why this decision is needed' },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'How urgent is this decision',
        },
        impact: { type: 'string', description: 'Expected business impact of this decision' },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Available options for the owner to choose from',
        },
      },
      required: ['title', 'description'],
    },
  },
  {
    name: 'send_message',
    description:
      'Send a message to another team or specific agent for coordination. Use for cross-team collaboration, handoffs, and status updates.',
    input_schema: {
      type: 'object',
      properties: {
        toTeam: { type: 'string', description: 'Target team ID' },
        toAgent: { type: 'string', description: 'Specific agent name (optional, defaults to whole team)' },
        message: { type: 'string', description: 'The message to send' },
        relatedTask: { type: 'string', description: 'Related task ID for context (optional)' },
      },
      required: ['toTeam', 'message'],
    },
  },
  {
    name: 'report_progress',
    description:
      'Report findings, analysis results, or progress updates. Creates a visible activity in the activity feed that the owner and other teams can see.',
    input_schema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Which agent is reporting (your agent name)' },
        message: { type: 'string', description: 'Progress report, findings, or analysis' },
        tag: {
          type: 'string',
          description: 'Activity category (e.g., Analysis, Research, Update, Milestone)',
        },
      },
      required: ['agent', 'message'],
    },
  },

  {
    name: 'delete_task',
    description:
      'Delete a task that is no longer needed. Use for cleanup of obsolete, duplicate, or cancelled tasks. Cannot delete tasks that are in_progress.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID to delete' },
        reason: { type: 'string', description: 'Reason for deletion (for audit trail)' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'resolve_decision',
    description:
      'Resolve a pending decision. Use when a decision has been made by the owner or when a decision is no longer relevant. Agents can only resolve decisions that belong to their team.',
    input_schema: {
      type: 'object',
      properties: {
        decisionId: { type: 'string', description: 'The decision ID to resolve' },
        status: {
          type: 'string',
          enum: ['approved', 'rejected', 'deferred'],
          description: 'Resolution status',
        },
        resolution: { type: 'string', description: 'Explanation of the resolution' },
        selectedOption: { type: 'string', description: 'Which option was selected (if applicable)' },
      },
      required: ['decisionId', 'status'],
    },
  },

  // -------------------------------------------------------------------------
  // PRIMITIVE TOOLS (for emergent capability)
  // -------------------------------------------------------------------------
  {
    name: 'read_workspace_file',
    description:
      'Read a file from the shared workspace. Use to access documents, notes, research, and other artifacts created by teams.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to workspace root (e.g., "docs/research.md")' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_workspace_file',
    description:
      'Write or update a file in the shared workspace. Use to create documents, save research, write reports, or store artifacts for other teams.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to workspace root (e.g., "docs/report.md")' },
        content: { type: 'string', description: 'File content to write' },
        append: { type: 'boolean', description: 'If true, append to existing file instead of overwriting' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_workspace_files',
    description:
      'List files in the shared workspace. Use to discover available documents and artifacts.',
    input_schema: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Directory path to list (default: root)' },
        pattern: { type: 'string', description: 'Glob pattern to filter files (e.g., "*.md")' },
      },
    },
  },
  {
    name: 'search_workspace',
    description:
      'Search for content across workspace files. Use to find relevant information, research, or artifacts.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (searches file contents)' },
        fileTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'File extensions to search (e.g., ["md", "txt", "json"])',
        },
        limit: { type: 'number', description: 'Maximum results to return (default: 10)' },
      },
      required: ['query'],
    },
  },

  // -------------------------------------------------------------------------
  // DELEGATION TOOL (for team-to-team execution)
  // -------------------------------------------------------------------------
  {
    name: 'request_team_assistance',
    description:
      'Request another team to perform a specific task. This creates a high-priority task for the target team that will be executed in the next orchestration cycle. Use this when you need specialized help from another team to complete your work.',
    input_schema: {
      type: 'object',
      properties: {
        toTeam: {
          type: 'string',
          description: 'Target team ID (developer, design, communications, legal, marketing, gtm, sales)',
        },
        task: {
          type: 'string',
          description: 'Clear, specific description of what you need the team to do',
        },
        context: {
          type: 'string',
          description: 'Additional context about why this help is needed and any relevant background',
        },
        priority: {
          type: 'string',
          enum: ['medium', 'high', 'critical'],
          description: 'Priority level (defaults to high for assistance requests)',
        },
        blocking: {
          type: 'boolean',
          description: 'If true, indicates this request blocks your current work',
        },
      },
      required: ['toTeam', 'task'],
    },
  },

  // -------------------------------------------------------------------------
  // CONTROL TOOL
  // -------------------------------------------------------------------------
  {
    name: 'signal_completion',
    description:
      'Signal that the current assignment is complete. This stops the agent loop. Always call this when you have finished your work. Include a summary of what was accomplished.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Summary of what was accomplished' },
        tasksCreated: { type: 'number', description: 'Number of new tasks created during this session' },
        decisionsRequested: { type: 'number', description: 'Number of decisions requested' },
        messagesSent: { type: 'number', description: 'Number of cross-team messages sent' },
      },
      required: ['summary'],
    },
  },
];

// =============================================================================
// TOOL EXECUTION HANDLERS
// =============================================================================

/**
 * Execute an agent tool and return the result.
 *
 * @param {string} toolName - Name of the tool to execute
 * @param {object} input - Tool input parameters
 * @param {string} callingTeamId - The team executing this tool
 * @param {object} ctx - State context (mutable, shared across the loop)
 * @returns {{ success: boolean, message: string, data: any }}
 */
function executeAgentTool(toolName, input, callingTeamId, ctx) {
  try {
    switch (toolName) {
      case 'get_system_state':
        return handleGetSystemState(input, ctx);
      case 'get_tasks':
        return handleGetTasks(input, ctx);
      case 'get_decisions':
        return handleGetDecisions(input, ctx);
      case 'get_team_info':
        return handleGetTeamInfo(input, ctx);
      case 'get_recent_activity':
        return handleGetRecentActivity(input, ctx);
      case 'create_task':
        return handleCreateTask(input, callingTeamId, ctx);
      case 'update_task_status':
        return handleUpdateTaskStatus(input, callingTeamId, ctx);
      case 'create_decision_request':
        return handleCreateDecisionRequest(input, callingTeamId, ctx);
      case 'send_message':
        return handleSendMessage(input, callingTeamId, ctx);
      case 'report_progress':
        return handleReportProgress(input, callingTeamId, ctx);
      case 'delete_task':
        return handleDeleteTask(input, callingTeamId, ctx);
      case 'resolve_decision':
        return handleResolveDecision(input, callingTeamId, ctx);
      case 'read_workspace_file':
        return handleReadWorkspaceFile(input, callingTeamId, ctx);
      case 'write_workspace_file':
        return handleWriteWorkspaceFile(input, callingTeamId, ctx);
      case 'list_workspace_files':
        return handleListWorkspaceFiles(input, callingTeamId, ctx);
      case 'search_workspace':
        return handleSearchWorkspace(input, callingTeamId, ctx);
      case 'signal_completion':
        return handleSignalCompletion(input, callingTeamId, ctx);
      case 'request_team_assistance':
        return handleRequestTeamAssistance(input, callingTeamId, ctx);
      default:
        return { success: false, message: `Unknown tool: ${toolName}`, data: null };
    }
  } catch (error) {
    return { success: false, message: `Tool error: ${error.message}`, data: null };
  }
}

// =============================================================================
// HANDLER IMPLEMENTATIONS
// =============================================================================

function handleGetSystemState(input, ctx) {
  const include = input.include || ['world', 'teams', 'tasks', 'decisions', 'activities', 'credits'];
  const state = {};

  if (include.includes('world')) {
    state.worldState = ctx.worldState;
    state.emergencyStop = ctx.emergencyStop || false;
  }

  if (include.includes('teams')) {
    state.teams = Object.entries(ctx.teams).map(([id, team]) => ({
      id,
      name: team.name,
      status: team.status || 'paused',
      agentCount: team.agents?.length || 0,
      runCount: team.runCount || 0,
      lastRun: team.lastRun,
    }));
  }

  if (include.includes('tasks')) {
    const tasks = ctx.tasks || [];
    state.tasks = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
    };
  }

  if (include.includes('decisions')) {
    const decisions = ctx.decisions || [];
    state.decisions = {
      total: decisions.length,
      pending: decisions.filter(d => d.status === 'pending').length,
      approved: decisions.filter(d => d.status === 'approved').length,
      rejected: decisions.filter(d => d.status === 'rejected').length,
    };
  }

  if (include.includes('activities')) {
    const activities = ctx.activities || [];
    state.recentActivities = activities.slice(0, 5).map(a => ({
      agent: a.agent,
      team: a.teamId,
      message: a.message,
      tag: a.tag,
      time: a.timestamp,
    }));
  }

  if (include.includes('credits')) {
    state.creditStatus = ctx.creditStatus || { status: 'ok', message: 'Within limits' };
  }

  return { success: true, message: 'System state retrieved', data: state };
}

function handleGetTasks(input, ctx) {
  let tasks = ctx.tasks || [];

  if (input.teamId) {
    tasks = tasks.filter(t => t.teamId === input.teamId);
  }
  if (input.status) {
    tasks = tasks.filter(t => t.status === input.status);
  }

  const limit = Math.min(input.limit || 20, 50);
  tasks = tasks.slice(0, limit);

  return {
    success: true,
    message: `Found ${tasks.length} task(s)`,
    data: tasks.map(t => ({
      taskId: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      teamId: t.teamId,
      assignedAgents: t.assignedAgents,
      progress: t.progress || 0,
      createdAt: t.createdAt,
    })),
  };
}

function handleGetDecisions(input, ctx) {
  let decisions = ctx.decisions || [];

  if (input.status) {
    decisions = decisions.filter(d => d.status === input.status);
  }

  const limit = Math.min(input.limit || 20, 50);
  decisions = decisions.slice(0, limit);

  return {
    success: true,
    message: `Found ${decisions.length} decision(s)`,
    data: decisions.map(d => ({
      decisionId: d.id,
      title: d.title,
      description: d.description,
      status: d.status,
      priority: d.priority,
      impact: d.impact,
      options: d.options,
      requestedBy: d.requestedBy,
      teamId: d.teamId,
      createdAt: d.createdAt,
    })),
  };
}

function handleGetTeamInfo(input, ctx) {
  const teamId = input.teamId;
  const team = ctx.teams[teamId];

  if (!team) {
    return {
      success: false,
      message: `Team not found: ${teamId}. Valid teams: ${Object.keys(ctx.teams).join(', ')}`,
      data: null,
    };
  }

  const teamTasks = (ctx.tasks || []).filter(t => t.teamId === teamId);
  const teamActivities = (ctx.activities || []).filter(a => a.teamId === teamId);

  return {
    success: true,
    message: `Team info for ${team.name}`,
    data: {
      id: teamId,
      name: team.name,
      status: team.status || 'paused',
      agents: team.agents || [],
      activeTasks: teamTasks.filter(t => t.status === 'in_progress').length,
      pendingTasks: teamTasks.filter(t => t.status === 'pending').length,
      completedTasks: teamTasks.filter(t => t.status === 'completed').length,
      recentActivity: teamActivities.slice(0, 5).map(a => ({
        agent: a.agent,
        message: a.message,
        tag: a.tag,
        time: a.timestamp,
      })),
    },
  };
}

function handleGetRecentActivity(input, ctx) {
  let activities = ctx.activities || [];

  if (input.teamId) {
    activities = activities.filter(a => a.teamId === input.teamId);
  }

  const limit = Math.min(input.limit || 10, 50);
  activities = activities.slice(0, limit);

  return {
    success: true,
    message: `${activities.length} recent activities`,
    data: activities.map(a => ({
      agent: a.agent,
      team: a.teamId,
      message: a.message,
      tag: a.tag,
      time: a.timestamp,
    })),
  };
}

function handleCreateTask(input, callingTeamId, ctx) {
  const taskId = `task-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Validate target team
  if (!ctx.teams[input.teamId]) {
    return {
      success: false,
      message: `Invalid team: ${input.teamId}. Valid teams: ${Object.keys(ctx.teams).join(', ')}`,
      data: null,
    };
  }

  const task = {
    id: taskId,
    title: input.title,
    description: input.description || '',
    priority: input.priority || 'medium',
    status: 'pending',
    teamId: input.teamId,
    assignedAgents: input.assignedAgents || [],
    createdBy: `agent:${callingTeamId}`,
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Mutate state context
  if (!ctx.tasks) ctx.tasks = [];
  ctx.tasks.unshift(task);

  // Add activity
  addActivityToContext(ctx, callingTeamId, 'Team Lead', `Created task: "${input.title}" → ${input.teamId}`, 'Task Created');

  return {
    success: true,
    message: `Task created: "${input.title}" assigned to ${input.teamId}`,
    data: { taskId, title: input.title, teamId: input.teamId, priority: task.priority },
  };
}

function handleUpdateTaskStatus(input, callingTeamId, ctx) {
  const tasks = ctx.tasks || [];
  const task = tasks.find(t => t.id === input.taskId);

  if (!task) {
    return {
      success: false,
      message: `Task not found: ${input.taskId}`,
      data: null,
    };
  }

  const previousStatus = task.status;
  task.status = input.status;
  task.updatedAt = new Date().toISOString();

  if (input.progress !== undefined) {
    task.progress = Math.min(100, Math.max(0, input.progress));
  }
  if (input.result) {
    task.result = input.result;
  }
  if (input.status === 'completed') {
    task.completedAt = new Date().toISOString();
    task.progress = 100;
  }
  if (input.status === 'in_progress' && !task.startedAt) {
    task.startedAt = new Date().toISOString();
  }

  addActivityToContext(
    ctx,
    callingTeamId,
    'Team Lead',
    `Task "${task.title}" updated: ${previousStatus} → ${input.status}`,
    'Task Update'
  );

  return {
    success: true,
    message: `Task "${task.title}" updated to ${input.status}`,
    data: { taskId: task.id, title: task.title, previousStatus, newStatus: input.status, progress: task.progress },
  };
}

function handleCreateDecisionRequest(input, callingTeamId, ctx) {
  const decisionId = `dec-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const decision = {
    id: decisionId,
    title: input.title,
    description: input.description,
    priority: input.priority || 'medium',
    impact: input.impact || '',
    options: input.options || [],
    status: 'pending',
    teamId: callingTeamId,
    requestedBy: `agent:${callingTeamId}`,
    createdAt: new Date().toISOString(),
  };

  if (!ctx.decisions) ctx.decisions = [];
  ctx.decisions.unshift(decision);

  addActivityToContext(
    ctx,
    callingTeamId,
    'Team Lead',
    `Decision requested: "${input.title}"`,
    'Decision Request'
  );

  return {
    success: true,
    message: `Decision request created: "${input.title}" (awaiting owner approval)`,
    data: { decisionId, title: input.title, priority: decision.priority },
  };
}

function handleSendMessage(input, callingTeamId, ctx) {
  // Validate target team
  if (!ctx.teams[input.toTeam]) {
    return {
      success: false,
      message: `Invalid target team: ${input.toTeam}. Valid teams: ${Object.keys(ctx.teams).join(', ')}`,
      data: null,
    };
  }

  const commId = `comm-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const comm = {
    id: commId,
    from: { agent: 'Team Lead', teamId: callingTeamId },
    to: { agent: input.toAgent || 'Team', teamId: input.toTeam },
    message: input.message,
    relatedTask: input.relatedTask || null,
    timestamp: new Date().toISOString(),
  };

  if (!ctx.communications) ctx.communications = [];
  ctx.communications.unshift(comm);

  addActivityToContext(
    ctx,
    callingTeamId,
    'Team Lead',
    `Message to ${ctx.teams[input.toTeam]?.name || input.toTeam}: "${input.message.substring(0, 100)}"`,
    'Communication'
  );

  return {
    success: true,
    message: `Message sent to ${ctx.teams[input.toTeam]?.name || input.toTeam}`,
    data: { commId, toTeam: input.toTeam, toAgent: input.toAgent || 'Team' },
  };
}

function handleReportProgress(input, callingTeamId, ctx) {
  const activity = addActivityToContext(
    ctx,
    callingTeamId,
    input.agent || 'Team Lead',
    input.message,
    input.tag || 'Progress'
  );

  return {
    success: true,
    message: 'Progress reported and visible in activity feed',
    data: activity,
  };
}

function handleSignalCompletion(input, callingTeamId, ctx) {
  const summary = {
    summary: input.summary,
    tasksCreated: input.tasksCreated || 0,
    decisionsRequested: input.decisionsRequested || 0,
    messagesSent: input.messagesSent || 0,
    completedAt: new Date().toISOString(),
    teamId: callingTeamId,
  };

  addActivityToContext(
    ctx,
    callingTeamId,
    'Team Lead',
    `Assignment complete: ${input.summary}`,
    'Completed'
  );

  return {
    success: true,
    message: 'Assignment marked as complete. Agent loop will stop.',
    data: summary,
  };
}

function handleRequestTeamAssistance(input, callingTeamId, ctx) {
  const { toTeam, task, context: taskContext, priority, blocking } = input;

  // Validate target team
  if (!ctx.teams[toTeam]) {
    return {
      success: false,
      message: `Invalid target team: ${toTeam}. Valid teams: ${Object.keys(ctx.teams).join(', ')}`,
      data: null,
    };
  }

  // Cannot request assistance from self
  if (toTeam === callingTeamId) {
    return {
      success: false,
      message: 'Cannot request assistance from your own team',
      data: null,
    };
  }

  const taskId = `task-assist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const assistancePriority = priority || 'high';

  // Build task description with context
  let fullDescription = `## Assistance Request from ${ctx.teams[callingTeamId]?.name || callingTeamId}\n\n`;
  fullDescription += `**Task:** ${task}\n\n`;
  if (taskContext) {
    fullDescription += `**Context:** ${taskContext}\n\n`;
  }
  if (blocking) {
    fullDescription += `**Note:** This request is blocking the ${ctx.teams[callingTeamId]?.name || callingTeamId}'s current work.\n`;
  }

  const assistTask = {
    id: taskId,
    title: `[Assistance Request] ${task.substring(0, 80)}`,
    description: fullDescription,
    priority: assistancePriority,
    status: 'pending',
    teamId: toTeam,
    assignedAgents: [],
    createdBy: `agent:${callingTeamId}`,
    isAssistanceRequest: true,
    requestingTeam: callingTeamId,
    blocking: blocking || false,
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Add to tasks
  if (!ctx.tasks) ctx.tasks = [];
  ctx.tasks.unshift(assistTask);

  // Also send a message to the team
  const commId = `comm-assist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const comm = {
    id: commId,
    from: { agent: 'Team Lead', teamId: callingTeamId },
    to: { agent: 'Team', teamId: toTeam },
    message: `Assistance requested: ${task}${blocking ? ' (BLOCKING)' : ''}`,
    relatedTask: taskId,
    timestamp: new Date().toISOString(),
  };

  if (!ctx.communications) ctx.communications = [];
  ctx.communications.unshift(comm);

  // Log activity
  addActivityToContext(
    ctx,
    callingTeamId,
    'Team Lead',
    `Requested assistance from ${ctx.teams[toTeam]?.name || toTeam}: "${task.substring(0, 60)}"`,
    'Assistance Request'
  );

  return {
    success: true,
    message: `Assistance request sent to ${ctx.teams[toTeam]?.name || toTeam}. Task created with ${assistancePriority} priority.`,
    data: {
      taskId,
      toTeam,
      priority: assistancePriority,
      blocking: blocking || false,
    },
  };
}

function handleDeleteTask(input, callingTeamId, ctx) {
  const tasks = ctx.tasks || [];
  const taskIndex = tasks.findIndex(t => t.id === input.taskId);

  if (taskIndex === -1) {
    return {
      success: false,
      message: `Task not found: ${input.taskId}`,
      data: null,
    };
  }

  const task = tasks[taskIndex];

  // Prevent deleting tasks that are in progress
  if (task.status === 'in_progress') {
    return {
      success: false,
      message: `Cannot delete task "${task.title}" - it is currently in progress. Update status first.`,
      data: null,
    };
  }

  // Only allow teams to delete their own tasks or tasks they created
  if (task.teamId !== callingTeamId && task.createdBy !== `agent:${callingTeamId}`) {
    return {
      success: false,
      message: `Cannot delete task belonging to another team (${task.teamId})`,
      data: null,
    };
  }

  // Remove the task
  const deletedTask = tasks.splice(taskIndex, 1)[0];

  addActivityToContext(
    ctx,
    callingTeamId,
    'Team Lead',
    `Deleted task: "${task.title}" (${input.reason || 'no reason provided'})`,
    'Task Deleted'
  );

  return {
    success: true,
    message: `Task "${task.title}" deleted`,
    data: { taskId: deletedTask.id, title: deletedTask.title, reason: input.reason },
  };
}

function handleResolveDecision(input, callingTeamId, ctx) {
  const decisions = ctx.decisions || [];
  const decision = decisions.find(d => d.id === input.decisionId);

  if (!decision) {
    return {
      success: false,
      message: `Decision not found: ${input.decisionId}`,
      data: null,
    };
  }

  // Only allow teams to resolve their own decisions
  if (decision.teamId !== callingTeamId) {
    return {
      success: false,
      message: `Cannot resolve decision belonging to another team (${decision.teamId})`,
      data: null,
    };
  }

  if (decision.status !== 'pending') {
    return {
      success: false,
      message: `Decision already resolved with status: ${decision.status}`,
      data: null,
    };
  }

  const previousStatus = decision.status;
  decision.status = input.status;
  decision.resolution = input.resolution || '';
  decision.selectedOption = input.selectedOption || null;
  decision.resolvedAt = new Date().toISOString();
  decision.resolvedBy = `agent:${callingTeamId}`;

  addActivityToContext(
    ctx,
    callingTeamId,
    'Team Lead',
    `Decision "${decision.title}" resolved: ${input.status}${input.resolution ? ` - ${input.resolution}` : ''}`,
    'Decision Resolved'
  );

  return {
    success: true,
    message: `Decision "${decision.title}" resolved as ${input.status}`,
    data: {
      decisionId: decision.id,
      title: decision.title,
      previousStatus,
      newStatus: input.status,
      resolution: input.resolution,
    },
  };
}

// =============================================================================
// WORKSPACE FILE HANDLERS
// =============================================================================

const fs = require('fs').promises;
const path = require('path');

// Workspace root - configurable via environment
const WORKSPACE_ROOT = process.env.AGENT_WORKSPACE_ROOT || path.join(process.cwd(), 'agent-workspace');

/**
 * Sanitize path to prevent directory traversal attacks
 */
function sanitizePath(inputPath) {
  // Remove any .. segments and normalize
  const normalized = path.normalize(inputPath).replace(/^(\.\.[\/\\])+/, '');
  // Ensure the path doesn't start with /
  const cleaned = normalized.replace(/^[\/\\]+/, '');
  return cleaned;
}

/**
 * Get full path within workspace
 */
function getWorkspacePath(relativePath) {
  const sanitized = sanitizePath(relativePath);
  const fullPath = path.join(WORKSPACE_ROOT, sanitized);

  // Ensure the resolved path is still within workspace
  if (!fullPath.startsWith(WORKSPACE_ROOT)) {
    throw new Error('Path escapes workspace boundary');
  }

  return fullPath;
}

async function handleReadWorkspaceFile(input, callingTeamId, ctx) {
  try {
    const filePath = getWorkspacePath(input.path);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return {
        success: false,
        message: `File not found: ${input.path}`,
        data: null,
      };
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);

    // Limit content size to prevent context overflow
    const maxSize = 50000; // 50KB
    const truncated = content.length > maxSize;
    const returnContent = truncated ? content.substring(0, maxSize) + '\n... (truncated)' : content;

    return {
      success: true,
      message: `Read file: ${input.path} (${content.length} bytes)`,
      data: {
        path: input.path,
        content: returnContent,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        truncated,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to read file: ${error.message}`,
      data: null,
    };
  }
}

async function handleWriteWorkspaceFile(input, callingTeamId, ctx) {
  try {
    const filePath = getWorkspacePath(input.path);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write or append
    if (input.append) {
      await fs.appendFile(filePath, input.content, 'utf-8');
    } else {
      await fs.writeFile(filePath, input.content, 'utf-8');
    }

    addActivityToContext(
      ctx,
      callingTeamId,
      'Team Lead',
      `${input.append ? 'Appended to' : 'Wrote'} file: ${input.path}`,
      'File Written'
    );

    return {
      success: true,
      message: `File ${input.append ? 'appended' : 'written'}: ${input.path}`,
      data: {
        path: input.path,
        size: input.content.length,
        append: input.append || false,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to write file: ${error.message}`,
      data: null,
    };
  }
}

async function handleListWorkspaceFiles(input, callingTeamId, ctx) {
  try {
    const dirPath = getWorkspacePath(input.directory || '');

    // Check if directory exists
    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          message: `Not a directory: ${input.directory || '/'}`,
          data: null,
        };
      }
    } catch {
      // Create workspace root if it doesn't exist
      if (!input.directory) {
        await fs.mkdir(dirPath, { recursive: true });
        return {
          success: true,
          message: 'Workspace is empty',
          data: { files: [], directories: [] },
        };
      }
      return {
        success: false,
        message: `Directory not found: ${input.directory}`,
        data: null,
      };
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const files = [];
    const directories = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        directories.push(entry.name);
      } else if (entry.isFile()) {
        // Apply pattern filter if provided
        if (input.pattern) {
          const pattern = input.pattern.replace(/\*/g, '.*');
          const regex = new RegExp(`^${pattern}$`);
          if (!regex.test(entry.name)) continue;
        }

        const stats = await fs.stat(path.join(dirPath, entry.name));
        files.push({
          name: entry.name,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        });
      }
    }

    return {
      success: true,
      message: `Listed ${files.length} files and ${directories.length} directories`,
      data: {
        path: input.directory || '/',
        files,
        directories,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list directory: ${error.message}`,
      data: null,
    };
  }
}

async function handleSearchWorkspace(input, callingTeamId, ctx) {
  try {
    const results = [];
    const limit = Math.min(input.limit || 10, 50);
    const fileTypes = input.fileTypes || ['md', 'txt', 'json'];
    const query = input.query.toLowerCase();

    // Recursive search function
    async function searchDir(dirPath, relativePath = '') {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= limit) return;

          const fullPath = path.join(dirPath, entry.name);
          const relPath = path.join(relativePath, entry.name);

          if (entry.isDirectory()) {
            // Skip hidden directories
            if (!entry.name.startsWith('.')) {
              await searchDir(fullPath, relPath);
            }
          } else if (entry.isFile()) {
            // Check file extension
            const ext = entry.name.split('.').pop()?.toLowerCase();
            if (!fileTypes.includes(ext)) continue;

            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const lowerContent = content.toLowerCase();

              if (lowerContent.includes(query)) {
                // Find matching lines
                const lines = content.split('\n');
                const matchingLines = [];

                for (let i = 0; i < lines.length && matchingLines.length < 3; i++) {
                  if (lines[i].toLowerCase().includes(query)) {
                    matchingLines.push({
                      line: i + 1,
                      text: lines[i].substring(0, 200),
                    });
                  }
                }

                results.push({
                  path: relPath,
                  matches: matchingLines,
                });
              }
            } catch {
              // Skip files that can't be read
            }
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    }

    await searchDir(WORKSPACE_ROOT);

    return {
      success: true,
      message: `Found ${results.length} files matching "${input.query}"`,
      data: {
        query: input.query,
        results: results.slice(0, limit),
        totalMatches: results.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Search failed: ${error.message}`,
      data: null,
    };
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function addActivityToContext(ctx, teamId, agent, message, tag) {
  const activity = {
    id: `act-agent-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    agent,
    teamId,
    message,
    tag,
    timestamp: new Date().toISOString(),
    isReal: true,
    source: 'agent',
  };

  if (!ctx.activities) ctx.activities = [];
  ctx.activities.unshift(activity);

  // Keep bounded
  if (ctx.activities.length > 200) {
    ctx.activities.length = 200;
  }

  return activity;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  AGENT_TOOLS,
  executeAgentTool,
};
