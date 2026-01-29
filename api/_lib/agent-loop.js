/**
 * Agent Loop - Agentic Runtime
 * =============================
 *
 * Implements the observe-act-evaluate loop that makes agents truly agentic.
 * Instead of single-shot text generation, agents iterate with tools until
 * they signal completion or hit the iteration limit.
 *
 * Loop: Call Claude with tools → Execute tool calls → Feed results back → Repeat
 *
 * Implements the guide's principles:
 * - Agents in a loop (not single-shot)
 * - Explicit completion signals (signal_completion tool)
 * - Tool-based action (not just text)
 * - Rich context injection via system prompt
 * - Checkpointing for resilience (resume after failures)
 */

const { AGENT_TOOLS, executeAgentTool } = require('./agent-tools');
const { buildTeamContext } = require('./context-builder');
const { recordUsage, estimateTokens } = require('./cost-tracker');
const {
  createCheckpointState,
  checkpointAfterIteration,
  finalizeCheckpoint,
  loadCheckpoint,
  updateCheckpointStatus,
} = require('./checkpoint-manager');

// =============================================================================
// CONFIGURATION
// =============================================================================

const LOOP_CONFIG = {
  MAX_ITERATIONS: 6,           // Max tool-use cycles per invocation
  MODEL: 'claude-3-5-haiku-latest',
  MAX_TOKENS: 1024,            // Per API call (higher than single-shot for tool reasoning)
  API_TIMEOUT_MS: 20000,       // 20s timeout per API call
  ANTHROPIC_VERSION: '2023-06-01',
};

// =============================================================================
// MAIN AGENT LOOP
// =============================================================================

/**
 * Run an agentic loop for a team.
 *
 * @param {string} teamId - The team to orchestrate
 * @param {string} task - The task/assignment in natural language
 * @param {object} teamPrompt - Team prompt config { name, systemPrompt, agents }
 * @param {object} stateContext - Mutable state context for tools
 * @param {object} options - { apiKey, model, maxIterations, clientIp, enableCheckpoint, onEvent }
 * @returns {Promise<AgentLoopResult>}
 */
