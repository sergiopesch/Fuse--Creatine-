/**
 * Orchestrator Agent - Main Supervisor Agent
 * ==========================================
 *
 * The orchestrator is the top-level agent that users interact with.
 * It receives user requests, analyzes them, and delegates work to
 * specialized team agents.
 *
 * Key capabilities:
 * - Conversational interface with the user
 * - Task analysis and decomposition
 * - Delegation to specialized teams (developer, design, marketing, etc.)
 * - Coordination of multi-team workflows
 * - Result synthesis and reporting
 */

const { runAgentLoop } = require('./agent-loop');
const { buildStateContext, TEAM_PROMPTS } = require('./agent-state');
const { checkCreditLimits } = require('./world-controller');

// =============================================================================
// ORCHESTRATOR CONFIGURATION
// =============================================================================

const ORCHESTRATOR_CONFIG = {
  id: 'orchestrator',
  name: 'Main Orchestrator',
  model: 'claude-sonnet-4-20250514', // Use a more capable model for orchestration
  maxIterations: 10, // Allow more iterations for complex orchestration
  maxDelegationDepth: 3, // Prevent infinite delegation chains
};

// =============================================================================
// ORCHESTRATOR SYSTEM PROMPT
// =============================================================================

const ORCHESTRATOR_SYSTEM_PROMPT = `## Identity

You are the Main Orchestrator for FUSE, an AI-powered creatine supplement company. You are the primary interface between the user (company owner/operator) and the specialized AI teams.

You are powered by Claude (Opus 4.5 level capability) and your role is to:
1. Understand user requests and goals
2. Break down complex tasks into actionable work
3. Delegate work to the appropriate specialized teams
4. Coordinate multi-team efforts
5. Synthesize results and report back to the user

## Available Teams

You have access to these specialized teams that you can delegate work to:

1. **Developer Team** (developer)
   - Agents: Architect, Coder, QA Engineer
   - Capabilities: Platform development, code quality, system architecture, technical implementation

2. **Design Team** (design)
   - Agents: UX Lead, Visual Designer, Motion Designer
   - Capabilities: User experience, visual design, animations, brand consistency

3. **Communications Team** (communications)
   - Agents: Content Strategist, Copywriter, Social Manager
   - Capabilities: Content strategy, brand voice, social media, messaging

4. **Legal Team** (legal)
   - Agents: Compliance Officer, Contract Analyst, IP Counsel
   - Capabilities: Regulatory compliance, contracts, intellectual property

5. **Marketing Team** (marketing)
   - Agents: Growth Lead, Brand Strategist, Analytics Expert
   - Capabilities: User acquisition, brand positioning, growth metrics

6. **Go-to-Market Team** (gtm)
   - Agents: Launch Coordinator, Partnership Manager, Market Researcher
   - Capabilities: Product launch, partnerships, market intelligence

7. **Sales Team** (sales)
   - Agents: Sales Director, Account Executive, SDR Lead, Solutions Consultant, Customer Success
   - Capabilities: Revenue growth, pipeline management, customer relationships

## How to Work

1. **Analyze**: When the user makes a request, analyze what they need and which team(s) are best suited.

2. **Delegate**: Use the \`delegate_to_team\` tool to assign work to teams. This actually executes the team's agent loop.
   - Provide clear, specific tasks
   - One team at a time for focused work
   - You can delegate to multiple teams sequentially for complex workflows

3. **Coordinate**: For multi-team projects, coordinate the work:
   - Start with foundational work (e.g., design before development)
   - Pass relevant outputs between teams
   - Ensure dependencies are met

4. **Synthesize**: After delegation, review the results and:
   - Summarize what was accomplished
   - Report any blockers or decisions needed
   - Suggest next steps

## Guidelines

- Be conversational and helpful with the user
- Ask clarifying questions if the request is ambiguous
- Proactively suggest which teams should be involved
- When delegating, be specific about deliverables
- If a team reports blockers, help resolve them or escalate to the user
- Keep the user informed of progress on long-running tasks
- You can have a direct conversation without delegating if the user just wants to chat or ask questions

## Constraints

- You cannot directly modify code, files, or system state - you must delegate to teams
- You cannot make decisions that require owner approval - escalate these
- Be mindful of costs - don't over-delegate or run teams unnecessarily
- If work is simple and a single team can handle it, don't over-complicate`;