async function runAgentLoop(teamId, task, teamPrompt, stateContext, options = {}) {
  const apiKey = options.apiKey;
  const model = options.model || LOOP_CONFIG.MODEL;
  const maxIterations = options.maxIterations || LOOP_CONFIG.MAX_ITERATIONS;
  const clientIp = options.clientIp || 'internal';
  const enableCheckpoint = options.enableCheckpoint !== false; // Default: true
  const onEvent = options.onEvent || (() => {}); // Event callback for SSE

  const provider = options.provider || 'anthropic';

  if (!apiKey) {
    throw new Error(`API key required for provider: ${provider}`);
  }
  if (provider === 'anthropic' && !apiKey.startsWith('sk-ant-')) {
    throw new Error('Valid Anthropic API key required (sk-ant-...)');
  }
  if (provider === 'openai' && !apiKey.startsWith('sk-')) {
    throw new Error('Valid OpenAI API key required (sk-...)');
  }

  // Build context-rich system prompt
  const systemPrompt = buildTeamContext(teamId, teamPrompt, stateContext);

  // Initialize conversation with the assignment
  const messages = [{ role: 'user', content: buildAssignmentPrompt(task, teamPrompt) }];

  // Create checkpoint state if enabled
  let checkpoint = null;
  if (enableCheckpoint) {
    checkpoint = createCheckpointState(teamId, task, teamPrompt, stateContext);
    onEvent({ type: 'checkpoint_created', sessionId: checkpoint.sessionId });
  }

  // Result accumulator
  const result = {
    success: false,
    completed: false,
    iterations: 0,
    activities: [],
    tasksCreated: [],
    decisionsCreated: [],
    messagesSent: [],
    toolCalls: [],
    completionSummary: null,
    textResponses: [],
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      apiCalls: 0,
    },
    teamId,
    teamName: teamPrompt.name,
    sessionId: checkpoint?.sessionId || null,
  };

  // Track activities count before loop to extract new ones after
  const activitiesBefore = (stateContext.activities || []).length;

  // Emit start event
  onEvent({ type: 'loop_started', teamId, task: task.substring(0, 100) });

  // -------------------------------------------------------------------------
  // THE LOOP
  // -------------------------------------------------------------------------
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    result.iterations = iteration + 1;

    // Emit iteration start event
    onEvent({ type: 'iteration_started', iteration: iteration + 1, maxIterations });

    // Call Claude API with tools
    let response;
    try {
      onEvent({ type: 'thinking', message: `Iteration ${iteration + 1}: Calling ${provider} API...` });
      response = await callLLMAPI(provider, apiKey, model, systemPrompt, messages, AGENT_TOOLS);
    } catch (error) {
      // If API call fails, log and stop
      result.completionSummary = `API error on iteration ${iteration + 1}: ${error.message}`;
      onEvent({ type: 'error', message: result.completionSummary });

      // Save checkpoint with failed status
      if (checkpoint) {
        await finalizeCheckpoint(checkpoint, result, 'failed');
      }
      break;
    }

    // Track usage
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    result.usage.inputTokens += inputTokens;
    result.usage.outputTokens += outputTokens;
    result.usage.apiCalls += 1;

    // Record cost
    try {
      const costResult = recordUsage({
        provider,
        model,
        inputTokens,
        outputTokens,
        endpoint: '/api/orchestrate (agentic)',
        clientIp,
        success: true,
        latencyMs: response._latencyMs || 0,
      });
      result.usage.totalCost += costResult?.cost || 0;
    } catch (_e) {
      // Cost tracking failure shouldn't break the loop
    }

    // Process response content blocks
    const content = response.content || [];
    messages.push({ role: 'assistant', content });

    // Extract text responses
    const textBlocks = content.filter(b => b.type === 'text');
    if (textBlocks.length > 0) {
      result.textResponses.push(
        ...textBlocks.map(b => ({
          text: b.text,
          iteration: iteration + 1,
        }))
      );
    }

    // Extract tool use blocks
    const toolUseBlocks = content.filter(b => b.type === 'tool_use');

    // If no tool use, agent is done (pure text response = natural completion)
    if (toolUseBlocks.length === 0) {
      result.completed = true;
      result.completionSummary =
        textBlocks.map(b => b.text).join('\n') || 'Agent completed without explicit summary.';
      break;
    }

    // Execute each tool call
    const toolResults = [];
    let completionSignaled = false;

    for (const toolUse of toolUseBlocks) {
      // Emit tool call event
      onEvent({ type: 'tool_call', tool: toolUse.name, input: toolUse.input });

      const toolResult = executeAgentTool(
        toolUse.name,
        toolUse.input || {},
        teamId,
        stateContext
      );

      // Emit tool result event
      onEvent({ type: 'tool_result', tool: toolUse.name, success: toolResult.success });

      // Track the tool call
      result.toolCalls.push({
        tool: toolUse.name,
        input: toolUse.input,
        output: toolResult,
        iteration: iteration + 1,
      });

      // Track side effects
      if (toolUse.name === 'create_task' && toolResult.success) {
        result.tasksCreated.push(toolResult.data);
        onEvent({ type: 'task_created', task: toolResult.data });
      }
      if (toolUse.name === 'create_decision_request' && toolResult.success) {
        result.decisionsCreated.push(toolResult.data);
        onEvent({ type: 'decision_created', decision: toolResult.data });
      }
      if (toolUse.name === 'send_message' && toolResult.success) {
        result.messagesSent.push(toolResult.data);
        onEvent({ type: 'message_sent', message: toolResult.data });
      }

      // Check for completion signal
      if (toolUse.name === 'signal_completion') {
        completionSignaled = true;
        result.completed = true;
        result.completionSummary = toolResult.data?.summary || 'Completed';
        onEvent({ type: 'completion_signaled', summary: result.completionSummary });
      }

      // Build tool result message
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(toolResult),
      });
    }

    // Feed tool results back to Claude
    messages.push({ role: 'user', content: toolResults });

    // Save checkpoint after each iteration
    if (checkpoint) {
      await checkpointAfterIteration(
        checkpoint,
        iteration + 1,
        messages,
        result.toolCalls,
        result.textResponses
      );
    }

    // Emit iteration complete event
    onEvent({
      type: 'iteration_completed',
      iteration: iteration + 1,
      toolCalls: toolUseBlocks.length,
      completed: completionSignaled,
    });

    // If completion was signaled, break after feeding results
    if (completionSignaled) {
      break;
    }
  }

  // -------------------------------------------------------------------------
  // POST-LOOP
  // -------------------------------------------------------------------------

  // Extract new activities created during the loop
  const allActivities = stateContext.activities || [];
  result.activities = allActivities.slice(0, allActivities.length - activitiesBefore);

  // If we hit max iterations without completion
  if (!result.completed) {
    result.completionSummary = `Reached maximum iterations (${maxIterations}). Work may be incomplete.`;
    onEvent({ type: 'max_iterations_reached', iterations: maxIterations });
  }

  result.success = result.completed || result.toolCalls.length > 0;

  // Finalize checkpoint
  if (checkpoint) {
    const status = result.completed ? 'completed' : 'interrupted';
    await finalizeCheckpoint(checkpoint, result, status);
    onEvent({ type: 'checkpoint_finalized', sessionId: checkpoint.sessionId, status });
  }

  // Emit completion event
  onEvent({
    type: 'loop_completed',
    success: result.success,
    completed: result.completed,
    iterations: result.iterations,
    toolCalls: result.toolCalls.length,
    summary: result.completionSummary,
  });

  return result;
}

/**
 * Resume an agent loop from a checkpoint.
 *
 * @param {string} sessionId - The session ID to resume
 * @param {object} stateContext - Current state context
 * @param {object} options - { apiKey, model, maxIterations, clientIp, onEvent }
 * @returns {Promise<AgentLoopResult>}
 */
async function resumeAgentLoop(sessionId, stateContext, options = {}) {
  const checkpoint = await loadCheckpoint(sessionId);

  if (!checkpoint) {
    throw new Error(`Checkpoint not found: ${sessionId}`);
  }

  if (!['running', 'interrupted'].includes(checkpoint.status)) {
    throw new Error(`Cannot resume checkpoint with status: ${checkpoint.status}`);
  }

  const onEvent = options.onEvent || (() => {});

  onEvent({
    type: 'resuming_from_checkpoint',
    sessionId,
    iteration: checkpoint.iteration,
    previousToolCalls: checkpoint.toolCalls?.length || 0,
  });

  // Update checkpoint status to running
  await updateCheckpointStatus(sessionId, 'running');

  // Reconstruct team prompt from checkpoint
  const teamPrompt = checkpoint.teamPrompt;

  // Calculate remaining iterations
  const maxIterations = options.maxIterations || LOOP_CONFIG.MAX_ITERATIONS;
  const remainingIterations = maxIterations - checkpoint.iteration;

  if (remainingIterations <= 0) {
    return {
      success: false,
      completed: false,
      iterations: checkpoint.iteration,
      completionSummary: 'No remaining iterations after resume',
      sessionId,
      teamId: checkpoint.teamId,
      teamName: teamPrompt.name,
      toolCalls: checkpoint.toolCalls || [],
      textResponses: checkpoint.textResponses || [],
      activities: [],
      tasksCreated: [],
      decisionsCreated: [],
      messagesSent: [],
      usage: { inputTokens: 0, outputTokens: 0, totalCost: 0, apiCalls: 0 },
    };
  }

  // Run the loop with remaining iterations, starting from checkpoint state
  return runAgentLoop(
    checkpoint.teamId,
    checkpoint.task,
    teamPrompt,
    stateContext,
    {
      ...options,
      maxIterations: remainingIterations,
      enableCheckpoint: true,
    }
  );
}

// =============================================================================
// CLAUDE API CALLER
// =============================================================================

/**
 * Call the Claude API with tools.
 *
 * @param {string} apiKey - Anthropic API key
 * @param {string} model - Model ID
 * @param {string} systemPrompt - System prompt
 * @param {Array} messages - Conversation messages
 * @param {Array} tools - Tool definitions
 * @returns {Promise<object>} Claude API response
 */