// =============================================================================
// ORCHESTRATOR TOOLS
// =============================================================================

const ORCHESTRATOR_TOOLS = [
  // -------------------------------------------------------------------------
  // DELEGATION TOOL - The key tool for orchestration
  // -------------------------------------------------------------------------
  {
    name: 'delegate_to_team',
    description: `Delegate a task to a specialized team and wait for completion. This actually executes the team's agent loop - the team will analyze the task, use their tools, and return results. Use this to get real work done.

Example: delegate_to_team({ teamId: 'developer', task: 'Review the authentication flow and identify any security vulnerabilities' })`,
    input_schema: {
      type: 'object',
      properties: {
        teamId: {
          type: 'string',
          enum: ['developer', 'design', 'communications', 'legal', 'marketing', 'gtm', 'sales'],
          description: 'The team to delegate to',
        },
        task: {
          type: 'string',
          description: 'Clear, specific description of what you want the team to do. Be detailed about deliverables and success criteria.',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Priority level for this delegation (default: medium)',
        },
        context: {
          type: 'string',
          description: 'Additional context that might help the team, such as outputs from previous delegations or user requirements.',
        },
      },
      required: ['teamId', 'task'],
    },
  },

  // -------------------------------------------------------------------------
  // OBSERVATION TOOLS
  // -------------------------------------------------------------------------
  {
    name: 'get_system_overview',
    description: 'Get a high-level overview of the current system state including all teams, pending tasks, and recent activity. Use this to understand the current situation before taking action.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_team_status',
    description: 'Get detailed status of a specific team including their current tasks, recent activities, and any pending decisions.',
    input_schema: {
      type: 'object',
      properties: {
        teamId: {
          type: 'string',
          enum: ['developer', 'design', 'communications', 'legal', 'marketing', 'gtm', 'sales'],
          description: 'The team to get status for',
        },
      },
      required: ['teamId'],
    },
  },
  {
    name: 'get_pending_decisions',
    description: 'Get all decisions that are pending owner approval. Use this to see what needs human input.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_all_tasks',
    description: 'Get all tasks across all teams, optionally filtered by status.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'blocked'],
          description: 'Filter by status (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tasks to return (default: 20)',
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // ACTION TOOLS
  // -------------------------------------------------------------------------
  {
    name: 'create_decision_for_owner',
    description: 'Create a decision request for the owner. Use this for significant choices that require human judgment, budget approvals, or strategic direction.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Clear title for the decision',
        },
        description: {
          type: 'string',
          description: 'Context and rationale for why this decision is needed',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Available options for the owner to choose from',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'How urgent is this decision',
        },
        impact: {
          type: 'string',
          description: 'Expected business impact of this decision',
        },
      },
      required: ['title', 'description'],
    },
  },
  {
    name: 'broadcast_message',
    description: 'Send a message to all teams or specific teams. Use for company-wide announcements or coordinating multi-team efforts.',
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to broadcast',
        },
        targetTeams: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific teams to message (omit for all teams)',
        },
      },
      required: ['message'],
    },
  },

  // -------------------------------------------------------------------------
  // COMPLETION TOOL
  // -------------------------------------------------------------------------
  {
    name: 'respond_to_user',
    description: 'Send a response back to the user. Use this to answer questions, report on delegated work, or ask for clarification. This ends the current orchestration turn.',
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Your response to the user',
        },
        delegationsCompleted: {
          type: 'number',
          description: 'Number of team delegations completed in this turn',
        },
        decisionsCreated: {
          type: 'number',
          description: 'Number of decisions created requiring owner input',
        },
        suggestedNextSteps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Suggested follow-up actions for the user',
        },
      },
      required: ['message'],
    },
  },
];

// =============================================================================
// TOOL EXECUTION HANDLERS
// =============================================================================

/**
 * Execute an orchestrator tool
 *
 * @param {string} toolName - Name of the tool
 * @param {object} input - Tool input parameters
 * @param {object} context - Execution context { apiKey, clientIp, stateContext, onEvent }
 * @returns {Promise<object>} Tool result
 */
async function executeOrchestratorTool(toolName, input, context) {
  const { apiKey, clientIp, stateContext, onEvent } = context;

  try {
    switch (toolName) {
      case 'delegate_to_team':
        return await handleDelegateToTeam(input, { apiKey, clientIp, stateContext, onEvent });

      case 'get_system_overview':
        return handleGetSystemOverview(stateContext);

      case 'get_team_status':
        return handleGetTeamStatus(input, stateContext);

      case 'get_pending_decisions':
        return handleGetPendingDecisions(stateContext);

      case 'get_all_tasks':
        return handleGetAllTasks(input, stateContext);

      case 'create_decision_for_owner':
        return handleCreateDecisionForOwner(input, stateContext);

      case 'broadcast_message':
        return handleBroadcastMessage(input, stateContext);

      case 'respond_to_user':
        return handleRespondToUser(input);

      default:
        return { success: false, message: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return { success: false, message: `Tool error: ${error.message}` };
  }
}

// =============================================================================
// HANDLER IMPLEMENTATIONS
// =============================================================================

/**
 * The key delegation handler - actually runs a team's agent loop
 */
async function handleDelegateToTeam(input, context) {
  const { teamId, task, priority, context: taskContext } = input;
  const { apiKey, clientIp, stateContext, onEvent } = context;

  // Validate team
  const teamPrompt = TEAM_PROMPTS[teamId];
  if (!teamPrompt) {
    return {
      success: false,
      message: `Invalid team: ${teamId}. Valid teams: ${Object.keys(TEAM_PROMPTS).join(', ')}`,
    };
  }

  onEvent?.({ type: 'delegation_started', teamId, task: task.substring(0, 100) });

  // Build full task with context
  let fullTask = task;
  if (taskContext) {
    fullTask = `${task}\n\n## Additional Context from Orchestrator\n${taskContext}`;
  }
  if (priority && priority !== 'medium') {
    fullTask = `[Priority: ${priority.toUpperCase()}]\n\n${fullTask}`;
  }

  try {
    // Run the team's agent loop
    const result = await runAgentLoop(
      teamId,
      fullTask,
      teamPrompt,
      stateContext,
      {
        apiKey,
        clientIp,
        maxIterations: 6,
        enableCheckpoint: false, // Delegations don't need checkpointing
        onEvent: (event) => {
          // Forward events with team context
          onEvent?.({ ...event, delegatedTeam: teamId });
        },
      }
    );

    onEvent?.({ type: 'delegation_completed', teamId, success: result.success });

    return {
      success: true,
      message: `Delegation to ${teamPrompt.name} completed`,
      data: {
        teamId,
        teamName: teamPrompt.name,
        completed: result.completed,
        iterations: result.iterations,
        summary: result.completionSummary,
        tasksCreated: result.tasksCreated?.length || 0,
        decisionsCreated: result.decisionsCreated?.length || 0,
        activities: (result.activities || []).map(a => ({
          agent: a.agent,
          message: a.message,
          tag: a.tag,
        })),
        textResponses: result.textResponses?.map(r => r.text) || [],
      },
    };
  } catch (error) {
    onEvent?.({ type: 'delegation_failed', teamId, error: error.message });
    return {
      success: false,
      message: `Delegation to ${teamPrompt.name} failed: ${error.message}`,
      data: { teamId, error: error.message },
    };
  }
}

function handleGetSystemOverview(stateContext) {
  const teams = Object.entries(stateContext.teams).map(([id, team]) => ({
    id,
    name: team.name,
    status: team.status,
    runCount: team.runCount,
    lastRun: team.lastRun,
  }));

  const taskCounts = {
    total: (stateContext.tasks || []).length,
    pending: (stateContext.tasks || []).filter(t => t.status === 'pending').length,
    inProgress: (stateContext.tasks || []).filter(t => t.status === 'in_progress').length,
    completed: (stateContext.tasks || []).filter(t => t.status === 'completed').length,
    blocked: (stateContext.tasks || []).filter(t => t.status === 'blocked').length,
  };

  const decisionCounts = {
    total: (stateContext.decisions || []).length,
    pending: (stateContext.decisions || []).filter(d => d.status === 'pending').length,
  };

  const recentActivity = (stateContext.activities || []).slice(0, 5).map(a => ({
    team: a.teamId,
    agent: a.agent,
    message: a.message,
    time: a.timestamp,
  }));

  return {
    success: true,
    message: 'System overview retrieved',
    data: {
      worldState: stateContext.worldState,
      teams,
      tasks: taskCounts,
      decisions: decisionCounts,
      recentActivity,
      creditStatus: stateContext.creditStatus,
    },
  };
}

function handleGetTeamStatus(input, stateContext) {
  const { teamId } = input;
  const team = stateContext.teams[teamId];

  if (!team) {
    return {
      success: false,
      message: `Team not found: ${teamId}`,
    };
  }

  const teamTasks = (stateContext.tasks || []).filter(t => t.teamId === teamId);
  const teamDecisions = (stateContext.decisions || []).filter(d => d.teamId === teamId);
  const teamActivities = (stateContext.activities || []).filter(a => a.teamId === teamId).slice(0, 10);

  return {
    success: true,
    message: `Status for ${team.name}`,
    data: {
      id: teamId,
      name: team.name,
      status: team.status,
      agents: team.agents,
      runCount: team.runCount,
      lastRun: team.lastRun,
      tasks: {
        active: teamTasks.filter(t => t.status === 'in_progress'),
        pending: teamTasks.filter(t => t.status === 'pending'),
        blocked: teamTasks.filter(t => t.status === 'blocked'),
      },
      pendingDecisions: teamDecisions.filter(d => d.status === 'pending'),
      recentActivity: teamActivities,
    },
  };
}

function handleGetPendingDecisions(stateContext) {
  const pending = (stateContext.decisions || []).filter(d => d.status === 'pending');

  return {
    success: true,
    message: `${pending.length} pending decision(s)`,
    data: pending.map(d => ({
      id: d.id,
      title: d.title,
      description: d.description,
      options: d.options,
      priority: d.priority,
      impact: d.impact,
      teamId: d.teamId,
      createdAt: d.createdAt,
    })),
  };
}

function handleGetAllTasks(input, stateContext) {
  let tasks = stateContext.tasks || [];

  if (input.status) {
    tasks = tasks.filter(t => t.status === input.status);
  }

  const limit = Math.min(input.limit || 20, 50);
  tasks = tasks.slice(0, limit);

  return {
    success: true,
    message: `${tasks.length} task(s) found`,
    data: tasks.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      teamId: t.teamId,
      progress: t.progress,
      createdAt: t.createdAt,
    })),
  };
}