async function callClaudeAPI(apiKey, model, systemPrompt, messages, tools) {
  const startTime = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOP_CONFIG.API_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': LOOP_CONFIG.ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: LOOP_CONFIG.MAX_TOKENS,
        system: systemPrompt,
        messages,
        tools,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unable to read error body');
      throw new Error(`Claude API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    data._latencyMs = Date.now() - startTime;
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================================================
// OPENAI API CALLER (Responses API)
// =============================================================================

/**
 * Call the OpenAI Responses API with tools.
 *
 * Maps Anthropic-style messages and tool definitions to OpenAI format,
 * then normalizes the response back to the { content: [...] } shape
 * the agent loop expects.
 *
 * @param {string} apiKey - OpenAI API key
 * @param {string} model - Model ID (e.g. 'codex-mini-latest')
 * @param {string} systemPrompt - System prompt
 * @param {Array} messages - Conversation messages (Anthropic format)
 * @param {Array} tools - Tool definitions (Anthropic format)
 * @returns {Promise<object>} Normalized response matching Anthropic shape
 */
async function callOpenAIAPI(apiKey, model, systemPrompt, messages, tools) {
  const startTime = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOP_CONFIG.API_TIMEOUT_MS);

  try {
    // Map Anthropic tool definitions → OpenAI function-calling format
    const openaiTools = (tools || []).map(tool => ({
      type: 'function',
      name: tool.name,
      description: tool.description || '',
      parameters: tool.input_schema || { type: 'object', properties: {} },
    }));

    // Build OpenAI input items from messages
    const input = [];

    // Add system message
    input.push({ role: 'system', content: systemPrompt });

    // Map Anthropic messages → OpenAI format
    for (const msg of messages) {
      if (msg.role === 'user') {
        // User messages: could be string or array of content blocks
        if (typeof msg.content === 'string') {
          input.push({ role: 'user', content: msg.content });
        } else if (Array.isArray(msg.content)) {
          // Anthropic tool_result blocks → OpenAI function call outputs
          const toolResults = msg.content.filter(b => b.type === 'tool_result');
          if (toolResults.length > 0) {
            for (const tr of toolResults) {
              input.push({
                type: 'function_call_output',
                call_id: tr.tool_use_id,
                output: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content),
              });
            }
          } else {
            // Plain text content blocks
            const text = msg.content.map(b => b.text || '').join('\n');
            if (text) input.push({ role: 'user', content: text });
          }
        }
      } else if (msg.role === 'assistant') {
        // Assistant messages: array of content blocks
        if (Array.isArray(msg.content)) {
          const textParts = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
          const toolUses = msg.content.filter(b => b.type === 'tool_use');

          if (textParts) {
            input.push({ role: 'assistant', content: textParts });
          }
          for (const tu of toolUses) {
            input.push({
              type: 'function_call',
              id: tu.id,
              call_id: tu.id,
              name: tu.name,
              arguments: JSON.stringify(tu.input || {}),
            });
          }
        } else if (typeof msg.content === 'string') {
          input.push({ role: 'assistant', content: msg.content });
        }
      }
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions: systemPrompt,
        input,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        max_output_tokens: LOOP_CONFIG.MAX_TOKENS,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unable to read error body');
      throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    // Normalize OpenAI response → Anthropic-compatible shape
    const content = [];
    const outputItems = data.output || [];

    for (const item of outputItems) {
      if (item.type === 'message') {
        // Extract text from message content
        for (const part of (item.content || [])) {
          if (part.type === 'output_text') {
            content.push({ type: 'text', text: part.text });
          }
        }
      } else if (item.type === 'function_call') {
        // Map to Anthropic tool_use shape
        let parsedInput = {};
        try {
          parsedInput = JSON.parse(item.arguments || '{}');
        } catch (_e) { /* keep empty object */ }

        content.push({
          type: 'tool_use',
          id: item.call_id || item.id || `call_${Date.now()}`,
          name: item.name,
          input: parsedInput,
        });
      }
    }

    // If no content was extracted, add empty text
    if (content.length === 0) {
      const fallbackText = typeof data.output === 'string' ? data.output : '';
      if (fallbackText) {
        content.push({ type: 'text', text: fallbackText });
      }
    }

    // Build normalized response
    const normalized = {
      content,
      usage: {
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0,
      },
      _latencyMs: Date.now() - startTime,
    };

    return normalized;
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================================================
// LLM API DISPATCHER
// =============================================================================

/**
 * Route API calls to the correct provider.
 *
 * @param {string} provider - 'anthropic' or 'openai'
 * @param {string} apiKey - Provider API key
 * @param {string} model - Model ID
 * @param {string} systemPrompt - System prompt
 * @param {Array} messages - Conversation messages
 * @param {Array} tools - Tool definitions
 * @returns {Promise<object>} Normalized API response
 */
async function callLLMAPI(provider, apiKey, model, systemPrompt, messages, tools) {
  switch (provider) {
    case 'openai':
      return callOpenAIAPI(apiKey, model, systemPrompt, messages, tools);
    case 'anthropic':
    default:
      return callClaudeAPI(apiKey, model, systemPrompt, messages, tools);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Build the initial assignment prompt for the agent.
 */
function buildAssignmentPrompt(task, teamPrompt) {
  return `## Assignment

${task}

## Your Team

You are leading: ${teamPrompt.agents.join(', ')}

## Instructions

1. Assess the current situation using observation tools if needed.
2. Take concrete action using your tools - create tasks, coordinate with teams, report findings.
3. When finished, call signal_completion with a summary of what you accomplished.

Begin.`;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  runAgentLoop,
  resumeAgentLoop,
  LOOP_CONFIG,
};