function handleCreateDecisionForOwner(input, stateContext) {
  const decisionId = `dec-orch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const decision = {
    id: decisionId,
    title: input.title,
    description: input.description,
    priority: input.priority || 'medium',
    impact: input.impact || '',
    options: input.options || [],
    status: 'pending',
    teamId: 'orchestrator',
    requestedBy: 'orchestrator',
    createdAt: new Date().toISOString(),
  };

  if (!stateContext.decisions) stateContext.decisions = [];
  stateContext.decisions.unshift(decision);

  return {
    success: true,
    message: `Decision created: "${input.title}" (awaiting owner)`,
    data: { decisionId, title: input.title },
  };
}

function handleBroadcastMessage(input, stateContext) {
  const { message, targetTeams } = input;
  const teams = targetTeams || Object.keys(stateContext.teams);

  const commId = `comm-orch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  for (const teamId of teams) {
    if (stateContext.teams[teamId]) {
      const comm = {
        id: `${commId}-${teamId}`,
        from: { agent: 'Orchestrator', teamId: 'orchestrator' },
        to: { agent: 'Team', teamId },
        message,
        timestamp: new Date().toISOString(),
      };

      if (!stateContext.communications) stateContext.communications = [];
      stateContext.communications.unshift(comm);
    }
  }

  return {
    success: true,
    message: `Message broadcast to ${teams.length} team(s)`,
    data: { targetTeams: teams },
  };
}

function handleRespondToUser(input) {
  // This is a signal to end the orchestration loop and return to user
  return {
    success: true,
    isUserResponse: true,
    message: input.message,
    data: {
      delegationsCompleted: input.delegationsCompleted || 0,
      decisionsCreated: input.decisionsCreated || 0,
      suggestedNextSteps: input.suggestedNextSteps || [],
    },
  };
}

// =============================================================================
// MAIN ORCHESTRATOR LOOP
// =============================================================================

/**
 * Run the main orchestrator loop for a user message
 *
 * @param {string} userMessage - The user's message/request
 * @param {Array} conversationHistory - Previous messages in the conversation
 * @param {object} options - { apiKey, clientIp, onEvent }
 * @returns {Promise<object>} Orchestration result
 */
async function runOrchestratorLoop(userMessage, conversationHistory = [], options = {}) {
  const { apiKey, clientIp, onEvent = () => {} } = options;

  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    throw new Error('Valid Anthropic API key required');
  }

  // Build state context
  let creditStatus = { status: 'ok', message: 'Within limits' };
  try {
    creditStatus = checkCreditLimits();
  } catch (_e) { /* ignore */ }

  const stateContext = buildStateContext(creditStatus);

  // Build messages array
  const messages = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // Result accumulator
  const result = {
    success: false,
    userResponse: null,
    delegations: [],
    decisionsCreated: [],
    iterations: 0,
    usage: { inputTokens: 0, outputTokens: 0, apiCalls: 0 },
  };

  onEvent({ type: 'orchestrator_started', message: userMessage.substring(0, 100) });

  // Tool execution context
  const toolContext = { apiKey, clientIp, stateContext, onEvent };

  // The orchestration loop
  for (let iteration = 0; iteration < ORCHESTRATOR_CONFIG.maxIterations; iteration++) {
    result.iterations = iteration + 1;
    onEvent({ type: 'iteration_started', iteration: iteration + 1 });

    // Call Claude API
    let response;
    try {
      response = await callClaudeAPI(
        apiKey,
        ORCHESTRATOR_CONFIG.model,
        ORCHESTRATOR_SYSTEM_PROMPT,
        messages,
        ORCHESTRATOR_TOOLS
      );
    } catch (error) {
      result.userResponse = `I encountered an error: ${error.message}. Please try again.`;
      break;
    }

    // Track usage
    result.usage.inputTokens += response.usage?.input_tokens || 0;
    result.usage.outputTokens += response.usage?.output_tokens || 0;
    result.usage.apiCalls += 1;

    // Process response content
    const content = response.content || [];
    messages.push({ role: 'assistant', content });

    // Extract tool use blocks
    const toolUseBlocks = content.filter(b => b.type === 'tool_use');

    // If no tool use, take any text as the response
    if (toolUseBlocks.length === 0) {
      const textBlocks = content.filter(b => b.type === 'text');
      result.userResponse = textBlocks.map(b => b.text).join('\n') || 'Task completed.';
      result.success = true;
      break;
    }

    // Execute tools
    const toolResults = [];
    let shouldStopLoop = false;

    for (const toolUse of toolUseBlocks) {
      onEvent({ type: 'tool_call', tool: toolUse.name, input: toolUse.input });

      const toolResult = await executeOrchestratorTool(
        toolUse.name,
        toolUse.input || {},
        toolContext
      );

      onEvent({ type: 'tool_result', tool: toolUse.name, success: toolResult.success });

      // Track delegations
      if (toolUse.name === 'delegate_to_team' && toolResult.success) {
        result.delegations.push(toolResult.data);
      }

      // Track decisions
      if (toolUse.name === 'create_decision_for_owner' && toolResult.success) {
        result.decisionsCreated.push(toolResult.data);
      }

      // Check for user response (completion signal)
      if (toolUse.name === 'respond_to_user' || toolResult.isUserResponse) {
        result.userResponse = toolResult.message;
        result.success = true;
        shouldStopLoop = true;
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(toolResult),
      });
    }

    // Feed results back
    messages.push({ role: 'user', content: toolResults });

    onEvent({ type: 'iteration_completed', iteration: iteration + 1 });

    if (shouldStopLoop) {
      break;
    }
  }

  // If we didn't get a user response, synthesize one
  if (!result.userResponse) {
    if (result.delegations.length > 0) {
      result.userResponse = `I delegated work to ${result.delegations.length} team(s). The work may still be in progress. Check back for updates.`;
    } else {
      result.userResponse = 'I reached my iteration limit. Please try breaking your request into smaller parts.';
    }
  }

  result.success = true;
  onEvent({ type: 'orchestrator_completed', success: true });

  return result;
}

// =============================================================================
// CLAUDE API HELPER
// =============================================================================

async function callClaudeAPI(apiKey, model, systemPrompt, messages, tools) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for orchestrator

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096, // Higher for orchestrator
        system: systemPrompt,
        messages,
        tools,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unable to read error');
      throw new Error(`Claude API error ${response.status}: ${errorBody}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  ORCHESTRATOR_CONFIG,
  ORCHESTRATOR_SYSTEM_PROMPT,
  ORCHESTRATOR_TOOLS,
  runOrchestratorLoop,
  executeOrchestratorTool,
};
